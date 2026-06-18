import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type CorreoTokenResponse = { token?: string; access_token?: string };
type CorreoRate = {
  deliveredType?: 'D' | 'S';
  productName?: string;
  price?: number;
  deliveryTimeMin?: string | number;
  deliveryTimeMax?: string | number;
};

@Injectable()
export class CorreoArgentinoService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private baseUrl() {
    return (process.env.CORREO_ARG_BASE_URL || 'https://api.correoargentino.com.ar/micorreo/v1').replace(/\/+$/, '');
  }

  private async getToken(): Promise<string> {
    const user = process.env.CORREO_ARG_USER;
    const pass = process.env.CORREO_ARG_PASSWORD;
    if (!user || !pass) throw new ServiceUnavailableException('Correo Argentino: faltan credenciales');

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now) return this.tokenCache.token;

    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    const res = await fetch(`${this.baseUrl()}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`Correo Argentino: error token (${res.status}) ${text}`);
    }

    const data = (await res.json().catch(() => ({}))) as CorreoTokenResponse;
    const token = data.token || data.access_token;
    if (!token) throw new ServiceUnavailableException('Correo Argentino: respuesta token inválida');

    // MVP: cache simple 50 min
    this.tokenCache = { token, expiresAt: now + 50 * 60 * 1000 };
    return token;
  }

  async quoteDomicilio(params: { postalCodeDestination: string }) {
    const customerId = process.env.CORREO_ARG_CUSTOMER_ID;
    const originZip = process.env.CORREO_ARG_POSTAL_CODE_ORIGIN;
    if (!customerId || !originZip) {
      throw new ServiceUnavailableException('Correo Argentino: faltan CORREO_ARG_CUSTOMER_ID / CORREO_ARG_POSTAL_CODE_ORIGIN');
    }

    const postalCodeDestination = String(params.postalCodeDestination || '').trim();
    if (!postalCodeDestination) throw new BadRequestException('postalCodeDestination requerido');

    const weight = Number(process.env.CORREO_ARG_DEFAULT_WEIGHT_G || 1000);
    const height = Number(process.env.CORREO_ARG_DEFAULT_HEIGHT_CM || 10);
    const width = Number(process.env.CORREO_ARG_DEFAULT_WIDTH_CM || 20);
    const length = Number(process.env.CORREO_ARG_DEFAULT_LENGTH_CM || 20);

    const token = await this.getToken();

    const res = await fetch(`${this.baseUrl()}/rates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        customerId,
        postalCodeOrigin: String(originZip),
        postalCodeDestination,
        dimensions: { weight, height, width, length },
        // MVP: solo domicilio. Si tu API no soporta esto, simplemente filtramos respuesta.
        deliveredType: 'D',
      }),
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Correo Argentino: error cotizando (${res.status}) ${text?.slice(0, 500) || ''}`,
      );
    }

    const rates = (data?.rates || []) as CorreoRate[];
    const domicilioRates = rates.filter((r) => r?.deliveredType === 'D' && Number(r?.price) > 0);

    if (domicilioRates.length === 0) {
      throw new ServiceUnavailableException('Correo Argentino: no devolvió tarifas a domicilio');
    }

    // MVP: elegir la más barata
    const best = domicilioRates.reduce((acc, r) => (Number(r.price) < Number(acc.price) ? r : acc));

    return {
      provider: 'CORREO_ARGENTINO',
      deliveredType: 'D',
      serviceName: best.productName || 'Correo Argentino',
      price: Number(best.price),
      etaMin: Number(best.deliveryTimeMin ?? 0) || null,
      etaMax: Number(best.deliveryTimeMax ?? 0) || null,
    };
  }
}