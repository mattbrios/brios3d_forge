import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FilamentRoll, InventoryMovement])],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
