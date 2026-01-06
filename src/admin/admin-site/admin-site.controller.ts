import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminSiteService } from './admin-site.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/site')
export class AdminSiteController {
  constructor(private readonly service: AdminSiteService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  update(
    @Body()
    body: {
      banners?: any[];
      socialLinks?: any[];
      whatsappNumber?: string;
      address?: string;
      logoUrl?: string;
      // ✅ agregar
      checkoutMode?: 'CATALOG' | 'CART';
    },
  ) {
    return this.service.update(body);
  }
}