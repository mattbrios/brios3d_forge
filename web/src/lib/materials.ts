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
  // Fase 11: piso de reposição em gramas, somando os rolos; null é "sem mínimo".
  minimumStockGrams: number | null;
}

export interface MaterialsPage {
  items: Material[];
  total: number;
  page: number;
  pageSize: number;
}
