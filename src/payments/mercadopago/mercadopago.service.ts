import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { backendPublicUrl, mpAccessToken, MP_API_BASE, mpPreferSandbox } from './mercadopago.constants';
import type { MpPayment, MpPreferenceResponse } from './mercadopago.types';

@Injectable()
export class MercadoPagoService {
  constructor(private readonly prisma: PrismaService) {}

  async createPreferenceForOrder(params: { orderId: number; userId?: number; guestSessionToken?: string }) {
    const { orderId, userId, guestSessionToken } = params;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: {
                  select: {
                    url: true,
                    position: true,
                  },
                  orderBy: {
                    position: 'asc',
                  },
                  take: 1,
                },
              },
            },
            productVariant: {
              select: {
                sku: true,
                options: {
                  select: {
                    optionValue: {
                      select: {
                        value: true,
                        product: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new BadRequestException('Orden inexistente');

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('La orden no está pendiente de pago');
    }

    // autorización
    if (order.userId) {
      if (!userId || order.userId !== userId) throw new UnauthorizedException('No autorizado');
    } else {
      if (!guestSessionToken || order.guestSessionToken !== guestSessionToken) {
        throw new UnauthorizedException('No autorizado');
      }
    }

    const total = Number(order.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) throw new BadRequestException('Total inválido');

    const externalRef = `order:${orderId}`;

    const safeItems =
      Array.isArray(order.items) && order.items.length
        ? order.items
            .map((it: any) => {
              const quantity = Number(it.quantity || 0);
              const unitPrice = Number(it.unitPrice || 0);

              const productName = String(it.product?.name || '').trim();

              const variantLabel =
                it.productVariant?.options
                  ?.map((opt: any) => {
                    const attrName = opt.optionValue?.product?.name;
                    const value = opt.optionValue?.value;

                    if (!attrName || !value) return null;

                    return `${attrName}: ${value}`;
                  })
                  .filter(Boolean)
                  .join(' / ') || '';

              const title = variantLabel
                ? `${productName} - ${variantLabel}`
                : productName;

              const pictureUrl = String(it.product?.images?.[0]?.url || '').trim();

              if (!title || quantity <= 0 || unitPrice <= 0) return null;

              return {
                title,
                description: 'Suplementación Formosa',
                quantity,
                unit_price: unitPrice,
                currency_id: 'ARS' as const,
                ...(pictureUrl ? { picture_url: pictureUrl } : {}),
              };
            })
            .filter(Boolean)
        : [];

    const items =
      safeItems.length > 0
        ? safeItems
        : [{ title: `Orden #${orderId}`, quantity: 1, unit_price: total, currency_id: 'ARS' as const }];

    const pub = backendPublicUrl();

    if (!/^https:\/\//i.test(pub) || /localhost|127\.0\.0\.1/i.test(pub)) {
      throw new BadRequestException(
        `BACKEND_PUBLIC_URL inválida para MercadoPago: "${pub}". Configurá una URL pública https (dominio).`,
      );
    }

    // ✅ Debe matchear tu versioning real: /api/V1
    const apiBase = `${pub}/api/V1`;

    const body: any = {
      external_reference: externalRef,
      metadata: { orderId },
      items,
      back_urls: {
        success: `${apiBase}/payments/return/success/${orderId}`,
        pending: `${apiBase}/payments/return/pending/${orderId}`,
        failure: `${apiBase}/payments/return/failure/${orderId}`,
      },
    };

    const pm = String(order.paymentMethod || '').toUpperCase();

    if (pm === 'MP_TRANSFER') {
      body.payment_methods = {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
          { id: 'atm' },
        ],
      };
    }

    if (!mpPreferSandbox()) {
      body.notification_url = `${apiBase}/payments/webhook`;
      body.auto_return = 'approved';
    }

    // ✅ Si querés auto_return solo en prod real:
    // if (!mpPreferSandbox()) body.auto_return = 'approved';

    const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken()}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      const mpReqId = res.headers.get('x-request-id') || res.headers.get('x-mp-request-id') || '';
      throw new BadRequestException(
        `MercadoPago error HTTP ${res.status} (mp-request-id=${mpReqId}): ${text || '(empty response)'}`,
      );
    }

    const pref = JSON.parse(text) as MpPreferenceResponse;

    const initPoint = mpPreferSandbox()
      ? pref.sandbox_init_point || pref.init_point
      : pref.init_point || pref.sandbox_init_point;

    if (!initPoint) {
      throw new BadRequestException(`MP preference creada pero sin init_point: ${text}`);
    }

    return {
      preferenceId: pref.id,
      initPoint,
      sandboxInitPoint: pref.sandbox_init_point,
    };
  }

  async getPayment(paymentId: string): Promise<MpPayment> {
    const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken()}` },
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) throw new BadRequestException(`MP getPayment HTTP ${res.status}: ${text}`);

    return JSON.parse(text) as MpPayment;
  }
}
