import type { InventoryMovement } from "./inventory";

// Contrato de /inventory/items* (Fase 10).
export type StockItemCategory = "insumo" | "peca_reposicao";

export const CATEGORY_LABELS: Record<StockItemCategory, string> = {
  insumo: "Insumo",
  peca_reposicao: "Peça de reposição",
};

export interface StockItem {
  id: string;
  category: StockItemCategory;
  name: string;
  sku: string | null;
  unitOfMeasure: string;
  location: string | null;
  preferredSupplierId: string | null;
  balanceQuantity: number;
  // Fase 11: piso de reposição na unidade do item; null é "sem mínimo".
  minimumQuantity: number | null;
  // null quando o saldo é zero: sem nada na prateleira não há custo médio a informar.
  avgCostCents: number | null;
  compatiblePrinterIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItemDetail extends StockItem {
  movements: InventoryMovement[];
}

export interface StockItemsPage {
  items: StockItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementsPage {
  items: InventoryMovement[];
  total: number;
  page: number;
  pageSize: number;
}

// O custo médio é sempre por unidade de medida do item, então a unidade viaja junto no rótulo.
export function formatAvgCost(cents: number | null, unitOfMeasure: string): string {
  return cents === null ? "—" : `R$ ${(cents / 100).toFixed(2)}/${unitOfMeasure}`;
}
