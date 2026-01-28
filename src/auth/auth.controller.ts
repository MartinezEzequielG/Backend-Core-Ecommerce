import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // <- asumido que ya lo tenés
import { CsrfGuard } from './guards/csrf.guard';

// Rate limit (recomendado)
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Si register lo vas a exponer en producción: también conviene rate-limit.
    // De momento lo dejo simple.
    return this.authService.register(req.body as RegisterDto);
  }

  /**
   * Login:
   * - LocalAuthGuard valida credenciales y setea req.user
   * - Responde seteando cookie HttpOnly "token"
   * - NO requiere CSRF (no hay sesión aún)
   */
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // 8 intentos por minuto por IP (ajustable)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    return this.authService.loginAndSetCookie(res, req.user);
  }

  /**
   * /me:
   * - valida cookie JWT (JwtAuthGuard)
   * - devuelve user info para hidratar sesión del admin
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    // JwtStrategy suele setear req.user con payload
    return { user: req.user };
  }

  /**
   * CSRF token:
   * - Se usa para endpoints mutantes cuando autenticás por cookies
   * - Frontend lo lee y lo manda en header: x-csrf-token
   */
  @UseGuards(JwtAuthGuard)
  @Get('csrf')
  async csrf(@Res({ passthrough: true }) res: Response) {
    return this.authService.issueCsrfCookie(res);
  }

  /**
   * Logout:
   * - requiere estar logueado
   * - y requiere CSRF (mutación)
   */
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.clearAuthCookies(res);
  }
}