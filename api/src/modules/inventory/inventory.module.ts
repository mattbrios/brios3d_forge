import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { StockItemPrinter } from './entities/stock-item-printer.entity.js';
import { StockItem } from './entities/stock-item.entity.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FilamentRoll, InventoryMovement, StockItem, StockItemPrinter])],
  controllers: [InventoryController],
  providers: [InventoryService],
  // Fase 12 (quote-preview): QuotePreviewService precisa do custo médio de material e insumo.
  exports: [InventoryService],
})
export class InventoryModule {}
