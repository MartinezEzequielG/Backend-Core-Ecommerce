import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

function asMessage(m: unknown): string {
  if (Array.isArray(m)) return m.map(String).join(' | ');
  if (typeof m === 'string') return m;
  return '';
}

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<any>();
    const req = ctx.getRequest<any>();

    const path = req?.originalUrl || req?.url;
    const timestamp = new Date().toISOString();
    const isProd = process.env.NODE_ENV === 'production';

    // 1) Errores HTTP de Nest (ValidationPipe, BadRequest, Forbidden, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse() as any;

      const message =
        typeof resp === 'string'
          ? resp
          : asMessage(resp?.message) || resp?.error || exception.message || 'Error';

      return res.status(status).json({
        statusCode: status,
        message,
        path,
        timestamp,
      });
    }

    // 2) Prisma - errores "known"
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint
      if (exception.code === 'P2002') {
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'Unique constraint failed',
          path,
          timestamp,
        });
      }

      // P2025: record not found
      if (exception.code === 'P2025') {
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          path,
          timestamp,
        });
      }

      // P2003: FK constraint (suele ser request inválida)
      if (exception.code === 'P2003') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          path,
          timestamp,
        });
      }
    }

    // 3) Prisma - validación (inputs mal armados)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data',
        path,
        timestamp,
      });
    }

    // 4) Fallback (no filtrar detalles internos en prod)
    const fallbackMsg =
      !isProd && exception && typeof exception === 'object' && 'message' in exception
        ? String((exception as any).message)
        : 'Internal server error';

    if (!isProd) {
      // log útil en dev/staging
      // eslint-disable-next-line no-console
      console.error('Unhandled exception:', exception);
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: fallbackMsg,
      path,
      timestamp,
    });
  }
}