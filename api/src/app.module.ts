import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './database/typeorm-options.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { PrintersModule } from './modules/printers/printers.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { PrintProfilesModule } from './modules/print-profiles/print-profiles.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    UsersModule,
    HealthModule,
    MaterialsModule,
    PricingModule,
    PrintersModule,
    PrintProfilesModule,
    SettingsModule,
    CustomersModule,
    SuppliersModule,
    InventoryModule,
    ProductsModule,
  ],
})
export class AppModule {}
