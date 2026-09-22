import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedCostItem } from './entities/fixed-cost-item.entity.js';
import { SalesChannel } from './entities/sales-channel.entity.js';
import { Settings } from './entities/settings.entity.js';
import { SalesChannelsController } from './sales-channels.controller.js';
import { SalesChannelsService } from './sales-channels.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

// Dois controllers, um módulo (o ROADMAP lista `settings` como um dos 17 módulos e não lista
// `sales-channels` separadamente).
@Module({
  imports: [TypeOrmModule.forFeature([Settings, FixedCostItem, SalesChannel])],
  controllers: [SettingsController, SalesChannelsController],
  providers: [SettingsService, SalesChannelsService],
})
export class SettingsModule {}
