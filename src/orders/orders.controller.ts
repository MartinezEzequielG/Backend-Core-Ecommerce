import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UnauthorizedException, Patch } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { MarkOrderPaidDto } from './dto/mark-order-paid.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // (opcional) Legacy endpoint: podés eliminarlo si el frontend ya no lo usa
  @Post()
  async create(
    @Req() req: ExpressRequest,
    @Body()
    body: {
      shipping: { fullName: string; phone: string; street: string; city: string; state: string; zip?: string; country?: string };
      shippingCost: number;
      paymentMethod?: string;
      sessionToken?: string;
    },
  ) {
    const userId = (req as any).user?.id as number | undefined;
    const guestSessionToken =
      body.sessionToken ||
      (req.headers['x-session-id'] as string) ||
      ((req as any).cookies?.sid as string) ||
      undefined;

    if (!userId && !guestSessionToken) throw new UnauthorizedException('Missing identity');

    // Genera un token único (no idempotente)
    const checkoutToken = 'LEGACY_' + Date.now();

    return this.orders.createCheckout({
      userId,
      guestSessionToken,
      checkoutToken,
      shipping: body.shipping,
      shippingCost: body.shippingCost,
      paymentMethod: body.paymentMethod,
    });
  }

  // Orden pública para guest (valida sid)
  @Get('public/:id')
  async getPublic(@Req() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const sessionToken =
      (req.headers['x-session-id'] as string) ||
      ((req as any).cookies?.sid as string) ||
      undefined;

    if (!sessionToken) throw new UnauthorizedException('Missing session');

    // Implementa este método en tu service o eliminá este endpoint si no lo usás
    return this.orders.getByIdPublic?.(id, sessionToken);
  }

  // Orden privada para usuario logueado
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    // Implementa este método en tu service o eliminá este endpoint si no lo usás
    return this.orders.getById?.(id);
  }

  // Checkout idempotente y seguro
  @Post('checkout')
  async checkout(@Body() dto: CreateCheckoutDto, @Req() req: ExpressRequest) {
    const userId = (req as any).user?.id as number | undefined;
    const guestSessionToken =
      dto.guestSessionToken ||
      (req.headers['x-session-id'] as string) ||
      ((req as any).cookies?.sid as string) ||
      undefined;

    if (!userId && !guestSessionToken) throw new UnauthorizedException('Missing identity');

    if (!dto.checkoutToken) throw new UnauthorizedException('checkoutToken requerido');

    return this.orders.createCheckout({
      userId,
      guestSessionToken,
      checkoutToken: dto.checkoutToken,
      shipping: dto.shipping,
      shippingCost: dto.shippingCost,
      paymentMethod: dto.paymentMethod,
    });
  }

  @Patch(':id/paid')
  async markPaid(@Param('id', ParseIntPipe) id: number, @Body() dto: MarkOrderPaidDto) {
    return this.orders.markOrderPaid(id, dto);
  }
}