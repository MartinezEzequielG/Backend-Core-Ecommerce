import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();

    const cookieToken = req.cookies?.csrf;
    const headerToken =
      (req.headers['x-csrf-token'] as string | undefined) ||
      (req.headers['x-csrf'] as string | undefined);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }

    return true;
  }
}