import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { QuotePreviewService } from './quote-preview.service.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { MaterialsModule } from '../materials/materials.module.js';
import { PrintersModule } from '../printers/printers.module.js';
import { SettingsModule } from '../settings/settings.module.js';

// Fase 12: QuotePreviewService orquestra os quatro módulos abaixo para montar o PricingInput a
// partir de ids de cadastro (nenhum deles é modificado).
@Module({
  imports: [InventoryModule, MaterialsModule, PrintersModule, SettingsModule],
  controllers: [PricingController],
  providers: [PricingService, QuotePreviewService],
  exports: [PricingService],
})
export class PricingModule {}
