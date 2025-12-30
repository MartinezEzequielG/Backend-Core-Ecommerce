import { Controller, Post, Req, Res, HttpCode } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifySignatureMP } from './signature';

const PROVIDER = 'mercadopago'; // o el que uses
const SECRET = process.env.MP_WEBHOOK_SECRET || 'dev-secret';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req, @Res() res) {
    const event = req.body;
    let status = 'applied';
    let orderId = event.orderId;
    let externalRef = event.externalRef;

    // 1. Validar firma
    if (!verifySignatureMP(req, SECRET)) {
      status = 'invalid_signature';
      await this.prisma.paymentEvent.create({
        data: {
          provider: PROVIDER,
          externalRef: externalRef || '',
          orderId,
          payload: event,
          status,
        },
      });
      return res.send('OK');
    }

    // 2. Procesar evento
    try {
      if (orderId && externalRef) {
        const result = await this.orders.markOrderPaid(orderId, { externalRef, paymentMethod: event.paymentMethod });
        status = result?.status === 'PAID' ? 'applied' : 'duplicate';
      } else {
        status = 'ignored';
      }
    } catch (e) {
      status = 'error';
    }

    // 3. Loguear evento
    await this.prisma.paymentEvent.create({
      data: {
        provider: PROVIDER,
        externalRef: externalRef || '',
        orderId,
        payload: event,
        status,
      },
    });

    return res.send('OK');
  }
}