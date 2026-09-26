import type { QuotePreviewResult } from '../pricing/quote-preview.types.js';
import type { ModelPlatform, Product } from './entities/product.entity.js';
import type { ProductVariant } from './entities/product-variant.entity.js';

// Contrato de GET /products (item da lista), sem as variações.
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
  commercialUseAllowed: boolean | null;
  modelMetadataFetchedAt: string | null;
  active: boolean;
}

export interface VariantMaterialResponse {
  materialId: string;
  name: string;
  grams: number;
}

export interface VariantSupplyResponse {
  stockItemId: string;
  name: string;
  quantity: number;
}

// Contrato de POST/PATCH /products/:id/variants e de cada item de `variants` do detalhe.
export interface ProductVariantResponse {
  id: string;
  productId: string;
  name: string;
  printer: { id: string; name: string };
  printHours: number;
  prepHours: number;
  slicingHours: number;
  postProcessingHours: number;
  active: boolean;
  materials: VariantMaterialResponse[];
  supplies: VariantSupplyResponse[];
}

// Contrato de POST/GET/PATCH /products/:id.
export interface ProductResponse extends ProductSummary {
  variants: ProductVariantResponse[];
}

export interface ListProductsResponse {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Door 2: uma entrada por variação ativa, com `pricing` ou `error`, nunca os dois.
export interface VariantPricingEntry {
  variantId: string;
  name: string;
  pricing: QuotePreviewResult | null;
  error: string | null;
}

export interface ProductPricingResponse {
  variants: VariantPricingEntry[];
}

export function materialDisplayName(material: { type: string; brand: string; color: string }): string {
  return `${material.type} · ${material.brand} · ${material.color}`;
}

export function toProductSummary(product: Product): ProductSummary {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    modelUrl: product.modelUrl,
    modelPlatform: product.modelPlatform,
    modelExternalId: product.modelExternalId,
    modelTitle: product.modelTitle,
    modelImageUrl: product.modelImageUrl,
    modelDesigner: product.modelDesigner,
    modelLicense: product.modelLicense,
    commercialUseAllowed: product.commercialUseAllowed,
    modelMetadataFetchedAt: product.modelMetadataFetchedAt ? product.modelMetadataFetchedAt.toISOString() : null,
    active: product.active,
  };
}

// Espera a variação carregada com `printer`, `materials.material` e `supplies.stockItem`.
export function toVariantResponse(variant: ProductVariant): ProductVariantResponse {
  return {
    id: variant.id,
    productId: variant.productId,
    name: variant.name,
    printer: { id: variant.printer.id, name: variant.printer.name },
    printHours: variant.printHours,
    prepHours: variant.prepHours,
    slicingHours: variant.slicingHours,
    postProcessingHours: variant.postProcessingHours,
    active: variant.active,
    materials: [...variant.materials]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({ materialId: line.materialId, name: materialDisplayName(line.material), grams: line.grams })),
    supplies: [...variant.supplies]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({ stockItemId: line.stockItemId, name: line.stockItem.name, quantity: line.quantity })),
  };
}

export const INVALID_MODEL_URL =
  'URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse';
export const DUPLICATE_MODEL = 'Já existe um produto para este modelo';
export const PRODUCT_NOT_FOUND = 'Produto não encontrado';
export const VARIANT_NOT_FOUND = 'Variação não encontrada';
export const DUPLICATE_VARIANT_NAME = 'Já existe uma variação com este nome neste produto';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
