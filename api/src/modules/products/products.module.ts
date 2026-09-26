import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module.js';
import { MaterialsModule } from '../materials/materials.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { PrintersModule } from '../printers/printers.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ProductVariantMaterial } from './entities/product-variant-material.entity.js';
import { ProductVariantSupply } from './entities/product-variant-supply.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';
import { ProductPricingService } from './product-pricing.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

// Door 1: catálogo em módulo próprio. O custo vem do QuotePreviewService (PricingModule), e os
// três cadastros só são consultados para conferir os ids da ficha.
@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, ProductVariantMaterial, ProductVariantSupply]),
    PricingModule,
    MaterialsModule,
    PrintersModule,
    InventoryModule,
    SettingsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductPricingService],
})
export class ProductsModule {}
