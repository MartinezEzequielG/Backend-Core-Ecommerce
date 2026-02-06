import { IsInt, Min } from 'class-validator';

export class CreatePreferenceDto {
  @IsInt()
  @Min(1)
  orderId!: number;
}