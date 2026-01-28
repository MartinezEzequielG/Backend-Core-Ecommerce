import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { randomBytes } from 'crypto';

import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // =========================
  // Core helpers
  // =========================
  private isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private authCookieBase() {
    // Si Admin (Amplify) y Backend (EC2) están en dominios distintos en PROD:
    // SameSite=None + Secure=true es obligatorio para que el browser envíe cookies cross-site.
    return {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: (this.isProd() ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  private csrfCookieBase() {
    return {
      httpOnly: false, // el front la lee para mandarla en header
      secure: this.isProd(),
      sameSite: (this.isProd() ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  // =========================
  // Existing methods (fix TS2339)
  // =========================

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    const { password: _pw, ...result } = user as any;
    return result;
  }

  async register(data: RegisterDto) {
    const user = await this.usersService.createUser(data);
    const { password, ...userSafe } = user as any;
    return userSafe;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  // =========================
  // Cookie-based session
  // =========================

  async loginAndSetCookie(res: Response, user: any) {
    const { access_token, user: safeUser } = await this.login(user);

    // JWT cookie
    res.cookie('token', access_token, {
      ...this.authCookieBase(),
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    });

    // (recomendado) emitir CSRF cookie para simplificar el flujo
    this.issueCsrfCookie(res);

    return { user: safeUser };
  }

  issueCsrfCookie(res: Response) {
    const csrf = randomBytes(32).toString('hex');

    res.cookie('csrf', csrf, {
      ...this.csrfCookieBase(),
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return { ok: true };
  }

  clearAuthCookies(res: Response) {
    // Para borrar, repetimos path y flags
    res.cookie('token', '', {
      ...this.authCookieBase(),
      maxAge: 0,
    });

    res.cookie('csrf', '', {
      ...this.csrfCookieBase(),
      maxAge: 0,
    });

    return { ok: true };
  }
}