import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminStatsController } from './admin-stats.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminStatsController],
})
export class AdminStatsModule {}