import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private async ensureSessionCart(sessionToken: string) {
    const cart = await this.prisma.cart.upsert({
      where: { sessionToken },
      update: {},
      create: { sessionToken },
    });
    return cart;
  }

  private async ensureUserCart(userId: number) {
    return this.prisma.cart.upsert({
      where: { userId }, // ✅ solo la propiedad única
      update: {},
      create: { userId },
    });
  }

  async getCurrent(params: { userId?: number; sessionToken?: string }) {
    const cart = params.userId
      ? await this.ensureUserCart(params.userId)
      : await this.ensureSessionCart(String(params.sessionToken));

    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: { select: { url: true, position: true }, orderBy: { position: 'asc' } },
          },
        },
        productVariant: {
          select: {
            id: true,
            sku: true,
            price: true,
            onHand: true,
            reserved: true,
            options: {
              select: {
                optionValue: {
                  select: {
                    id: true,
                    value: true,
                    product: { select: { name: true } }, // nombre del atributo
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return {
      id: cart.id,
      items: items.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        productVariant: it.productVariant
          ? {
              ...it.productVariant,
              price: it.productVariant.price ? Number(it.productVariant.price) : null,
              onHand: it.productVariant.onHand,
              reserved: it.productVariant.reserved,
            }
          : null,
      })),
    };
  }

  async addItem(params: {
    userId?: number;
    sessionToken?: string;
    productId: number;
    variantId?: number;
    quantity: number;
  }) {
    if (!params.userId && !params.sessionToken) throw new BadRequestException('Missing identity');
    if (params.quantity < 1) throw new BadRequestException('Quantity must be >= 1');

    const variantsCount = await this.prisma.productVariant.count({
      where: { productId: params.productId, active: true },
    });
    if (variantsCount > 0 && !params.variantId) {
      throw new BadRequestException('Debes seleccionar una variante');
    }

    return this.prisma.$transaction(async (tx) => {
      let cartId: number;

      if (params.userId) {
        const cart = await tx.cart.upsert({
          where: { userId: params.userId }, // ✅ solo la propiedad única
          update: {},
          create: { userId: params.userId },
        });
        await tx.$queryRaw(Prisma.sql`SELECT id FROM Cart WHERE id = ${cart.id} FOR UPDATE`);
        cartId = cart.id;
      } else {
        const cart = await tx.cart.upsert({
          where: { sessionToken: String(params.sessionToken) },
          update: {},
          create: { sessionToken: String(params.sessionToken) },
        });
        await tx.$queryRaw(Prisma.sql`SELECT id FROM Cart WHERE id = ${cart.id} FOR UPDATE`);
        cartId = cart.id;
      }

      const product = await tx.product.findUnique({
        where: { id: params.productId },
        select: { id: true, active: true, salePrice: true, basePrice: true },
      });
      if (!product || !product.active) throw new NotFoundException('Producto no disponible');

      let unitPrice = product.salePrice ?? product.basePrice;

      if (params.variantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: params.variantId },
          select: { id: true, active: true, onHand: true, reserved: true, price: true },
        });
        if (!variant || !variant.active) throw new NotFoundException('Variante no disponible');
        if (variant.onHand < params.quantity) throw new BadRequestException('Stock insuficiente');
        unitPrice = variant.price ?? unitPrice;
      }

      await tx.$queryRaw(Prisma.sql`SELECT id FROM CartItem WHERE cartId = ${cartId} FOR UPDATE`);

      const updated = await tx.cartItem.updateMany({
        where: {
          cartId,
          productId: params.productId,
          productVariantId: params.variantId ?? null,
        },
        data: { quantity: { increment: params.quantity }, unitPrice },
      });

      if (updated.count === 0) {
        return tx.cartItem.create({
          data: {
            cartId,
            productId: params.productId,
            productVariantId: params.variantId ?? null,
            quantity: params.quantity,
            unitPrice,
          },
        });
      }

      return tx.cartItem.findFirst({
        where: {
          cartId,
          productId: params.productId,
          productVariantId: params.variantId ?? null,
        },
      });
    });
  }

  async updateItemQuantity(itemId: number, quantity: number) {
    if (quantity < 1) throw new BadRequestException('Quantity must be >= 1');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Item no encontrado');

      if (item.productVariantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId },
          select: { id: true, active: true, onHand: true, reserved: true, price: true },
        });
        if (!variant || !variant.active || (variant.onHand - variant.reserved) < quantity) {
          throw new BadRequestException('Stock insuficiente');
        }
      }

      return tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
    });
  }

  async removeItem(itemId: number) {
    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async mergeSessionIntoUser(sessionToken: string, userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const sessionRows = await tx.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM Cart WHERE sessionToken = ${sessionToken} LIMIT 1 FOR UPDATE`,
      );
      if (sessionRows.length === 0) return;

      const sessionCartId = sessionRows[0].id;
      const userCart = await tx.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      await tx.$queryRaw(Prisma.sql`SELECT id FROM Cart WHERE id = ${userCart.id} FOR UPDATE`);
      const userCartId = userCart.id;

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM CartItem WHERE cartId IN (${sessionCartId}, ${userCartId}) FOR UPDATE`,
      );

      const [sessionItems, userItems] = await Promise.all([
        tx.cartItem.findMany({ where: { cartId: sessionCartId } }),
        tx.cartItem.findMany({ where: { cartId: userCartId } }),
      ]);

      const userMap = new Map<string, { id: number; quantity: number }>();
      for (const it of userItems) {
        userMap.set(`${it.productId}:${it.productVariantId ?? 'null'}`, { id: it.id, quantity: it.quantity });
      }

      const createData: Prisma.CartItemCreateManyInput[] = [];

      for (const it of sessionItems) {
        const key = `${it.productId}:${it.productVariantId ?? 'null'}`;
        const existing = userMap.get(key);

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + it.quantity, unitPrice: it.unitPrice },
          });
        } else {
          createData.push({
            cartId: userCartId,
            productId: it.productId,
            productVariantId: it.productVariantId ?? null,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          });
        }
      }

      if (createData.length > 0) {
        await tx.cartItem.createMany({ data: createData });
      }

      await tx.cartItem.deleteMany({ where: { cartId: sessionCartId } });
      await tx.cart.delete({ where: { id: sessionCartId } });
    });
  }
}



