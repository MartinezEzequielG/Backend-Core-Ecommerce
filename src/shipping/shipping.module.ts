import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { AndreaniAuthService } from './andreani-auth.service';
import { AndreaniQuoteService } from './andreani-quote.service';

@Module({
  controllers: [ShippingController],
  providers: [AndreaniAuthService, AndreaniQuoteService],
  exports: [AndreaniAuthService, AndreaniQuoteService],
})
export class ShippingModule {}