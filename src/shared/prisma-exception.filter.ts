import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res.status(409).json({ statusCode: 409, message: 'Unique constraint failed' });
      }
      if (exception.code === 'P2025') {
        return res.status(404).json({ statusCode: 404, message: 'Record not found' });
      }
    }

    const status = exception?.status ?? 500;
    res.status(status).json({
      statusCode: status,
      message: exception?.message ?? 'Internal server error',
    });
  }
}