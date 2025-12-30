import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  sort?: string; // "price:asc" | "createdAt:desc"

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  limit?: number;
}