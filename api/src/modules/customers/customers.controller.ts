import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { ListCustomersDto } from './dto/list-customers.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomersService } from './customers.service.js';
import type { CustomerResponse, ListCustomersResponse } from './customers.types.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Leitura liberada a todo papel logado (AC 10); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  list(@Query() query: ListCustomersDto): Promise<ListCustomersResponse> {
    return this.customers.list(query);
  }

  // Door do plano (matriz de permissões): admin e sales escrevem, production só lê (AC 8).
  @Roles('sales')
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateCustomerDto): Promise<CustomerResponse> {
    return this.customers.create(dto);
  }

  // Nenhuma rota de exclusão física é declarada (AC 23).
  @Roles('sales')
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponse> {
    return this.customers.update(id, dto);
  }
}
