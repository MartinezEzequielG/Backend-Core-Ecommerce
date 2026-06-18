import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AndreaniQuoteService } from './andreani-quote.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly andreani: AndreaniQuoteService) {}

  @Post('quote')
  @HttpCode(200)
  async quote(@Body() body: { postalCode?: string; postalCodeDestination?: string }) {
    const postalCodeDestination = String(body?.postalCode ?? body?.postalCodeDestination ?? '').trim();
    const { option } = await this.andreani.quoteHome({ postalCodeDestination });
    return { options: [option] };
  }
}