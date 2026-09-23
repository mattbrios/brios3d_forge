import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { ListMaterialsDto } from './dto/list-materials.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { MaterialsService } from './materials.service.js';
import type { ListMaterialsResponse, MaterialResponse } from './materials.types.js';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  // Leitura liberada a todo papel logado (AC 8); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get()
  list(@Query() query: ListMaterialsDto): Promise<ListMaterialsResponse> {
    return this.materials.list(query);
  }

  // Sem @Roles(): só admin (AC 6).
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateMaterialDto): Promise<MaterialResponse> {
    return this.materials.create(dto);
  }

  // Sem @Roles(): só admin (AC 17). Nenhuma rota de exclusão física é declarada (AC 21).
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateMaterialDto,
  ): Promise<MaterialResponse> {
    return this.materials.update(id, dto);
  }
}
