import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPagination, parseSort } from '../../shared/dto/pagination.dto';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: any) {
    const { skip, take } = toPagination({ page: q.page, limit: q.limit });
    const orderBy = parseSort(q.sort) ?? { createdAt: 'desc' };
    return this.prisma.coupon.findMany({ skip, take, orderBy });
  }

  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.coupon.findUnique({ where: { id } });
  }

  @Post()
  async create(@Body() body: { code: string; type: 'PERCENT' | 'FIXED'; value: number; active?: boolean; expiresAt?: Date }) {
    return this.prisma.coupon.create({ data: { ...body, active: body.active ?? true } });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<{ code: string; type: 'PERCENT' | 'FIXED'; value: number; active: boolean; expiresAt: Date }>) {
    return this.prisma.coupon.update({ where: { id }, data: body });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  @Get('export')
  async export(@Res() res: Response) {
    const list = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    const header = ['id','code','type','value','active','expiresAt','createdAt'];
    const rows = list.map(c => [
      c.id,
      `"${c.code.replace(/"/g,'""')}"`,
      c.type,
      c.value,
      c.active,
      c.expiresAt ? c.expiresAt.toISOString() : '',
      c.createdAt.toISOString(),
    ]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="coupons.csv"');
    res.send(csv);
  }
}