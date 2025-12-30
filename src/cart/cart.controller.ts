import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, UseGuards, Req, Request as NestRequest } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

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
}