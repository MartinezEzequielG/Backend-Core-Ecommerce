import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { PaginationDto, parseSort, toPagination } from '../shared/dto/pagination.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async list(@Query() q: QueryProductsDto & PaginationDto) {
    const { skip, take } = toPagination(q);
    const orderBy = parseSort(q.sort);
    return this.products.list({
      search: q.search,
      categorySlug: q.categorySlug,
      skip,
      take,
      orderBy: orderBy as any,
    });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.bySlug(slug);
  }
}