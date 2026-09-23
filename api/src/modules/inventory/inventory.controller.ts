import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CountItemDto } from './dto/count-item.dto.js';
import { CreateEntryDto } from './dto/create-entry.dto.js';
import { CreateItemMovementDto } from './dto/create-item-movement.dto.js';
import { CreateMovementDto } from './dto/create-movement.dto.js';
import { CreateRollDto } from './dto/create-roll.dto.js';
import { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import { ListMovementsDto } from './dto/list-movements.dto.js';
import { ListRollsDto } from './dto/list-rolls.dto.js';
import { ListStockItemsDto } from './dto/list-stock-items.dto.js';
import { MaterialsSummaryDto } from './dto/materials-summary.dto.js';
import { UpdateStockItemDto } from './dto/update-stock-item.dto.js';
import { WeighRollDto } from './dto/weigh-roll.dto.js';
import { InventoryService } from './inventory.service.js';
import type {
  ListMovementsResponse,
  ListRollsResponse,
  ListStockItemsResponse,
  MaterialsSummaryResponse,
  RollDetailResponse,
  RollResponse,
  StockItemDetailResponse,
  StockItemResponse,
} from './inventory.types.js';

const uuidParam = () => new ParseUUIDPipe({ errorHttpStatusCode: 400 });

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
  getById(@Param('id', uuidParam()) id: string): Promise<RollDetailResponse> {
    return this.inventory.getById(id);
  }

  // Ação operacional de chão de fábrica: produção (e admin, que sempre passa) pesa (AC 15).
  @Roles('production')
  @Patch('rolls/:id/weigh')
  weigh(
    @Param('id', uuidParam()) id: string,
    @Body() dto: WeighRollDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<RollResponse> {
    return this.inventory.weigh(id, dto, actingUser.id);
  }

  @Roles('production')
  @Post('rolls/:id/movements')
  @HttpCode(201)
  addMovement(
    @Param('id', uuidParam()) id: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<RollResponse> {
    return this.inventory.addMovement(id, dto, actingUser.id);
  }

  @Roles('production')
  @Patch('rolls/:id/discard')
  discard(@Param('id', uuidParam()) id: string, @CurrentUser() actingUser: AuthUser): Promise<RollResponse> {
    return this.inventory.discard(id, actingUser.id);
  }

  @Roles('production')
  @Patch('rolls/:id/open')
  open(@Param('id', uuidParam()) id: string): Promise<RollResponse> {
    return this.inventory.open(id);
  }

  @Roles('production')
  @Patch('rolls/:id/dry')
  dry(@Param('id', uuidParam()) id: string): Promise<RollResponse> {
    return this.inventory.dry(id);
  }

  // Cadastro do item: dado de fornecedor e de custo, então só admin (AC 8).
  @Post('items')
  @HttpCode(201)
  createItem(@Body() dto: CreateStockItemDto): Promise<StockItemResponse> {
    return this.inventory.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id', uuidParam()) id: string, @Body() dto: UpdateStockItemDto): Promise<StockItemResponse> {
    return this.inventory.updateItem(id, dto);
  }

  @Roles('production', 'sales')
  @Get('items')
  listItems(@Query() query: ListStockItemsDto): Promise<ListStockItemsResponse> {
    return this.inventory.listItems(query);
  }

  // Lista unificada de rolo e item (AC 34); declarada antes de `items/:id` só por leitura, as
  // duas rotas não colidem (prefixo estático distinto).
  @Roles('production', 'sales')
  @Get('movements')
  listMovements(@Query() query: ListMovementsDto): Promise<ListMovementsResponse> {
    return this.inventory.listMovements(query);
  }

  @Roles('production', 'sales')
  @Get('items/:id')
  getItemById(@Param('id', uuidParam()) id: string): Promise<StockItemDetailResponse> {
    return this.inventory.getItemById(id);
  }

  // A entrada carrega o custo pago, então é admin (AC 19).
  @Post('items/:id/entries')
  @HttpCode(201)
  addEntry(
    @Param('id', uuidParam()) id: string,
    @Body() dto: CreateEntryDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<StockItemResponse> {
    return this.inventory.addEntry(id, dto, actingUser.id);
  }

  // Consumo e perda são ação de chão de fábrica: produção (AC 24).
  @Roles('production')
  @Post('items/:id/movements')
  @HttpCode(201)
  addItemMovement(
    @Param('id', uuidParam()) id: string,
    @Body() dto: CreateItemMovementDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<StockItemResponse> {
    return this.inventory.addItemMovement(id, dto, actingUser.id);
  }

  @Roles('production')
  @Patch('items/:id/count')
  countItem(
    @Param('id', uuidParam()) id: string,
    @Body() dto: CountItemDto,
    @CurrentUser() actingUser: AuthUser,
  ): Promise<StockItemResponse> {
    return this.inventory.countItem(id, dto, actingUser.id);
  }
}
