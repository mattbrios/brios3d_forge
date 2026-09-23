import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersDto } from './dto/list-suppliers.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';
import type { ListSuppliersResponse, SupplierResponse } from './suppliers.types.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  // Leitura liberada a todo papel logado (AC 33); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  list(@Query() query: ListSuppliersDto): Promise<ListSuppliersResponse> {
    return this.suppliers.list(query);
  }

  // Sem @Roles(): só admin (AC 31), diferente de customers.
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateSupplierDto): Promise<SupplierResponse> {
    return this.suppliers.create(dto);
  }

  // Sem @Roles(): só admin (AC 42). Nenhuma rota de exclusão física é declarada (AC 46).
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponse> {
    return this.suppliers.update(id, dto);
  }
}
