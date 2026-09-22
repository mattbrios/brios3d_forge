// Contrato de GET/POST/PATCH /sales-channels (Fase 5).
export interface SalesChannel {
  id: string;
  name: string;
  taxRate: number;
  feeRate: number;
  active: boolean;
}
