import { Module } from '@nestjs/common';
import { AdminStoreSettingsController } from './admin-store-settings.controller';
import { AdminStoreSettingsService } from './admin-store-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AdminStoreSettingsController],
  providers: [AdminStoreSettingsService, PrismaService],
})
export class AdminStoreSettingsModule {}