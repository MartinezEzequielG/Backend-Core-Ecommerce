import { Module } from '@nestjs/common';
import { AdminSiteController } from './admin-site.controller';
import { AdminSiteService } from './admin-site.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AdminSiteController],
  providers: [AdminSiteService, PrismaService],
})
export class AdminSiteModule {}