import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSiteService {
  constructor(private prisma: PrismaService) {}

  get() {
    return Promise.all([
      this.prisma.siteConfig.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, banners: [], socialLinks: [] },
      }),
      this.prisma.storeSettings.findFirst(),
    ]).then(([cfg, settings]) => ({
      ...cfg,
      logoUrl: settings?.logoUrl ?? null,
      whatsappNumber: settings?.whatsappNumber ?? '',
      address: settings?.address ?? '',
    }));
  }

  update(body: { banners?: any[]; socialLinks?: any[]; whatsappNumber?: string; address?: string; logoUrl?: string }) {
    return Promise.all([
      this.prisma.siteConfig.update({
        where: { id: 1 },
        data: {
          banners: body.banners ?? [],
          socialLinks: body.socialLinks ?? [],
        },
      }),
      this.prisma.storeSettings.updateMany({
        data: {
          logoUrl: body.logoUrl ?? null,
          whatsappNumber: body.whatsappNumber ?? '',
          address: body.address ?? '',
        },
      }),
    ]).then(([cfg]) => cfg);
  }
}