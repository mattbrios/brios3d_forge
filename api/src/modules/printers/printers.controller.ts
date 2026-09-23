import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { AdjustHourmeterDto } from './dto/adjust-hourmeter.dto.js';
import { CreatePrinterDto } from './dto/create-printer.dto.js';
import { ListPrintersDto } from './dto/list-printers.dto.js';
import { UpdatePrinterDto } from './dto/update-printer.dto.js';
import { PrintersService } from './printers.service.js';
import type { ListPrintersResponse, PrinterResponse } from './printers.types.js';

@Controller('printers')
export class PrintersController {
  constructor(private readonly printers: PrintersService) {}

  // Leitura liberada a todo papel logado (AC 11); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  list(@Query() query: ListPrintersDto): Promise<ListPrintersResponse> {
    return this.printers.list(query);
  }

  // Sem @Roles(): só admin (AC 9).
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreatePrinterDto): Promise<PrinterResponse> {
    return this.printers.create(dto);
  }

  // Sem @Roles(): só admin (AC 21). hourmeterHours nunca aparece no DTO (AC 20, forbidNonWhitelisted).
  // Nenhuma rota de exclusão física é declarada (AC 25).
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdatePrinterDto,
  ): Promise<PrinterResponse> {
    return this.printers.update(id, dto);
  }

  // Door 2 (plano): endpoint dedicado do horímetro, liberado a production (door 3, AC 26,
  // AC 29); isolado do PATCH geral acima.
  @Roles('production')
  @Patch(':id/hourmeter')
  adjustHourmeter(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: AdjustHourmeterDto,
  ): Promise<PrinterResponse> {
    return this.printers.adjustHourmeter(id, dto);
  }
}
