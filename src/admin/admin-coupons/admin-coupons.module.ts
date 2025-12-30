import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminCouponsController } from './admin-coupons.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCouponsController],
})
export class AdminCouponsModule {}