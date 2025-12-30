export class MarkOrderPaidDto {
  externalRef!: string; // ID de pago externo (ej: MercadoPago)
  paymentMethod?: string;
}