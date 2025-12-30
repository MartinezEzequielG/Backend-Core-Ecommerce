import { Controller, Get, Param, ParseIntPipe, Patch, Body, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  @Patch(':id/role')
  async updateRole(@Param('id', ParseIntPipe) id: number, @Body() body: { role: Role }) {
    return this.prisma.user.update({ where: { id }, data: { role: body.role } });
  }

  @Get('export')
  async export(@Res() res: Response) {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const header = ['id','email','role','createdAt'];
    const rows = users.map(u => [u.id, u.email, u.role, u.createdAt.toISOString()]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  }
}