import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AndreaniAuthService } from './andreani-auth.service';

export type ShippingQuoteInput = {
  postalCodeDestination: string;
};

export type ShippingQuoteOption = {
  provider: 'ANDREANI';
  serviceName: string;
  deliveryType: 'HOME';
  price: number;
  etaMin: number | null;
  etaMax: number | null;
};

@Injectable()
export class AndreaniQuoteService {
  constructor(private readonly andreaniAuth: AndreaniAuthService) {}

  private getEnv(name: string): string {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new ServiceUnavailableException(`Andreani: falta ${name}`);
    return value;
  }

  private getOriginZip(): string {
    return this.getEnv('ANDREANI_POSTAL_CODE_ORIGIN');
  }

  private getQuoteUrl(): string {
    return this.getEnv('ANDREANI_QUOTE_URL');
  }

  private validateDestinationZip(zip: string): string {
    const normalized = String(zip || '').trim();
    if (!/^\d{4}$/.test(normalized)) throw new BadRequestException('El código postal debe tener 4 dígitos');
    return normalized;
  }

  private buildAndreaniPayload(params: { originZip: string; destinationZip: string }) {
    const weightG = Number(process.env.ANDREANI_DEFAULT_WEIGHT_G || 1000);
    const heightCm = Number(process.env.ANDREANI_DEFAULT_HEIGHT_CM || 10);
    const widthCm = Number(process.env.ANDREANI_DEFAULT_WIDTH_CM || 20);
    const lengthCm = Number(process.env.ANDREANI_DEFAULT_LENGTH_CM || 20);

    // TODO: ajustar al schema exacto del endpoint de cotización que tengas habilitado en Andreani
    return {
      originPostalCode: params.originZip,
      destinationPostalCode: params.destinationZip,
      deliveryType: 'HOME',
      package: { weight: weightG, height: heightCm, width: widthCm, length: lengthCm },
    };
  }

  private extractAndreaniPrice(data: any): number {
    const candidates = [
      data?.price,
      data?.importe,
      data?.total,
      data?.tarifa,
      data?.cotizacion?.price,
      data?.cotizacion?.importe,
      data?.cotizacion?.total,
      Array.isArray(data?.rates) ? data.rates?.[0]?.price : undefined,
      Array.isArray(data?.tarifas) ? data.tarifas?.[0]?.importe : undefined,
    ];
    const v = candidates.find((x) => x !== undefined && x !== null);
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  async quoteHome(input: ShippingQuoteInput): Promise<{ option: ShippingQuoteOption; raw: any }> {
    const destinationZip = this.validateDestinationZip(input.postalCodeDestination);

    const token = await this.andreaniAuth.getToken();
    const originZip = this.getOriginZip();
    const quoteUrl = this.getQuoteUrl();

    const payload = this.buildAndreaniPayload({ originZip, destinationZip });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(quoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-authorization-token': token,
        },
        body: JSON.stringify(payload),
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
        throw new ServiceUnavailableException(`Andreani: error cotizando (${res.status}) ${String(text).slice(0, 500)}`);
      }

      const price = this.extractAndreaniPrice(data);
      if (!Number.isFinite(price) || price <= 0) {
        throw new ServiceUnavailableException('Andreani: no pude obtener el precio del response (falta ajustar mapping)');
      }

      return {
        option: {
          provider: 'ANDREANI',
          serviceName: data?.serviceName || data?.servicio || data?.service || 'Andreani a domicilio',
          deliveryType: 'HOME',
          price,
          etaMin: Number.isFinite(Number(data?.etaMin)) ? Number(data.etaMin) : null,
          etaMax: Number.isFinite(Number(data?.etaMax)) ? Number(data.etaMax) : null,
        },
        raw: data,
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new ServiceUnavailableException('Andreani: timeout cotizando envío');
      if (e instanceof BadRequestException || e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException(`Andreani: error de conexión: ${e?.message || 'desconocido'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}