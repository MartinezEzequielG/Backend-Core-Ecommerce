import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaPromise } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminProductsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        basePrice: true,
        salePrice: true,
        active: true,
        featured: true,
        createdAt: true,
      },
    });
  }

  async byId(id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            options: { include: { optionValue: true } },
          },
        },
        options: { include: { values: true } },
        // ...otros includes...
      },
    });
    if (!p) return null;

    return {
      ...p,
      variants: (p.variants || []).map((v) => ({
        ...v,
        stock: v.onHand,
      })),
    };
  }

  create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data });
  }

  update(id: number, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: number) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Producto no encontrado');
    return this.prisma.product.delete({ where: { id } });
  }

  // Imágenes
  addImage(productId: number, url: string, position = 0) {
    return this.prisma.productImage.create({ data: { productId, url, position } });
  }

  reorderImages(productId: number, orders: { id: number; position: number }[]) {
    const tx: PrismaPromise<any>[] = orders.map(({ id, position }) =>
      this.prisma.productImage.update({ where: { id }, data: { position } }),
    );
    return this.prisma.$transaction(tx);
  }

  // Variantes
  upsertVariant(
    productId: number,
    data: {
      id?: number;
      sku?: string | null;
      price?: Prisma.Decimal | null;
      stock?: number;
      active?: boolean;
      optionValueIds?: number[];
    },
  ) {
    const { optionValueIds = [], ...rest } = data;
    console.log('upsertVariant backend', { optionValueIds }); // <--- agrega esto

    if (data.id) {
      return this.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.update({
          where: { id: data.id! },
          data: {
            sku: rest.sku ?? null,
            price: rest.price ?? null,
            onHand: rest.stock ?? 0, // <--- aquí debe mapear stock a onHand
            active: rest.active ?? true,
          },
        });

        await tx.productVariantOption.deleteMany({ where: { variantId: variant.id } });
        if (optionValueIds.length) {
          await tx.productVariantOption.createMany({
            data: optionValueIds.map((optionValueId) => ({
              variantId: variant.id,
              optionValueId,
            })),
          });
        }

        return variant;
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          sku: rest.sku ?? null,
          price: rest.price ?? null,
          onHand: rest.stock ?? 0, // <--- aquí debe mapear stock a onHand
          active: rest.active ?? true,
        },
      });

      if (optionValueIds.length) {
        await tx.productVariantOption.createMany({
          data: optionValueIds.map((optionValueId) => ({
            variantId: variant.id,
            optionValueId,
          })),
        });
      }

      return variant;
    });
  }

  async removeVariant(id: number) {
    // 1) Verificar existencia
    const exists = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Variante no encontrada');

    try {
      // 2) Borrar relaciones hijas primero (FK variantId)
      return await this.prisma.$transaction(async (tx) => {
        await tx.productVariantOption.deleteMany({ where: { variantId: id } });

        // Si tenés otras tablas que referencian variantId, borrarlas acá también.
        // Ej: await tx.someChildTable.deleteMany({ where: { variantId: id } });

        return tx.productVariant.delete({ where: { id } });
      });
    } catch (e: any) {
      // 3) Si sigue fallando, probablemente está referenciada por órdenes (no se debería borrar)
      // Prisma FK error => P2003
      if (e?.code === 'P2003') {
        // Fallback: desactivar y poner stock 0 (soft-delete)
        await this.prisma.productVariant.update({
          where: { id },
          data: { active: false, onHand: 0 }, // CAMBIO: stock -> onHand
        });
        throw new BadRequestException(
          'No se puede eliminar la variante porque está referenciada (por ejemplo, en una orden). Se desactivó y se puso stock en 0.',
        );
      }
      throw e;
    }
  }

  // Opciones
  addOption(productId: number, name: string) {
    return this.prisma.productOption.create({ data: { productId, name } });
  }

  addOptionValue(optionId: number, value: string) {
    return this.prisma.productOptionValue.create({ data: { optionId, value } });
  }

  removeOption(optionId: number) {
    return this.prisma.productOption.delete({ where: { id: optionId } });
  }

  removeOptionValue(optionValueId: number) {
    return this.prisma.productOptionValue.delete({ where: { id: optionValueId } });
  }

  listWithFilters(params: {
    search?: string;
    categoryId?: number;
    active?: boolean;
    inStock?: boolean;
    skip: number;
    take: number;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }) {
    const { search, categoryId, active, inStock, skip, take, orderBy } = params;

    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { slug: { contains: search } },
                { sku: { contains: search } },
              ],
            }
          : {},
        categoryId ? { categoryId } : {},
        active != null ? { active } : {},
        inStock != null
          ? inStock
            ? { OR: [{ variants: { some: { onHand: { gt: 0 }, active: true } } }, { featured: true }] }
            : { AND: [{ variants: { every: { onHand: { lte: 0 } } } }, { featured: false }] }
          : {},
      ],
    };

    return this.prisma.product
      .findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: { select: { id: true, name: true } },
          variants: { select: { onHand: true, active: true } }, // CAMBIO: stock -> onHand
        },
      })
      .then((items) =>
        items.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          basePrice: p.basePrice,
          salePrice: p.salePrice,
          active: p.active,
          featured: p.featured,
          createdAt: p.createdAt,
          category: p.category ? { id: p.category.id, name: p.category.name } : null,
          totalStock: (p.variants || []).reduce((s, v) => s + (v.onHand ?? 0), 0), // CAMBIO: v.stock -> v.onHand
        })),
      );
  }

  async generateVariants(productId: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { options: { include: { values: true } } },
      });
      if (!product) throw new NotFoundException('Producto no encontrado');

      if (!product.options.length) throw new BadRequestException('El producto no tiene atributos');

      // Solo opciones con al menos 1 valor
      const opts = product.options.filter((o) => (o.values || []).length > 0);
      if (!opts.length) throw new BadRequestException('Los atributos no tienen valores');

      const combinations: number[][] = [];
      const walk = (i: number, acc: number[]) => {
        if (i >= opts.length) return combinations.push(acc);
        for (const v of opts[i].values) walk(i + 1, [...acc, v.id]);
      };
      walk(0, []);

      // combos existentes
      const existing = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true, options: { select: { optionValueId: true } } },
      });
      const existingKeys = new Set(
        existing.map((v) => v.options.map((o) => o.optionValueId).sort((a, b) => a - b).join('-')),
      );

      let created = 0;

      for (const combo of combinations) {
        const key = [...combo].sort((a, b) => a - b).join('-');
        if (existingKeys.has(key)) continue;

        const variant = await tx.productVariant.create({
          data: {
            productId,
            sku: null,
            price: null,
            onHand: 0, // CAMBIO: stock -> onHand
            active: true,
          },
        });

        await tx.productVariantOption.createMany({
          data: combo.map((optionValueId) => ({ variantId: variant.id, optionValueId })),
        });

        created++;
      }

      return { created, totalCombinations: combinations.length };
    });
  }
}