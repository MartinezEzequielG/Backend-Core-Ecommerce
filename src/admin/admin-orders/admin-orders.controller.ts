import { Controller, Get, Patch, Query, Param, ParseIntPipe, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role, $Enums } from '@prisma/client';
import { toPagination, parseSort } from '../../shared/dto/pagination.dto';
import { Response } from 'express';
import type { Response as ResType } from 'express';
import { Res } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: { status?: string; from?: string; to?: string; page?: string; limit?: string; sort?: string }) {
    const { skip, take } = toPagination({ page: Number(q.page), limit: Number(q.limit) }); // fix tipos
    const orderBy = parseSort(q.sort) ?? { createdAt: 'desc' };
    const where: any = {};
    if (q.status) where.status = q.status as $Enums.OrderStatus;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(`${q.from}T00:00:00.000Z`);
      if (q.to) where.createdAt.lte = new Date(`${q.to}T23:59:59.999Z`);
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          userId: true,

          // ✅ para mostrar cliente
          user: { select: { id: true, name: true, email: true } },
          shippingAddress: { select: { fullName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        total: Number(i.total),
      })),
      total,
    };
  }

  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        shippingAddress: true,
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            productVariant: true,
          },
        },
      },
    });
    if (!o) return null;
    return {
      ...o,
      total: Number(o.total),
      shippingCost: Number(o.shippingCost),
      items: o.items.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        productVariant: it.productVariant
          ? {
              ...it.productVariant,
              price: it.productVariant.price ? Number(it.productVariant.price) : null,
            }
          : null,
      })),
    };
  }

  @Get('export')
  async export(@Res() res: ResType) {
    const orders = await this.prisma.order.findMany({
      include: { user: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    const header = ['id','status','total','createdAt','userEmail','itemsCount'];
    const rows = orders.map(o => [
      o.id,
      o.status,
      Number(o.total),
      o.createdAt.toISOString(),
      o.user?.email ?? '',
      o.items.length,
    ]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  }

  @Patch(':id/ship')
  async markShipped(@Param('id', ParseIntPipe) id: number, @Body() body: { trackingCode: string }) {
    return this.prisma.order.update({
      where: { id },
      data: { status: $Enums.OrderStatus.SHIPPED, shippedAt: new Date(), trackingCode: body.trackingCode },
    });
  }

  @Patch(':id/deliver')
  async markDelivered(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.order.update({
      where: { id },
      data: { status: $Enums.OrderStatus.DELIVERED, deliveredAt: new Date() },
    });
  }

  @Patch(':id')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    // opcional: si querés forzar SHIPPED sólo via /ship, descomentá:
    // if (dto.status === 'SHIPPED') throw new BadRequestException('Usá /ship para marcar como enviado');

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, status: true, updatedAt: true },
    });

    return updated;
  }
}