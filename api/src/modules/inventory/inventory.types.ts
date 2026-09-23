import type { FilamentRoll } from './entities/filament-roll.entity.js';
import type { InventoryMovement, MovementType } from './entities/inventory-movement.entity.js';
import type { StockItem, StockItemCategory } from './entities/stock-item.entity.js';

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

// Door 4 (Fase 10): um ledger que também conta parafuso não pode nomear a quantidade em gramas.
// A unidade vem do dono - grama no rolo, `unitOfMeasure` no item - e exatamente um dos dois ids
// vem preenchido (door 3).
export interface MovementResponse {
  id: string;
  type: MovementType;
  quantity: number;
  unitCostCents: number | null;
  reason: string | null;
  userId: string;
  createdAt: Date;
  rollId: string | null;
  stockItemId: string | null;
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

export interface StockItemResponse {
  id: string;
  category: StockItemCategory;
  name: string;
  sku: string | null;
  unitOfMeasure: string;
  location: string | null;
  preferredSupplierId: string | null;
  balanceQuantity: number;
  // Door 5: recalculado por replay do ledger a cada leitura, nunca armazenado (AD-024).
  avgCostCents: number | null;
  compatiblePrinterIds: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockItemDetailResponse extends StockItemResponse {
  movements: MovementResponse[];
}

export interface ListStockItemsResponse {
  items: StockItemResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListMovementsResponse {
  items: MovementResponse[];
  total: number;
  page: number;
  pageSize: number;
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
    quantity: movement.quantity,
    unitCostCents: movement.unitCostCents,
    reason: movement.reason,
    userId: movement.userId,
    createdAt: movement.createdAt,
    rollId: movement.rollId,
    stockItemId: movement.stockItemId,
  };
}

export function toStockItemResponse(
  item: StockItem,
  avgCostCents: number | null,
  compatiblePrinterIds: string[],
): StockItemResponse {
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    sku: item.sku,
    unitOfMeasure: item.unitOfMeasure,
    location: item.location,
    preferredSupplierId: item.preferredSupplierId,
    balanceQuantity: item.balanceQuantity,
    avgCostCents,
    compatiblePrinterIds,
    active: item.active,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const MATERIAL_NOT_FOUND = 'Material não encontrado ou inativo';
export const SUPPLIER_NOT_FOUND = 'Fornecedor não encontrado';
export const ROLL_NOT_FOUND = 'Rolo não encontrado';
export const ROLL_DISCARDED = 'Rolo já descartado';
export const WEIGHT_BELOW_TARE = 'grossWeightGrams não pode ser menor que a tara do rolo';
export const INSUFFICIENT_BALANCE = 'Saldo insuficiente para esta baixa';

export const STOCK_ITEM_NOT_FOUND = 'Item não encontrado';
export const DUPLICATE_SKU = 'Já existe um item com este SKU';
export const PRINTER_NOT_FOUND = 'Impressora não encontrada';
export const COMPATIBILITY_ONLY_FOR_SPARE_PART =
  'compatiblePrinterIds só se aplica a peça de reposição';
export const STOCK_ITEM_INACTIVE = 'Item inativo não aceita entrada';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
