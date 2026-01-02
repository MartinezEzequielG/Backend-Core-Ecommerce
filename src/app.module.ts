import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { AdminCategoriesModule } from './admin/admin-categories/admin-categories.module';
import { AdminProductsModule } from './admin/admin-products/admin-products.module';
import { UploadsModule } from './uploads/uploads.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { AdminOrdersModule } from './admin/admin-orders/admin-orders.module';
import { AdminUsersModule } from './admin/admin-users/admin-users.module';
import { AdminStatsModule } from './admin/admin-stats/admin-stats.module';
import { AdminCouponsModule } from './admin/admin-coupons/admin-coupons.module';
import { AdminSiteModule } from './admin/admin-site/admin-site.module';
import { ContentModule } from './content/content.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminStoreSettingsModule } from './admin/admin-store-settings/admin-store-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    AdminCategoriesModule,
    AdminProductsModule,
    UploadsModule,
    CartModule,
    OrdersModule,
    AdminOrdersModule,
    AdminUsersModule,
    AdminStatsModule,
    AdminCouponsModule,
    AdminSiteModule,
    ContentModule,
    PaymentsModule,
    AdminStoreSettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
