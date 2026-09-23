// Contrato de GET/POST/PATCH /materials (Fase 6).
export interface Material {
  id: string;
  type: string;
  brand: string;
  color: string;
  densityGCm3: number;
  nozzleTempC: number;
  bedTempC: number;
  needsDrying: boolean;
  dryingTemperatureC: number | null;
  dryingHours: number | null;
  active: boolean;
}

export interface MaterialsPage {
  items: Material[];
  total: number;
  page: number;
  pageSize: number;
}
