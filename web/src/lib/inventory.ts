// Contrato de /inventory/rolls* e /inventory/materials-summary (Fase 9).
export type RollStatus = "fechado" | "aberto" | "vazio" | "descartado";

export interface FilamentRoll {
  id: string;
  materialId: string;
  supplierId: string | null;
  nominalWeightGrams: number;
  initialWeightGrams: number;
  balanceGrams: number;
  spoolTareGrams: number;
  batch: string | null;
  purchaseDate: string | null;
  openedAt: string | null;
  lastDriedAt: string | null;
  discardedAt: string | null;
  location: string | null;
  acquisitionCostCents: number;
  status: RollStatus;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = "entrada" | "consumo" | "perda" | "ajuste";

export interface InventoryMovement {
  id: string;
  type: MovementType;
  quantityGrams: number;
  unitCostCentsPerGram: number | null;
  reason: string | null;
  userId: string;
  createdAt: string;
}

export interface RollDetail extends FilamentRoll {
  movements: InventoryMovement[];
}

export interface RollsPage {
  items: FilamentRoll[];
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

export interface MaterialsSummary {
  items: MaterialSummaryItem[];
}
