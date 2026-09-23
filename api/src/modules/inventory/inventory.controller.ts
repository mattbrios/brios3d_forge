import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateMovementDto } from './dto/create-movement.dto.js';
import { CreateRollDto } from './dto/create-roll.dto.js';
import { ListRollsDto } from './dto/list-rolls.dto.js';
import { MaterialsSummaryDto } from './dto/materials-summary.dto.js';
import { WeighRollDto } from './dto/weigh-roll.dto.js';
import { InventoryService } from './inventory.service.js';
import type {
  ListRollsResponse,
  MaterialsSummaryResponse,
  RollDetailResponse,
  RollResponse,
} from './inventory.types.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Sem @Roles(): só admin (AC 6, dado financeiro).
  @Post('rolls')
  @HttpCode(201)
  createRoll(@Body() dto: CreateRollDto, @CurrentUser() actingUser: AuthUser): Promise<RollResponse> {
    return this.inventory.createRoll(dto, actingUser.id);
  }

  // Leitura liberada a todo papel logado (AC 7); admin já passa sempre pelo RolesGuard.
  @Roles('production', 'sales')
  @Get('rolls')
  list(@Query() query: ListRollsDto): Promise<ListRollsResponse> {
    return this.inventory.list(query);
  }

  @Roles('production', 'sales')
  @Get('materials-summary')
  materialsSummary(@Query() query: MaterialsSummaryDto): Promise<MaterialsSummaryResponse> {
    return this.inventory.materialsSummary(query);
  }

  @Roles('production', 'sales')
  @Get('rolls/:id')
  getById(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string): Promise<RollDetailResponse> {
    return this.inventory.getById(id);
  }

  // Ação operacional de chão de fábrica: produção (e admin, que sempre passa) pesa (AC 15).
  @Roles('production')
  @Patch('rolls/:id/weigh')
  weigh(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: WeighRollDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<RollResponse> {
    return this.inventory.weigh(id, dto, actingUser.id);
  }

  @Roles('production')
  @Post('rolls/:id/movements')
  @HttpCode(201)
  addMovement(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<RollResponse> {
    return this.inventory.addMovement(id, dto, actingUser.id);
  }

  @Roles('production')
  @Patch('rolls/:id/discard')
  discard(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<RollResponse> {
    return this.inventory.discard(id, actingUser.id);
  }

  @Roles('production')
  @Patch('rolls/:id/open')
  open(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string): Promise<RollResponse> {
    return this.inventory.open(id);
  }

  @Roles('production')
  @Patch('rolls/:id/dry')
  dry(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string): Promise<RollResponse> {
    return this.inventory.dry(id);
  }
}
