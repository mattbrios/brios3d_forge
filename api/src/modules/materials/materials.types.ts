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
  active: boolean;
  // Fase 11, door 1: piso de reposição em gramas; `null` é "sem política de reposição".
  minimumStockGrams: number | null;
  // Tom da cor: `#rrggbb` minúsculo, ou `null` para "sem tom".
  colorHex: string | null;
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
    active: material.active,
    minimumStockGrams: material.minimumStockGrams,
    colorHex: material.colorHex,
  };
}

export const MATERIAL_NOT_FOUND = 'Material não encontrado';
export const INVALID_COLOR_HEX = 'colorHex deve estar no formato #rrggbb';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
