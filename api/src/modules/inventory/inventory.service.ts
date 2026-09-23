import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { computeAverageCostCentsPerGram } from './average-cost.js';
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
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { StockItemPrinter } from './entities/stock-item-printer.entity.js';
import { StockItem } from './entities/stock-item.entity.js';
import { isCheckViolation } from './is-check-violation.js';
import {
  COMPATIBILITY_ONLY_FOR_SPARE_PART,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DUPLICATE_SKU,
  INSUFFICIENT_BALANCE,
  type ListMovementsResponse,
  type ListRollsResponse,
  type ListStockItemsResponse,
  MATERIAL_NOT_FOUND,
  type MaterialsSummaryResponse,
  PRINTER_NOT_FOUND,
  ROLL_DISCARDED,
  ROLL_NOT_FOUND,
  type RollDetailResponse,
  type RollResponse,
  STOCK_ITEM_INACTIVE,
  STOCK_ITEM_NOT_FOUND,
  SUPPLIER_NOT_FOUND,
  type StockItemDetailResponse,
  type StockItemResponse,
  WEIGHT_BELOW_TARE,
  toMovementResponse,
  toRollResponse,
  toStockItemResponse,
} from './inventory.types.js';
import { computeStockItemAverageCost } from './stock-item-average-cost.js';
import { Material } from '../materials/entities/material.entity.js';
import { Printer } from '../printers/entities/printer.entity.js';
import { Supplier } from '../suppliers/entities/supplier.entity.js';
import { isUniqueViolation } from '../users/is-unique-violation.js';

// Escapa os curingas do ILIKE para o texto do usuário virar uma substring literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const STATUS_CASE_SQL = `CASE
  WHEN roll.discarded_at IS NOT NULL THEN 'descartado'
  WHEN roll.balance_grams = 0 THEN 'vazio'
  WHEN roll.opened_at IS NOT NULL THEN 'aberto'
  ELSE 'fechado'
END`;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(FilamentRoll) private readonly rolls: Repository<FilamentRoll>,
    @InjectRepository(InventoryMovement) private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(StockItem) private readonly stockItems: Repository<StockItem>,
  ) {}

  async createRoll(dto: CreateRollDto, userId: string): Promise<RollResponse> {
    return this.rolls.manager.transaction(async (manager) => {
      const material = await manager.getRepository(Material).findOne({ where: { id: dto.materialId } });
      if (!material || !material.active) {
        throw new BadRequestException(MATERIAL_NOT_FOUND);
      }
      if (dto.supplierId !== undefined) {
        const supplier = await manager.getRepository(Supplier).findOne({ where: { id: dto.supplierId } });
        if (!supplier) {
          throw new BadRequestException(SUPPLIER_NOT_FOUND);
        }
      }

      const rollsRepo = manager.getRepository(FilamentRoll);
      const movementsRepo = manager.getRepository(InventoryMovement);

      const roll = await rollsRepo.save(
        rollsRepo.create({
          materialId: dto.materialId,
          supplierId: dto.supplierId ?? null,
          nominalWeightGrams: dto.nominalWeightGrams ?? dto.initialWeightGrams,
          initialWeightGrams: dto.initialWeightGrams,
          balanceGrams: dto.initialWeightGrams,
          spoolTareGrams: dto.spoolTareGrams,
          batch: dto.batch ?? null,
          purchaseDate: dto.purchaseDate ?? null,
          location: dto.location ?? null,
          acquisitionCostCents: dto.acquisitionCostCents,
        }),
      );

      // Mesma transação do rolo (door 2): se este save falhar, o rolo acima reverte junto,
      // sem deixar um rolo órfão sem movimento de entrada (AC 5).
      await movementsRepo.save(
        movementsRepo.create({
          rollId: roll.id,
          stockItemId: null,
          type: 'entrada',
          quantity: dto.initialWeightGrams,
          unitCostCents: dto.acquisitionCostCents / dto.initialWeightGrams,
          reason: null,
          userId,
        }),
      );

      return toRollResponse(roll);
    });
  }

  async list(query: ListRollsDto): Promise<ListRollsResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.rolls
      .createQueryBuilder('roll')
      .orderBy('roll.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.materialId !== undefined) {
      qb.andWhere('roll.material_id = :materialId', { materialId: query.materialId });
    }
    if (query.status !== undefined) {
      qb.andWhere(`${STATUS_CASE_SQL} = :status`, { status: query.status });
    }
    if (query.search !== undefined) {
      qb.andWhere('(roll.batch ILIKE :search OR roll.location ILIKE :search)', {
        search: `%${escapeLike(query.search)}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toRollResponse), total, page, pageSize };
  }

  async getById(id: string): Promise<RollDetailResponse> {
    const roll = await this.rolls.findOne({ where: { id } });
    if (!roll) {
      throw new NotFoundException(ROLL_NOT_FOUND);
    }
    const movements = await this.movements.find({ where: { rollId: id }, order: { createdAt: 'ASC' } });
    return { ...toRollResponse(roll), movements: movements.map(toMovementResponse) };
  }

  async weigh(id: string, dto: WeighRollDto, userId: string): Promise<RollResponse> {
    return this.rolls.manager.transaction(async (manager) => {
      const rollsRepo = manager.getRepository(FilamentRoll);
      const movementsRepo = manager.getRepository(InventoryMovement);

      const roll = await rollsRepo.findOne({ where: { id } });
      if (!roll) {
        throw new NotFoundException(ROLL_NOT_FOUND);
      }
      if (roll.discardedAt !== null) {
        throw new ConflictException(ROLL_DISCARDED);
      }
      if (dto.grossWeightGrams < roll.spoolTareGrams) {
        throw new BadRequestException(WEIGHT_BELOW_TARE);
      }

      const newBalance = dto.grossWeightGrams - roll.spoolTareGrams;
      const delta = newBalance - roll.balanceGrams;
      roll.balanceGrams = newBalance;
      await rollsRepo.save(roll);

      await movementsRepo.save(
        movementsRepo.create({
          rollId: roll.id,
          stockItemId: null,
          type: 'ajuste',
          quantity: delta,
          unitCostCents: null,
          reason: null,
          userId,
        }),
      );

      return toRollResponse(roll);
    });
  }

  async addMovement(id: string, dto: CreateMovementDto, userId: string): Promise<RollResponse> {
    return this.rolls.manager.transaction(async (manager) => {
      const rollsRepo = manager.getRepository(FilamentRoll);
      const movementsRepo = manager.getRepository(InventoryMovement);

      const roll = await rollsRepo.findOne({ where: { id } });
      if (!roll) {
        throw new NotFoundException(ROLL_NOT_FOUND);
      }
      if (roll.discardedAt !== null) {
        throw new ConflictException(ROLL_DISCARDED);
      }

      // Sem pré-checagem em memória: o saldo insuficiente, sequencial ou concorrente, é sempre
      // decidido pelo mesmo caminho (door 3) - um decremento relativo em SQL, não a partir do
      // valor já lido. Sob duas baixas concorrentes, o segundo UPDATE espera o primeiro
      // committar, recalcula sobre o saldo já atualizado, e o CHECK (balance_grams >= 0) do
      // banco rejeita quem estourar o saldo real; uma pré-checagem em JS aqui deixaria essa
      // rejeição sem nenhuma prova (o caso sequencial nunca chegaria a exercitá-la).
      try {
        await manager
          .createQueryBuilder()
          .update(FilamentRoll)
          .set({ balanceGrams: () => 'balance_grams - :qty' })
          .where('id = :id', { id, qty: dto.quantity })
          .execute();
      } catch (error) {
        if (isCheckViolation(error)) {
          throw new BadRequestException(INSUFFICIENT_BALANCE);
        }
        throw error;
      }

      await movementsRepo.save(
        movementsRepo.create({
          rollId: roll.id,
          stockItemId: null,
          type: dto.type,
          quantity: -dto.quantity,
          unitCostCents: null,
          reason: dto.reason ?? null,
          userId,
        }),
      );

      const updated = await rollsRepo.findOneOrFail({ where: { id } });
      return toRollResponse(updated);
    });
  }

  async discard(id: string, userId: string): Promise<RollResponse> {
    return this.rolls.manager.transaction(async (manager) => {
      const rollsRepo = manager.getRepository(FilamentRoll);
      const movementsRepo = manager.getRepository(InventoryMovement);

      const roll = await rollsRepo.findOne({ where: { id } });
      if (!roll) {
        throw new NotFoundException(ROLL_NOT_FOUND);
      }
      if (roll.discardedAt !== null) {
        throw new ConflictException(ROLL_DISCARDED);
      }

      const remaining = roll.balanceGrams;
      roll.balanceGrams = 0;
      roll.discardedAt = new Date();
      await rollsRepo.save(roll);

      if (remaining > 0) {
        await movementsRepo.save(
          movementsRepo.create({
            rollId: roll.id,
            stockItemId: null,
            type: 'perda',
            quantity: -remaining,
            unitCostCents: null,
            reason: null,
            userId,
          }),
        );
      }

      return toRollResponse(roll);
    });
  }

  async open(id: string): Promise<RollResponse> {
    const roll = await this.rolls.findOne({ where: { id } });
    if (!roll) {
      throw new NotFoundException(ROLL_NOT_FOUND);
    }
    // Idempotente (AC 22): uma segunda chamada mantém o openedAt original.
    if (roll.openedAt === null) {
      roll.openedAt = new Date();
      await this.rolls.save(roll);
    }
    return toRollResponse(roll);
  }

  async dry(id: string): Promise<RollResponse> {
    const roll = await this.rolls.findOne({ where: { id } });
    if (!roll) {
      throw new NotFoundException(ROLL_NOT_FOUND);
    }
    // Sempre avança (AC 23): um rolo pode secar mais de uma vez.
    roll.lastDriedAt = new Date();
    await this.rolls.save(roll);
    return toRollResponse(roll);
  }

  async materialsSummary(query: MaterialsSummaryDto): Promise<MaterialsSummaryResponse> {
    const qb = this.rolls
      .createQueryBuilder('roll')
      .leftJoinAndSelect('roll.material', 'material')
      .orderBy('material.type', 'ASC')
      .addOrderBy('material.brand', 'ASC')
      .addOrderBy('material.color', 'ASC');

    if (query.search !== undefined) {
      qb.andWhere(
        '(material.type ILIKE :search OR material.brand ILIKE :search OR material.color ILIKE :search)',
        { search: `%${escapeLike(query.search)}%` },
      );
    }

    const rolls = await qb.getMany();
    const byMaterial = new Map<string, FilamentRoll[]>();
    for (const roll of rolls) {
      const group = byMaterial.get(roll.materialId) ?? [];
      group.push(roll);
      byMaterial.set(roll.materialId, group);
    }

    const items = [...byMaterial.entries()].map(([materialId, materialRolls]) => ({
      materialId,
      totalBalanceGrams: materialRolls
        .filter((roll) => roll.discardedAt === null)
        .reduce((sum, roll) => sum + roll.balanceGrams, 0),
      avgCostCentsPerGram: computeAverageCostCentsPerGram(materialRolls),
      rollCount: materialRolls.length,
    }));

    return { items };
  }

  // --- Itens de estoque (insumos e peças de reposição) ---

  async createItem(dto: CreateStockItemDto): Promise<StockItemResponse> {
    return this.stockItems.manager.transaction(async (manager) => {
      await this.assertCompatibilityAllowed(manager, dto.category, dto.compatiblePrinterIds);
      await this.assertSupplierExists(manager, dto.preferredSupplierId);

      const itemsRepo = manager.getRepository(StockItem);
      // Saldo 0 e nenhum movimento (door 6): quem carrega quantidade e custo é a entrada.
      const item = await this.saveItem(
        itemsRepo,
        itemsRepo.create({
          category: dto.category,
          name: dto.name,
          sku: dto.sku ?? null,
          unitOfMeasure: dto.unitOfMeasure,
          location: dto.location ?? null,
          preferredSupplierId: dto.preferredSupplierId ?? null,
          balanceQuantity: 0,
          active: true,
        }),
      );

      const printerIds = await this.replaceCompatibility(manager, item.id, dto.compatiblePrinterIds);
      return toStockItemResponse(item, null, printerIds);
    });
  }

  async updateItem(id: string, dto: UpdateStockItemDto): Promise<StockItemResponse> {
    return this.stockItems.manager.transaction(async (manager) => {
      const itemsRepo = manager.getRepository(StockItem);
      const item = await itemsRepo.findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException(STOCK_ITEM_NOT_FOUND);
      }

      const category = dto.category ?? item.category;
      await this.assertCompatibilityAllowed(manager, category, dto.compatiblePrinterIds);
      await this.assertSupplierExists(manager, dto.preferredSupplierId);

      if (dto.category !== undefined) item.category = dto.category;
      if (dto.name !== undefined) item.name = dto.name;
      if (dto.sku !== undefined) item.sku = dto.sku;
      if (dto.unitOfMeasure !== undefined) item.unitOfMeasure = dto.unitOfMeasure;
      if (dto.location !== undefined) item.location = dto.location;
      if (dto.preferredSupplierId !== undefined) item.preferredSupplierId = dto.preferredSupplierId;
      if (dto.active !== undefined) item.active = dto.active;
      await this.saveItem(itemsRepo, item);

      // Omitir o campo preserva os vínculos (AC 33); enviá-lo substitui o conjunto (AC 32).
      const printerIds =
        dto.compatiblePrinterIds === undefined
          ? await this.compatibilityOf(manager, id)
          : await this.replaceCompatibility(manager, id, dto.compatiblePrinterIds);

      const { avgCostCents } = await this.ledgerStateOf(manager, id);
      return toStockItemResponse(item, avgCostCents, printerIds);
    });
  }

  async listItems(query: ListStockItemsDto): Promise<ListStockItemsResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.stockItems
      .createQueryBuilder('item')
      .orderBy('item.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.category !== undefined) {
      qb.andWhere('item.category = :category', { category: query.category });
    }
    if (query.search !== undefined) {
      qb.andWhere('(item.name ILIKE :search OR item.sku ILIKE :search)', {
        search: `%${escapeLike(query.search)}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((row) => row.id);
    const ledgerByItem = await this.ledgerStateOfMany(this.stockItems.manager, ids);
    const printersByItem = await this.compatibilityOfMany(this.stockItems.manager, ids);

    const items = rows.map((row) =>
      toStockItemResponse(row, ledgerByItem.get(row.id)?.avgCostCents ?? null, printersByItem.get(row.id) ?? []),
    );
    return { items, total, page, pageSize };
  }

  async getItemById(id: string): Promise<StockItemDetailResponse> {
    const item = await this.stockItems.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(STOCK_ITEM_NOT_FOUND);
    }
    const movements = await this.movements.find({
      where: { stockItemId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const { avgCostCents } = computeStockItemAverageCost(movements);
    const printerIds = await this.compatibilityOf(this.stockItems.manager, id);
    return {
      ...toStockItemResponse(item, avgCostCents, printerIds),
      movements: movements.map(toMovementResponse),
    };
  }

  async addEntry(id: string, dto: CreateEntryDto, userId: string): Promise<StockItemResponse> {
    return this.stockItems.manager.transaction(async (manager) => {
      const item = await manager.getRepository(StockItem).findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException(STOCK_ITEM_NOT_FOUND);
      }
      // Desativar é "não comprar mais isto": a entrada para, as saídas continuam (AC 18).
      if (!item.active) {
        throw new BadRequestException(STOCK_ITEM_INACTIVE);
      }

      await this.shiftBalance(manager, id, dto.quantity);
      await this.writeItemMovement(manager, {
        stockItemId: id,
        type: 'entrada',
        quantity: dto.quantity,
        unitCostCents: dto.unitCostCents,
        reason: dto.reason ?? null,
        userId,
      });

      return this.reloadItem(manager, id);
    });
  }

  async addItemMovement(id: string, dto: CreateItemMovementDto, userId: string): Promise<StockItemResponse> {
    return this.stockItems.manager.transaction(async (manager) => {
      const item = await manager.getRepository(StockItem).findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException(STOCK_ITEM_NOT_FOUND);
      }

      // Mesmo caminho do rolo (AD-023): decremento relativo em SQL, e quem estoura o saldo é
      // rejeitado pelo CHECK do banco, nunca por uma pré-checagem em memória.
      await this.shiftBalance(manager, id, -dto.quantity);
      await this.writeItemMovement(manager, {
        stockItemId: id,
        type: dto.type,
        quantity: -dto.quantity,
        unitCostCents: null,
        reason: dto.reason ?? null,
        userId,
      });

      return this.reloadItem(manager, id);
    });
  }

  async countItem(id: string, dto: CountItemDto, userId: string): Promise<StockItemResponse> {
    return this.stockItems.manager.transaction(async (manager) => {
      const itemsRepo = manager.getRepository(StockItem);
      // A contagem grava um valor absoluto, então a linha é travada para o delta do `ajuste`
      // casar com o saldo que de fato foi substituído.
      const item = await itemsRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!item) {
        throw new NotFoundException(STOCK_ITEM_NOT_FOUND);
      }

      const delta = dto.countedQuantity - item.balanceQuantity;
      item.balanceQuantity = dto.countedQuantity;
      await itemsRepo.save(item);

      // Grava o ajuste mesmo com delta 0 (AC 26): a contagem em si é o fato auditável.
      await this.writeItemMovement(manager, {
        stockItemId: id,
        type: 'ajuste',
        quantity: delta,
        unitCostCents: null,
        reason: dto.reason ?? null,
        userId,
      });

      return this.reloadItem(manager, id);
    });
  }

  async listMovements(query: ListMovementsDto): Promise<ListMovementsResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    // Lista unificada (door 3): rolo e item na mesma tabela, então na mesma página.
    const [rows, total] = await this.movements
      .createQueryBuilder('movement')
      .orderBy('movement.createdAt', 'DESC')
      .addOrderBy('movement.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items: rows.map(toMovementResponse), total, page, pageSize };
  }

  private async saveItem(itemsRepo: Repository<StockItem>, item: StockItem): Promise<StockItem> {
    try {
      return await itemsRepo.save(item);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_SKU);
      }
      throw error;
    }
  }

  private async assertCompatibilityAllowed(
    manager: EntityManager,
    category: StockItem['category'],
    printerIds: string[] | undefined,
  ): Promise<void> {
    if (printerIds === undefined) {
      return;
    }
    if (category !== 'peca_reposicao') {
      throw new BadRequestException(COMPATIBILITY_ONLY_FOR_SPARE_PART);
    }
    if (printerIds.length === 0) {
      return;
    }
    const found = await manager.getRepository(Printer).count({ where: { id: In(printerIds) } });
    // Um id desconhecido derruba o conjunto inteiro (AC 31): a transação não persiste vínculo
    // nenhum, nem os válidos.
    if (found !== printerIds.length) {
      throw new BadRequestException(PRINTER_NOT_FOUND);
    }
  }

  private async assertSupplierExists(manager: EntityManager, supplierId: string | undefined): Promise<void> {
    if (supplierId === undefined) {
      return;
    }
    const supplier = await manager.getRepository(Supplier).findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new BadRequestException(SUPPLIER_NOT_FOUND);
    }
  }

  private async replaceCompatibility(
    manager: EntityManager,
    stockItemId: string,
    printerIds: string[] | undefined,
  ): Promise<string[]> {
    if (printerIds === undefined) {
      return [];
    }
    const linksRepo = manager.getRepository(StockItemPrinter);
    await linksRepo.delete({ stockItemId });
    if (printerIds.length > 0) {
      await linksRepo.insert(printerIds.map((printerId) => ({ stockItemId, printerId })));
    }
    return this.compatibilityOf(manager, stockItemId);
  }

  private async compatibilityOf(manager: EntityManager, stockItemId: string): Promise<string[]> {
    const links = await manager.getRepository(StockItemPrinter).find({ where: { stockItemId } });
    return links.map((link) => link.printerId).sort();
  }

  private async compatibilityOfMany(
    manager: EntityManager,
    stockItemIds: string[],
  ): Promise<Map<string, string[]>> {
    const byItem = new Map<string, string[]>();
    if (stockItemIds.length === 0) {
      return byItem;
    }
    const links = await manager
      .getRepository(StockItemPrinter)
      .find({ where: { stockItemId: In(stockItemIds) } });
    for (const link of links) {
      const current = byItem.get(link.stockItemId) ?? [];
      current.push(link.printerId);
      byItem.set(link.stockItemId, current);
    }
    for (const ids of byItem.values()) {
      ids.sort();
    }
    return byItem;
  }

  private async ledgerStateOf(manager: EntityManager, stockItemId: string) {
    const movements = await manager
      .getRepository(InventoryMovement)
      .find({ where: { stockItemId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return computeStockItemAverageCost(movements);
  }

  private async ledgerStateOfMany(manager: EntityManager, stockItemIds: string[]) {
    const byItem = new Map<string, ReturnType<typeof computeStockItemAverageCost>>();
    if (stockItemIds.length === 0) {
      return byItem;
    }
    const movements = await manager
      .getRepository(InventoryMovement)
      .find({ where: { stockItemId: In(stockItemIds) }, order: { createdAt: 'ASC', id: 'ASC' } });
    for (const id of stockItemIds) {
      byItem.set(
        id,
        computeStockItemAverageCost(movements.filter((movement) => movement.stockItemId === id)),
      );
    }
    return byItem;
  }

  // Decremento/incremento relativo em SQL (AD-023): o CHECK (balance_quantity >= 0) é o único
  // backstop contra saldo negativo, inclusive sob duas baixas concorrentes.
  private async shiftBalance(manager: EntityManager, id: string, delta: number): Promise<void> {
    try {
      await manager
        .createQueryBuilder()
        .update(StockItem)
        .set({ balanceQuantity: () => 'balance_quantity + :delta' })
        .where('id = :id', { id, delta })
        .execute();
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new BadRequestException(INSUFFICIENT_BALANCE);
      }
      throw error;
    }
  }

  private async writeItemMovement(
    manager: EntityManager,
    movement: {
      stockItemId: string;
      type: InventoryMovement['type'];
      quantity: number;
      unitCostCents: number | null;
      reason: string | null;
      userId: string;
    },
  ): Promise<void> {
    const movementsRepo = manager.getRepository(InventoryMovement);
    await movementsRepo.save(movementsRepo.create({ ...movement, rollId: null }));
  }

  private async reloadItem(manager: EntityManager, id: string): Promise<StockItemResponse> {
    const item = await manager.getRepository(StockItem).findOneOrFail({ where: { id } });
    const { avgCostCents } = await this.ledgerStateOf(manager, id);
    const printerIds = await this.compatibilityOf(manager, id);
    return toStockItemResponse(item, avgCostCents, printerIds);
  }
}
