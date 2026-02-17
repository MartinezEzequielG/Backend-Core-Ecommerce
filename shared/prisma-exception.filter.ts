import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // ✅ Mostrar mensaje real para BadRequest/ValidationPipe, etc.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse() as any;

      const message =
        typeof resp === 'string'
          ? resp
          : Array.isArray(resp?.message)
            ? resp.message.join(' | ')
            : resp?.message || exception.message || 'Error';

      return res.status(status).json({ statusCode: status, message });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res.status(409).json({ statusCode: 409, message: 'Unique constraint failed' });
      }
      if (exception.code === 'P2025') {
        return res.status(404).json({ statusCode: 404, message: 'Record not found' });
      }
    }

    const status = exception?.status ?? 500;
    return res.status(status).json({
      statusCode: status,
      message: exception?.message ?? 'Internal server error',
    });
  }
}