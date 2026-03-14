import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const money = (d: any) => (d == null ? d : Number(d));

function mapProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    basePrice: money(p.basePrice),
    salePrice: money(p.salePrice),
    sku: p.sku ?? null,
    active: !!p.active,
    featured: !!p.featured,

    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,

    images: (p.images || []).map((im: any) => ({
      id: im.id,
      url: im.url,
      position: im.position ?? null,
    })),

    options: (p.options || []).map((opt: any) => ({
      id: opt.id,
      name: opt.name,
      values: (opt.values || []).map((v: any) => ({
        id: v.id,
        value: v.value,
      })),
    })),

    variants: (p.variants || []).map((v: any) => ({
      id: v.id,
      sku: v.sku ?? null,
      price: money(v.price),
      active: v.active ?? true,
      imageId: v.imageId ?? null,
      imageUrl: v.image?.url ?? null,
      arUrl: v.arUrl ?? null,
      stock: {
        available: Math.max(0, Number(v.onHand ?? 0) - Number(v.reserved ?? 0)),
        onHand: Number(v.onHand ?? 0),
        reserved: Number(v.reserved ?? 0),
      },
      options: (v.options || []).map((vo: any) => ({
        id: vo.id,
        optionValue: vo.optionValue ? { id: vo.optionValue.id, value: vo.optionValue.value } : null,
      })),
    })),

    discountTransfer: p.discountTransfer ?? null,
    discountMp: p.discountMp ?? null,
    isNew: !!p.isNew,
    isHot: !!p.isHot,
    freeShipping: !!p.freeShipping,
    arUrl: p.arUrl ?? null,
  };
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    search?: string;
    categorySlug?: string;
    skip: number;
    take: number;
    orderBy?: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  }) {
    const { search, categorySlug, skip, take } = params;

    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { slug: { contains: search } },
              ],
            }
          : {},
        categorySlug ? { category: { is: { slug: categorySlug } } } : {},
        { active: true },
      ],
    };

    const defaultOrderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { featured: 'desc' },
      { isHot: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

    const orderBy = params.orderBy ?? defaultOrderBy;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 },
          variants: {
            where: { active: true },
            include: {
              image: true,
              options: { include: { optionValue: true } },
            },
            orderBy: { id: 'asc' },
          },
          category: { select: { id: true, name: true, slug: true } },
          options: { include: { values: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map(mapProduct), total };
  }

  async bySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { position: 'asc' } },
        category: true,
        options: { include: { values: true } },
        variants: {
          where: { active: true },
          include: {
            image: true,
            options: { include: { optionValue: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    return mapProduct(product);
  }
}
