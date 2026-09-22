import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';
import type { SettingsResponse } from './settings.types.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Leitura liberada a todo papel logado (AC 1); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  get(): Promise<SettingsResponse> {
    return this.settings.get();
  }

  // Sem @Roles(): só admin (AC 7).
  @Patch()
  update(@Body() dto: UpdateSettingsDto): Promise<SettingsResponse> {
    return this.settings.update(dto);
  }
}
