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
      checkoutMode: settings?.checkoutMode ?? 'CATALOG',
    }));
  }

  async update(body: {
    banners?: any[];
    socialLinks?: any[];
    whatsappNumber?: string;
    address?: string;
    logoUrl?: string;
    checkoutMode?: 'CATALOG' | 'CART';
    heroVideoUrl?: string;
    heroImageUrl?: string;
    heroMode?: 'video' | 'image' | 'none';
  }) {
    const cfg = await this.prisma.siteConfig.upsert({
      where: { id: 1 },
      update: {
        ...(body.banners ? { banners: body.banners } : {}),
        ...(body.socialLinks ? { socialLinks: body.socialLinks } : {}),
      },
      create: {
        id: 1,
        banners: body.banners ?? [],
        socialLinks: body.socialLinks ?? [],
      },
    });

    const existing = await this.prisma.storeSettings.findFirst();

    const settings = existing
      ? await this.prisma.storeSettings.update({
          where: { id: existing.id },
          data: {
            ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
            ...(body.whatsappNumber !== undefined ? { whatsappNumber: body.whatsappNumber } : {}),
            ...(body.address !== undefined ? { address: body.address } : {}),
            ...(body.checkoutMode !== undefined ? { checkoutMode: body.checkoutMode } : {}),
            ...(body.heroVideoUrl !== undefined ? { heroVideoUrl: body.heroVideoUrl } : {}),
            ...(body.heroImageUrl !== undefined ? { heroImageUrl: body.heroImageUrl } : {}),
            ...(body.heroMode !== undefined ? { heroMode: body.heroMode } : {}),
          },
        })
      : await this.prisma.storeSettings.create({
          data: {
            name: 'Store',
            logoUrl: body.logoUrl,
            whatsappNumber: body.whatsappNumber,
            address: body.address,
            checkoutMode: body.checkoutMode ?? 'CATALOG',
            heroVideoUrl: body.heroVideoUrl ?? '',
            heroImageUrl: body.heroImageUrl ?? '',
            heroMode: body.heroMode ?? 'video',
          } as any,
        });

    return {
      ...cfg,
      ...settings,
    };
  }
}