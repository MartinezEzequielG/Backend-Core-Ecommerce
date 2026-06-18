import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, UseGuards, Req, Request as NestRequest } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService, private readonly prisma: PrismaService) {}

  @Get()
  async get(@Headers('x-session-id') sessionToken: string | undefined, @Req() req: Request) {
    const userId = (req as any).user?.id as number | undefined;
    return this.cartService.getCurrent({ userId, sessionToken });
  }

  @Post('items')
  addItem(
    @Req() req: Request,
    @Body() body: { productId: number; variantId?: number; quantity?: number },
  ) {
    const userId = (req as any).user?.id as number | undefined;
    const sessionToken =
      (req.headers['x-session-id'] as string) ||
      ((req as any).cookies?.sid as string) ||
      undefined;
    return this.cartService.addItem({
      userId,
      sessionToken,
      productId: body.productId,
      variantId: body.variantId,
      quantity: body.quantity ?? 1,
    });
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { quantity: number },
  ) {
    // quantity simple; validaciones en service
    return this.cartService.updateItemQuantity(id, body.quantity);
  }

  @Delete('items/:id')
  removeItem(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.cartService.removeItem(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('merge')
  async merge(@Headers('x-session-id') sessionToken: string | undefined, @Req() req: Request) {
    if (!sessionToken) return { merged: false };
    await this.cartService.mergeSessionIntoUser(String(sessionToken), Number((req as any).user.id));
    return { merged: true };
  }

  @Post('apply-coupon')
  async applyCoupon(@Body() body: { code: string; items: Array<{ productId: number; qty?: number; quantity?: number; price: number }> }) {
    const { code, items } = body;
    if (!code) return { valid: false, message: 'Código requerido' };

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        active: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!coupon) return { valid: false, message: 'Cupón inválido o vencido' };

    // Calcular subtotal
    const subtotal = items.reduce((sum, item) => {
      const quantity = item.qty ?? item.quantity ?? 1;
      return sum + Number(item.price) * quantity;
    }, 0);

    let discount = 0;
    if (coupon.type === 'PERCENT') {
      discount = Math.round((subtotal * Number(coupon.value)) / 100);
    } else if (coupon.type === 'FIXED') {
      discount = Math.min(subtotal, Number(coupon.value));
    }

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      subtotal,
      total: subtotal - discount,
      message: `Cupón aplicado: -$${discount}`,
    };
  }
}