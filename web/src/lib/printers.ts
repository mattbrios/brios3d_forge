// Contrato de GET/POST/PATCH /printers (Fase 7).
export interface Nozzle {
  diameterMm: number;
  type: string;
}

export interface Printer {
  id: string;
  name: string;
  acquisitionCostCents: number;
  lifespanHours: number;
  powerWatts: number;
  hourmeterHours: number;
  nozzles: Nozzle[];
  hasAms: boolean;
  amsSlots: number | null;
  active: boolean;
}

export interface PrintersPage {
  items: Printer[];
  total: number;
  page: number;
  pageSize: number;
}
