import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const money = (d: any) => (d == null ? d : Number(d));

function mapProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    basePrice: money(p.basePrice),
    salePrice: money(p.salePrice),
    sku: p.sku,
    active: p.active,
    featured: p.featured,
    category: p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
      : null,
    images: (p.images || []).map((im: any) => ({
      id: im.id,
      url: im.url,
      position: im.position,
    })),
    // ⬇ Atributos visibles en la tienda
    options: (p.options || []).map((opt: any) => ({
      id: opt.id,
      name: opt.name,
      values: (opt.values || []).map((v: any) => ({
        id: v.id,
        value: v.value,
      })),
    })),
    // ⬇ Variantes con sus valores de opción
    variants: (p.variants || []).map((v: any) => ({
      ...v,
      stock: {
        available: Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)),
        onHand: v.onHand ?? 0,
        reserved: v.reserved ?? 0,
      },
      options: (v.options || []).map((vo: any) => ({
        id: vo.id,
        optionValue: vo.optionValue
          ? { id: vo.optionValue.id, value: vo.optionValue.value }
          : null,
      })),
    })),
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
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }) {
    const { search, categorySlug, skip, take, orderBy } = params;

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

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: orderBy ?? { createdAt: 'desc' },
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 },
          variants: { where: { active: true } },
          category: { select: { id: true, name: true, slug: true } },
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
        options: { include: { values: true } },
        variants: {
          where: { active: true },
          include: {
            options: {
              include: {
                optionValue: true, // valor de atributo, ej "Rojo", "M"
              },
            },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return mapProduct(product);
  }
}