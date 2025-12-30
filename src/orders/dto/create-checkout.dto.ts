export class CheckoutItemDto {
  variantId: number;
  quantity: number;
}

export class CreateCheckoutDto {
  checkoutToken: string;
  guestSessionToken?: string;
  shipping: { fullName: string; email?: string; phone: string; street: string; city: string; state: string; zip?: string; country?: string };
  shippingCost: number;
  paymentMethod?: string;
}
