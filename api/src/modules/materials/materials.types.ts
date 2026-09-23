import type { Material } from './entities/material.entity.js';

// Contrato de GET/POST/PATCH /materials.
export interface MaterialResponse {
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

export interface ListMaterialsResponse {
  items: MaterialResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function toMaterialResponse(material: Material): MaterialResponse {
  return {
    id: material.id,
    type: material.type,
    brand: material.brand,
    color: material.color,
    densityGCm3: material.densityGCm3,
    nozzleTempC: material.nozzleTempC,
    bedTempC: material.bedTempC,
    needsDrying: material.needsDrying,
    dryingTemperatureC: material.dryingTemperatureC,
    dryingHours: material.dryingHours,
    active: material.active,
  };
}

export const MATERIAL_NOT_FOUND = 'Material não encontrado';
export const INVALID_DRYING_PARAMS =
  'Informe dryingTemperatureC entre 0 e 120 e dryingHours maior que 0 quando needsDrying for true';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
