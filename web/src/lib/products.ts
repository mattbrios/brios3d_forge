import type { QuotePreviewResult } from "./pricing";

// Contrato de /products* (Fase 13; espelha api/src/modules/products/products.types.ts).
export type ModelPlatform = "printables" | "makerworld" | "thingiverse";

export const PLATFORM_LABELS: Record<ModelPlatform, string> = {
  printables: "Printables",
  makerworld: "MakerWorld",
  thingiverse: "Thingiverse",
};

export interface ProductSummary {
  id: string;
  name: string;
  description: string | null;
  modelUrl: string;
  modelPlatform: ModelPlatform;
  modelExternalId: string;
  modelTitle: string | null;
  modelImageUrl: string | null;
  modelDesigner: string | null;
  modelLicense: string | null;
  // Door 5: false proíbe (aviso), true permite, null é "não informado".
  commercialUseAllowed: boolean | null;
  modelMetadataFetchedAt: string | null;
  active: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  printer: { id: string; name: string };
  printHours: number;
  prepHours: number;
  slicingHours: number;
  postProcessingHours: number;
  active: boolean;
  materials: { materialId: string; name: string; grams: number }[];
  supplies: { stockItemId: string; name: string; quantity: number }[];
}

export interface Product extends ProductSummary {
  variants: ProductVariant[];
}

export interface ProductsPage {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Door 2: uma entrada por variação ativa, com `pricing` ou `error`.
export interface VariantPricing {
  variantId: string;
  name: string;
  pricing: QuotePreviewResult | null;
  error: string | null;
}

export interface ProductPricing {
  variants: VariantPricing[];
}

// Corpo de POST/PATCH /products: só os campos declarados no contrato.
export interface ProductBody {
  name: string;
  modelUrl: string;
  description: string | null;
  modelTitle: string | null;
  modelImageUrl: string | null;
  modelDesigner: string | null;
  modelLicense: string | null;
  commercialUseAllowed: boolean | null;
}

// Corpo de POST/PATCH /products/:id/variants: ids, gramas, quantidades e horas, nunca custo.
export interface VariantBody {
  name: string;
  printerId: string;
  printHours: number;
  prepHours: number;
  slicingHours: number;
  postProcessingHours: number;
  materials: { materialId: string; grams: number }[];
  supplies: { stockItemId: string; quantity: number }[];
}
