import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type AndreaniLoginResponse = {
  token?: string;
  access_token?: string;
  xAuthorizationToken?: string;
  authorizationToken?: string;
};

@Injectable()
export class AndreaniAuthService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private getEnv(name: string): string {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new ServiceUnavailableException(`Andreani: falta ${name}`);
    return value;
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now) return this.tokenCache.token;

    const loginUrl = this.getEnv('ANDREANI_LOGIN_URL');
    const userName = this.getEnv('ANDREANI_USERNAME');
    const password = this.getEnv('ANDREANI_PASSWORD');

    const basic = Buffer.from(`${userName}:${password}`).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ userName, password }),
        signal: controller.signal,
      });

      const text = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text || null;
      }

      if (!res.ok) {
        throw new ServiceUnavailableException(
          `Andreani login error (${res.status}) ${String(text).slice(0, 500)}`,
        );
      }

      const parsed: AndreaniLoginResponse = data && typeof data === 'object' ? data : {};
      const token =
        parsed.token ||
        parsed.access_token ||
        parsed.xAuthorizationToken ||
        parsed.authorizationToken;

      if (!token) throw new ServiceUnavailableException('Andreani: el login no devolvió token');

      // Cache 23h (doc ~24h)
      this.tokenCache = { token, expiresAt: now + 23 * 60 * 60 * 1000 };
      return token;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new ServiceUnavailableException('Andreani: timeout en login');
      if (e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException(`Andreani: error de conexión en login: ${e?.message || 'desconocido'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}