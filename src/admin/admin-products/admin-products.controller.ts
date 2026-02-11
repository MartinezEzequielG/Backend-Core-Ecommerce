import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QueryAdminProductsDto } from './dto/query-admin-products.dto';
import { toPagination, parseSort } from '../../shared/dto/pagination.dto';
import { Prisma, Role } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly service: AdminProductsService,
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================
  // LIST
  // =========================================================
  @Get()
  list(@Query() q: QueryAdminProductsDto) {
    const { skip, take } = toPagination({ page: q.page, limit: q.limit });
    const orderBy = parseSort(q.sort);
    const active = q.active != null ? q.active === 'true' : undefined;
    const inStock = q.inStock != null ? q.inStock === 'true' : undefined;

    return this.service.listWithFilters({
      search: q.search,
      categoryId: q.categoryId,
      active,
      inStock,
      skip,
      take,
      orderBy: orderBy as any,
    });
  }

  // =========================================================
  // GET PRODUCT FULL (ADMIN EDIT)
  // =========================================================
  @Get(':id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: {
          include: {
            image: true, // ✅ CLAVE: imagen asociada a variante
            options: { include: { optionValue: true } },
          },
          orderBy: { id: 'asc' },
        },
        options: { include: { values: true } },
      },
    });

    if (!p) return null;

    return {
      ...p,
      variants: (p.variants || []).map((v) => ({
        ...v,
        stock: v.onHand,
        imageUrl: v.image?.url ?? null, // ✅ Helper para front
      })),
    };
  }

  // =========================================================
  // CREATE PRODUCT
  // =========================================================
  @Post()
  create(
    @Body()
    dto: {
      name: string;
      slug: string;
      description?: string | null;
      sku?: string | null;
      basePrice: number;
      salePrice?: number | null;
      categoryId?: number | null;
      featured?: boolean;
      active?: boolean;
    },
  ) {
    return this.service.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      sku: dto.sku ?? null,
      basePrice: new Prisma.Decimal(dto.basePrice),
      salePrice: dto.salePrice != null ? new Prisma.Decimal(dto.salePrice) : null,
      featured: dto.featured ?? false,
      active: dto.active ?? true,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      images: { create: [] },
      options: { create: [] },
    } as any);
  }

  // =========================================================
  // UPDATE PRODUCT
  // =========================================================
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  // =========================================================
  // DELETE PRODUCT
  // =========================================================
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // =========================================================
  // IMAGES
  // =========================================================
  @Post(':id/images')
  addImage(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: { url: string; position?: number },
  ) {
    return this.service.addImage(productId, body.url, body.position ?? 0);
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: { orders?: { id: number; position: number }[]; order?: number[] },
  ) {
    const orders =
      body.orders && Array.isArray(body.orders)
        ? body.orders
        : (body.order || []).map((id, idx) => ({ id, position: idx }));

    return this.service.reorderImages(productId, orders);
  }

  // =========================================================
  // VARIANTS
  // =========================================================
  @Post(':id/variants')
  upsertVariant(
    @Param('id', ParseIntPipe) productId: number,
    @Body()
    body: {
      id?: number;
      sku?: string | null;
      price?: number | null;
      stock?: number;
      active?: boolean;
      optionValueIds?: number[];
      imageId?: number | null; // ✅ NUEVO
    },
  ) {
    return this.service.upsertVariant(productId, {
      id: body.id,
      sku: body.sku ?? null,
      price: body.price != null ? new Prisma.Decimal(body.price) : null,
      stock: body.stock ?? 0,
      active: body.active ?? true,
      optionValueIds: body.optionValueIds ?? [],
      imageId: body.imageId ?? null, // ✅ CLAVE
    });
  }

  @Delete('variants/:variantId')
  removeVariant(@Param('variantId', ParseIntPipe) variantId: number) {
    return this.service.removeVariant(variantId);
  }

  // =========================================================
  // OPTIONS
  // =========================================================
  @Post(':id/options')
  addOption(
    @Param('id', ParseIntPipe) productId: number,
    @Body() body: { name: string },
  ) {
    return this.service.addOption(productId, body.name);
  }

  @Post('options/:optionId/values')
  addOptionValue(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() body: { value: string },
  ) {
    return this.service.addOptionValue(optionId, body.value);
  }

  @Delete('options/:optionId')
  removeOption(@Param('optionId', ParseIntPipe) optionId: number) {
    return this.service.removeOption(optionId);
  }

  @Delete('option-values/:optionValueId')
  removeOptionValue(@Param('optionValueId', ParseIntPipe) optionValueId: number) {
    return this.service.removeOptionValue(optionValueId);
  }

  // =========================================================
  // EXPORT CSV
  // =========================================================
  @Get('export')
  async export(@Res() res: Response) {
    const items = await this.prisma.product.findMany({
      include: { variants: true, category: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'id',
      'name',
      'slug',
      'basePrice',
      'salePrice',
      'active',
      'featured',
      'category',
      'variantsCount',
      'createdAt',
    ];

    const rows = items.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.slug,
      p.basePrice,
      p.salePrice ?? '',
      p.active,
      p.featured,
      p.category?.name ?? '',
      p.variants.length,
      p.createdAt.toISOString(),
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send(csv);
  }

  // =========================================================
  // AUDIT
  // =========================================================
  @Post(':id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async addAudit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: string; details?: any },
  ) {
    return this.prisma.productAudit.create({
      data: {
        productId: id,
        action: body.action,
        details: body.details ?? {},
        createdAt: new Date(),
      },
    });
  }

  // =========================================================
  // GENERATE VARIANTS
  // =========================================================
  @Post(':id/variants/generate')
  generateVariants(@Param('id', ParseIntPipe) productId: number) {
    return this.service.generateVariants(productId);
  }
}
