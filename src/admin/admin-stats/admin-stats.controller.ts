import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary() {
    const [ordersToday, salesTodayAgg, users, productsActive] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }, status: { in: ['PAID','SHIPPED'] } },
      }),
      this.prisma.user.count(),
      this.prisma.product.count({ where: { active: true } }),
    ]);
    return {
      ordersToday,
      salesToday: Number(salesTodayAgg._sum.total ?? 0),
      users,
      productsActive,
    };
  }
}