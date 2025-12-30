import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateCheckoutDto = {
  checkoutToken: string;
  guestSessionToken?: string;
  shipping: { fullName: string; email?: string; phone: string; street: string; city: string; state: string; zip?: string; country?: string };
  shippingCost: number;
  paymentMethod?: string;
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createCheckout(dto: CreateCheckoutDto & { userId?: number; guestSessionToken?: string; ttlMinutes?: number }) {
    const Decimal = Prisma.Decimal;

    const ttl = dto.ttlMinutes ?? 20;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    if (!dto.checkoutToken) throw new BadRequestException('checkoutToken requerido.');

    return this.prisma.$transaction(async (tx) => {
      // 1) Idempotencia
      const existing = await tx.order.findUnique({
        where: { checkoutToken: dto.checkoutToken },
        include: {
          items: { include: { product: true, productVariant: true } },
          shippingAddress: true,
          reservation: { include: { items: true } },
        },
      });
      if (existing) return existing;

      // 2) Encontrar y bloquear carrito
      const cartRows = dto.userId
        ? await tx.$queryRaw<{ id: number }[]>(
            Prisma.sql`SELECT id FROM Cart WHERE userId = ${dto.userId} LIMIT 1 FOR UPDATE`,
          )
        : await tx.$queryRaw<{ id: number }[]>(
            Prisma.sql`SELECT id FROM Cart WHERE sessionToken = ${String(dto.guestSessionToken)} LIMIT 1 FOR UPDATE`,
          );

      if (cartRows.length === 0) throw new NotFoundException('Carrito no encontrado');

      const cartId = cartRows[0].id;

      // Lock de items del carrito
      await tx.$queryRaw(Prisma.sql`SELECT id FROM CartItem WHERE cartId = ${cartId} FOR UPDATE`);

      const items = await tx.cartItem.findMany({
        where: { cartId },
        include: { product: true, productVariant: true },
      });

      if (items.length === 0) throw new BadRequestException('Carrito vacío');

      // 3) Validaciones + cálculo total + construir order items
      let subtotal = new Decimal(0);

      const orderItemsData = items.map((it) => {
        if (!it.product.active) throw new BadRequestException('Producto no disponible');
        if (!it.productVariantId) throw new BadRequestException('Item sin variante. Requiere variantId.');

        const unitPrice = it.productVariant?.price ?? it.product.salePrice ?? it.product.basePrice;
        subtotal = subtotal.add(new Decimal(unitPrice).mul(it.quantity));

        return {
          productId: it.productId,
          productVariantId: it.productVariantId,
          quantity: it.quantity,
          unitPrice: unitPrice,
        };
      });

      const shippingCost = new Decimal(dto.shippingCost || 0);
      const total = subtotal.add(shippingCost);

      // 4) Crear Order (pendiente pago) + address + items
      const order = await tx.order.create({
        data: {
          userId: dto.userId ?? null,
          guestSessionToken: dto.userId ? null : (dto.guestSessionToken ?? null),
          checkoutToken: dto.checkoutToken,
          status: 'PENDING_PAYMENT',
          total: total,
          shippingCost: shippingCost,
          paymentMethod: dto.paymentMethod ?? null,
          reservedUntil: expiresAt,
          items: { create: orderItemsData },
          shippingAddress: {
            create: {
              fullName: dto.shipping.fullName,
              email: dto.shipping.email ?? null,
              phone: dto.shipping.phone,
              street: dto.shipping.street,
              city: dto.shipping.city,
              state: dto.shipping.state,
              zip: dto.shipping.zip ?? null,
              country: dto.shipping.country ?? 'Argentina',
            },
          },
        },
        include: { items: true, shippingAddress: true },
      });

      // 5) Reservar stock (ATÓMICO)
      for (const it of orderItemsData) {
        const affected = await tx.$executeRaw`
          UPDATE ProductVariant
          SET reserved = reserved + ${it.quantity}
          WHERE id = ${it.productVariantId}
            AND active = true
            AND (onHand - reserved) >= ${it.quantity}
        `;

        if (affected !== 1) {
          throw new ConflictException('Stock insuficiente en variante');
        }
      }

      // 6) Crear StockReservation + items
      await tx.stockReservation.create({
        data: {
          orderId: order.id,
          userId: dto.userId ?? null,
          guestSessionToken: dto.userId ? null : (dto.guestSessionToken ?? null),
          status: 'ACTIVE',
          expiresAt,
          items: {
            create: orderItemsData.map((it) => ({
              variantId: it.productVariantId!,
              quantity: it.quantity,
            })),
          },
        },
      });

      // 7) Vaciar carrito (opcional)
      await tx.cartItem.deleteMany({ where: { cartId } });

      return order;
    });
  }

  async getById(id: number) {
    // Implementa la lógica o elimina la llamada si no se usa
  }

  async getByIdPublic(id: number, sessionToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, images: true } },
            productVariant: true,
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.guestSessionToken !== sessionToken) throw new UnauthorizedException('No autorizado');

    return {
      ...order,
      total: Number(order.total),
      shippingCost: Number(order.shippingCost),
      items: order.items.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        productVariant: it.productVariant
          ? {
              ...it.productVariant,
            }
          : null,
      })),
    };
  }

  async markOrderPaid(orderId: number, dto: { externalRef: string; paymentMethod?: string }) {
    if (!dto.externalRef) throw new BadRequestException('externalRef requerido');

    return this.prisma.$transaction(async (tx) => {
      // 1) Buscar la orden y la reserva activa
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { reservation: { include: { items: true } } },
      });
      if (!order) throw new NotFoundException('Orden no encontrada');
      if (order.status !== 'PENDING_PAYMENT') return order;
      if (order.externalRef) return order; // idempotencia

      // 2) Consumir la reserva: descontar onHand y restar reserved
      for (const it of order.reservation?.items || []) {
        const affected = await tx.$executeRaw`
          UPDATE ProductVariant
          SET onHand = onHand - ${it.quantity}, reserved = reserved - ${it.quantity}
          WHERE id = ${it.variantId} AND reserved >= ${it.quantity}
        `;
        if (affected !== 1) throw new ConflictException('Error al consumir stock');
      }

      // 3) Actualizar estado de la orden y registrar externalRef
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          externalRef: dto.externalRef,
          paymentMethod: dto.paymentMethod ?? order.paymentMethod,
          paidAt: new Date(),
        },
      });
    });
  }
}


