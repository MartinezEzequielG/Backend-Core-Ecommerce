import { Controller, Get, Put, Body } from '@nestjs/common';
import { AdminStoreSettingsService } from './admin-store-settings.service';

@Controller('admin/store-settings')
export class AdminStoreSettingsController {
  constructor(private readonly service: AdminStoreSettingsService) {}

  @Get()
  async get() {
    return this.service.get();
  }

  @Put()
  async update(@Body() body: any) {
    return this.service.update(body);
  }
}