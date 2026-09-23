import type { FilamentRoll } from './entities/filament-roll.entity.js';
import type { InventoryMovement, MovementType } from './entities/inventory-movement.entity.js';

// Door 6a: status derivado em runtime, nunca uma coluna própria.
export const ROLL_STATUSES = ['fechado', 'aberto', 'vazio', 'descartado'] as const;
export type RollStatus = (typeof ROLL_STATUSES)[number];

export function deriveStatus(roll: Pick<FilamentRoll, 'discardedAt' | 'balanceGrams' | 'openedAt'>): RollStatus {
  if (roll.discardedAt !== null) {
    return 'descartado';
  }
  if (roll.balanceGrams === 0) {
    return 'vazio';
  }
  if (roll.openedAt !== null) {
    return 'aberto';
  }
  return 'fechado';
}

export interface RollResponse {
  id: string;
  materialId: string;
  supplierId: string | null;
  nominalWeightGrams: number;
  initialWeightGrams: number;
  balanceGrams: number;
  spoolTareGrams: number;
  batch: string | null;
  purchaseDate: string | null;
  openedAt: Date | null;
  lastDriedAt: Date | null;
  discardedAt: Date | null;
  location: string | null;
  acquisitionCostCents: number;
  status: RollStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MovementResponse {
  id: string;
  type: MovementType;
  quantityGrams: number;
  unitCostCentsPerGram: number | null;
  reason: string | null;
  userId: string;
  createdAt: Date;
}

export interface RollDetailResponse extends RollResponse {
  movements: MovementResponse[];
}

export interface ListRollsResponse {
  items: RollResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialSummaryItem {
  materialId: string;
  totalBalanceGrams: number;
  avgCostCentsPerGram: number | null;
  rollCount: number;
}

export interface MaterialsSummaryResponse {
  items: MaterialSummaryItem[];
}

export function toRollResponse(roll: FilamentRoll): RollResponse {
  return {
    id: roll.id,
    materialId: roll.materialId,
    supplierId: roll.supplierId,
    nominalWeightGrams: roll.nominalWeightGrams,
    initialWeightGrams: roll.initialWeightGrams,
    balanceGrams: roll.balanceGrams,
    spoolTareGrams: roll.spoolTareGrams,
    batch: roll.batch,
    purchaseDate: roll.purchaseDate,
    openedAt: roll.openedAt,
    lastDriedAt: roll.lastDriedAt,
    discardedAt: roll.discardedAt,
    location: roll.location,
    acquisitionCostCents: roll.acquisitionCostCents,
    status: deriveStatus(roll),
    createdAt: roll.createdAt,
    updatedAt: roll.updatedAt,
  };
}

export function toMovementResponse(movement: InventoryMovement): MovementResponse {
  return {
    id: movement.id,
    type: movement.type,
    quantityGrams: movement.quantityGrams,
    unitCostCentsPerGram: movement.unitCostCentsPerGram,
    reason: movement.reason,
    userId: movement.userId,
    createdAt: movement.createdAt,
  };
}

export const MATERIAL_NOT_FOUND = 'Material não encontrado ou inativo';
export const SUPPLIER_NOT_FOUND = 'Fornecedor não encontrado';
export const ROLL_NOT_FOUND = 'Rolo não encontrado';
export const ROLL_DISCARDED = 'Rolo já descartado';
export const WEIGHT_BELOW_TARE = 'grossWeightGrams não pode ser menor que a tara do rolo';
export const INSUFFICIENT_BALANCE = 'Saldo insuficiente para esta baixa';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
