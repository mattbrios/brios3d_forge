// Contrato de GET /inventory/alerts (Fase 11, door 4): uma lista só, sem paginação, com o tipo de
// dono em `kind` e a unidade em `unit`.
export type StockAlertKind = "material" | "stock_item";

export interface StockAlert {
  kind: StockAlertKind;
  id: string;
  label: string;
  balance: number;
  minimum: number;
  unit: string;
}

export interface StockAlertsResponse {
  items: StockAlert[];
}

// O material não tem página própria de saldo: o filamento todo mora em /inventory.
export function stockHrefOf(alert: StockAlert): string {
  return alert.kind === "material" ? "/inventory" : `/inventory/items/${alert.id}`;
}
