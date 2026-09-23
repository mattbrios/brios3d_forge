import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { computeAverageCostCentsPerGram } from './average-cost.js';
import { CreateMovementDto } from './dto/create-movement.dto.js';
import { CreateRollDto } from './dto/create-roll.dto.js';
import { ListRollsDto } from './dto/list-rolls.dto.js';
import { MaterialsSummaryDto } from './dto/materials-summary.dto.js';
import { WeighRollDto } from './dto/weigh-roll.dto.js';
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { isCheckViolation } from './is-check-violation.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  INSUFFICIENT_BALANCE,
  type ListRollsResponse,
  MATERIAL_NOT_FOUND,
  type MaterialsSummaryResponse,
  ROLL_DISCARDED,
  ROLL_NOT_FOUND,
  type RollDetailResponse,
  type RollResponse,
  SUPPLIER_NOT_FOUND,
  WEIGHT_BELOW_TARE,
  toMovementResponse,
  toRollResponse,
} from './inventory.types.js';
import { Material } from '../materials/entities/material.entity.js';
import { Supplier } from '../suppliers/entities/supplier.entity.js';

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
          type: 'entrada',
          quantityGrams: dto.initialWeightGrams,
          unitCostCentsPerGram: dto.acquisitionCostCents / dto.initialWeightGrams,
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
          type: 'ajuste',
          quantityGrams: delta,
          unitCostCentsPerGram: null,
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
          .where('id = :id', { id, qty: dto.quantityGrams })
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
          type: dto.type,
          quantityGrams: -dto.quantityGrams,
          unitCostCentsPerGram: null,
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
            type: 'perda',
            quantityGrams: -remaining,
            unitCostCentsPerGram: null,
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
}
