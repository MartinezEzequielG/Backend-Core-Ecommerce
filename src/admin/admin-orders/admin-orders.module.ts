import { Module } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrdersModule } from '../../orders/orders.module';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [AdminOrdersController],
})
export class AdminOrdersModule {}