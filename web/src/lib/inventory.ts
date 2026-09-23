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

// Fase 10, door 3 e door 4: o movimento tem exatamente um dono (`rollId` ou `stockItemId`), e a
// quantidade não se chama mais em gramas - a unidade vem do dono.
export interface InventoryMovement {
  id: string;
  type: MovementType;
  quantity: number;
  unitCostCents: number | null;
  reason: string | null;
  userId: string;
  createdAt: string;
  rollId: string | null;
  stockItemId: string | null;
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
