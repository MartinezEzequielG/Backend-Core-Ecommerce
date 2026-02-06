import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadoPagoService } from './mercadopago/mercadopago.service';

@Module({
  imports: [OrdersModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoService],
})
export class PaymentsModule {}