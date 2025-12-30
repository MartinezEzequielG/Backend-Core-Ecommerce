import { Transform } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString } from 'class-validator';

export class QueryAdminProductsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() categoryId?: number;
  @IsOptional() @IsBooleanString() active?: string; // 'true' | 'false'
  @IsOptional() @IsBooleanString() inStock?: string; // 'true' | 'false'
  @IsOptional() @IsString() sort?: string; // "createdAt:desc" | "basePrice:asc"
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() page?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() limit?: number;
}