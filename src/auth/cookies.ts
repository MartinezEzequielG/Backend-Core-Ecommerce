import type { CookieOptions } from 'express';

function isProd() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Si Admin y Backend son cross-site (dominios distintos):
 * - COOKIE_SAMESITE="none" y COOKIE_SECURE=true
 *
 * Si están bajo mismo dominio base (subdominios):
 * - SameSite="lax" suele andar perfecto.
 */
function cookieSameSite(): CookieOptions['sameSite'] {
  const v = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (v === 'none') return 'none';
  if (v === 'strict') return 'strict';
  return 'lax';
}

function cookieDomain(): string | undefined {
  // setear solo si lo necesitás (ej: ".tudominio.com")
  const d = (process.env.COOKIE_DOMAIN || '').trim();
  return d ? d : undefined;
}

export function buildAuthCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  const secure =
    (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || isProd();

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain: cookieDomain(),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  };
}

export function buildCsrfCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  const secure =
    (process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || isProd();

  return {
    httpOnly: false, // el frontend lo lee
    secure,
    sameSite,
    domain: cookieDomain(),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}