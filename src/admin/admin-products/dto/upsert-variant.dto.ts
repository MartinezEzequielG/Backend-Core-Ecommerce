import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertVariantDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  imageId?: number | null;

  // ✅ AR URL
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  arUrl?: string | null;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  optionValueIds?: number[];
}