import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  async getSite() {
    const cfg = await this.prisma.siteConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, banners: [], socialLinks: [] },
    });
    return cfg;
  }
}