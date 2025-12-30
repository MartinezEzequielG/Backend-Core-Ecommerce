import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSiteService {
  constructor(private prisma: PrismaService) {}

  get() {
    return this.prisma.siteConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, banners: [], socialLinks: [] },
    });
  }

  update(body: { banners?: any[]; socialLinks?: any[] }) {
    return this.prisma.siteConfig.update({
      where: { id: 1 },
      data: {
        banners: body.banners ?? [],
        socialLinks: body.socialLinks ?? [],
      },
    });
  }
}