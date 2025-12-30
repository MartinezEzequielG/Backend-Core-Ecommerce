import { Module } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminOrdersController],
})
export class AdminOrdersModule {}