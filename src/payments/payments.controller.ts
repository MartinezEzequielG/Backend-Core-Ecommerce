import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifySignatureMP } from './signature';
import { MercadoPagoService } from './mercadopago/mercadopago.service';
import { MP_PROVIDER } from './mercadopago/mercadopago.constants';
import { CreatePreferenceDto } from './dto/create-preference.dto';

const SECRET = process.env.MP_WEBHOOK_SECRET || 'dev-secret';

function extractPaymentId(event: any): string | null {
  const id =
    event?.data?.id ??
    event?.id ??
    event?.payment_id ??
    (typeof event?.resource === 'string' ? event.resource.split('/').pop() : null);
  return id ? String(id) : null;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoService,
  ) {}

  @Post('preference')
  @HttpCode(200)
  async preference(@Req() req: any, @Body() body: CreatePreferenceDto) {
    const orderId = Number(body.orderId);
    const guestSessionToken =
      (req.headers?.['x-session-id'] as string) || (req.cookies?.sid as string) || undefined;
    const userId = req.user?.id ? Number(req.user.id) : undefined;

    return this.mp.createPreferenceForOrder({ orderId, userId, guestSessionToken });
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: any, @Res() res: any) {
    const raw =
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {});

    let event: any = null;
    try {
      event = JSON.parse(raw);
    } catch {
      event = { raw };
    }

    let status: 'applied' | 'duplicate' | 'ignored' | 'invalid_signature' | 'error' = 'ignored';
    let orderId: number | null = null;
    let externalRef: string | null = null;

    if (!verifySignatureMP(req, SECRET, raw)) {
      status = 'invalid_signature';
      await this.prisma.paymentEvent.create({
        data: { provider: MP_PROVIDER, externalRef: '', orderId: null, payload: event, status },
      });
      return res.send('OK');
    }

    try {
      const type = String(event?.type || event?.topic || '');

      if (type !== 'payment') {
        status = 'ignored';
      } else {
        const paymentId = extractPaymentId(event);
        if (!paymentId) {
          status = 'ignored';
        } else {
          const payment = await this.mp.getPayment(paymentId);
          externalRef = String(payment.id);

          const er = String(payment.external_reference || '');
          const m = /^order:(\d+)$/.exec(er);
          if (m) orderId = Number(m[1]);

          const approved = String(payment.status || '').toLowerCase() === 'approved';
          if (orderId && approved) {
            const result = await this.orders.markOrderPaid(orderId, {
              externalRef,
              paymentMethod: 'MERCADOPAGO',
            });
            status = result?.status === 'PAID' ? 'applied' : 'duplicate';
          } else {
            status = 'ignored';
          }
        }
      }
    } catch {
      status = 'error';
    }

    await this.prisma.paymentEvent.create({
      data: { provider: MP_PROVIDER, externalRef: externalRef || '', orderId, payload: event, status },
    });

    return res.send('OK');
  }

  @Get('return/:result/:orderId')
  async mpReturn(
    @Param('result') result: string,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query() q: any,
    @Res() res: any,
  ) {
    const storeBase =
      process.env.STORE_LOCAL_URL ||
      process.env.STORE_PUBLIC_URL ||
      'http://localhost:3002';

    const paymentId = String(q?.payment_id || q?.collection_id || '');
    const status = String(q?.status || q?.collection_status || '');

    // DEV: confirmación best-effort aunque webhook falle
    if (paymentId) {
      try {
        const payment = await this.mp.getPayment(paymentId);
        const approved = String(payment.status || '').toLowerCase() === 'approved';
        if (approved) {
          await this.orders.markOrderPaid(orderId, {
            externalRef: String(payment.id),
            paymentMethod: 'MERCADOPAGO',
          });
        }
      } catch {
        // no bloquear redirect
      }
    }

    const url = new URL(`/orders/${orderId}`, storeBase.replace(/\/+$/, ''));
    url.searchParams.set('mp', result);
    if (paymentId) url.searchParams.set('payment_id', paymentId);
    if (status) url.searchParams.set('status', status);

    return res.redirect(302, url.toString());
  }
}
