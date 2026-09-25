// Contrato de POST /pricing/quote-preview (espelha api/src/modules/pricing/quote-preview.types.ts).

export interface CostBreakdown {
  materialCents: number;
  energyCents: number;
  depreciationCents: number;
  maintenanceCents: number;
  laborCents: number;
  suppliesCents: number;
  fixedCostsCents: number;
  directCostCents: number;
  costWithRiskCents: number;
}

export interface QuotePreviewChannelPrice {
  id: string;
  name: string;
  unitPriceCents: number;
  totalPriceCents: number;
  minimumPriceApplied: boolean;
}

export interface QuotePreviewMaterial {
  materialId: string;
  name: string;
  avgCostCentsPerGram: number;
}

export interface QuotePreviewSupply {
  stockItemId: string;
  name: string;
  avgCostCents: number;
}

export interface QuotePreviewResult {
  quantity: number;
  costs: CostBreakdown;
  channels: QuotePreviewChannelPrice[];
  printer: { id: string; name: string };
  materials: QuotePreviewMaterial[];
  supplies: QuotePreviewSupply[];
}

// Corpo de POST /pricing/quote-preview: ids do cadastro, nunca custo digitado (door 1, Fase 12).
export interface QuotePreviewRequest {
  printerId: string;
  materials: { materialId: string; grams: number }[];
  supplies: { stockItemId: string; quantity: number }[];
  printHours: number;
  labor: { prepHours: number; slicingHours: number; postProcessingHours: number; centsPerHour: number };
  quantity: number;
  channelIds: string[];
  minimumOrderCents?: number;
}
