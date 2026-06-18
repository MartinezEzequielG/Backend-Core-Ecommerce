import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class CheckoutAddressDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  phone!: string;

  @IsString()
  street!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  // ✅ lo manda el store; por ahora lo aceptamos (no se persiste todavía)
  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class CreateCheckoutDto {
  @IsString()
  checkoutToken!: string;

  @IsOptional()
  @IsString()
  guestSessionToken?: string;

  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shipping!: CheckoutAddressDto;

  // ✅ nuevo: para que no falle validation si viene
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billing?: CheckoutAddressDto;

  @IsNumber()
  shippingCost!: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;
}
