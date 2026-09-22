import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CreateSalesChannelDto } from './dto/create-sales-channel.dto.js';
import { UpdateSalesChannelDto } from './dto/update-sales-channel.dto.js';
import { SalesChannelsService } from './sales-channels.service.js';
import type { SalesChannelResponse } from './settings.types.js';

@Controller('sales-channels')
export class SalesChannelsController {
  constructor(private readonly channels: SalesChannelsService) {}

  // Leitura liberada a todo papel logado (AC 3); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  list(): Promise<SalesChannelResponse[]> {
    return this.channels.list();
  }

  // Sem @Roles(): só admin (AC 17).
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateSalesChannelDto): Promise<SalesChannelResponse> {
    return this.channels.create(dto);
  }

  // Sem @Roles(): só admin (AC 23).
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateSalesChannelDto,
  ): Promise<SalesChannelResponse> {
    return this.channels.update(id, dto);
  }
}
