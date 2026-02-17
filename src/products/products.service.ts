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
    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,

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

    // ⬇ Variantes con imagen + stock + valores de opción
    variants: (p.variants || []).map((v: any) => ({
      // ⚠️ Importante: si devolvés todo el objeto v, viene pesado (incluye relaciones).
      // Igual lo dejo porque ya lo tenías así; si querés lo “adelgazamos”.
      ...v,

      // ✅ claves para el STORE
      imageId: v.imageId ?? null,
      imageUrl: v.image?.url ?? null,

      // ✅ stock normalizado (nuevo modelo)
      stock: {
        available: Math.max(0, Number(v.onHand ?? 0) - Number(v.reserved ?? 0)),
        onHand: Number(v.onHand ?? 0),
        reserved: Number(v.reserved ?? 0),
      },

      // ✅ opciones de la variante (para matchear combinación en el selector)
      options: (v.options || []).map((vo: any) => ({
        id: vo.id,
        optionValue: vo.optionValue ? { id: vo.optionValue.id, value: vo.optionValue.value } : null,
      })),
    })),

    // ⬇ Campos extra para el detalle (precios y badges)
    discountTransfer: p.discountTransfer,
    discountMp: p.discountMp,
    isNew: p.isNew,
    isHot: p.isHot,
    freeShipping: p.freeShipping,
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

          // ✅ IMPORTANTE: si querés que el listado ya tenga imageUrl/opciones por variante,
          // tenés que incluir image + options.optionValue.
          variants: {
            where: { active: true },
            include: {
              image: true,
              options: { include: { optionValue: true } },
            },
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
            image: true, // ✅ para imageUrl
            options: { include: { optionValue: true } }, // ✅ para matchear combinación
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    // ✅ ACÁ ESTABA EL BUG: estabas devolviendo el prisma raw.
    // El store necesita imageUrl/stock/options normalizados:
    return mapProduct(product);
  }
}
