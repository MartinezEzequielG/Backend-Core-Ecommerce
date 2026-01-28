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

    const settings = await this.prisma.storeSettings.findFirst();

    return {
      ...cfg,
      logoUrl: settings?.logoUrl ?? null,
      whatsappNumber: settings?.whatsappNumber ?? '',
      address: settings?.address ?? '',
      checkoutMode: settings?.checkoutMode ?? 'CATALOG',
      heroVideoUrl: settings?.heroVideoUrl ?? '',
      heroImageUrl: settings?.heroImageUrl ?? '',
      heroMode: settings?.heroMode ?? 'video',
    };
  }
}