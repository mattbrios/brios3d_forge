// Dinheiro em centavos (sufixo Cents), percentuais como fração (sufixo Rate),
// horas decimais e pesos em gramas. Veja a door 1 do plano da Fase 1.
export interface MaterialInput {
  grams: number;
  costPerGramCents: number;
}

export interface PrinterInput {
  powerWatts: number;
  costCents: number;
  lifespanHours: number;
}

export interface LaborInput {
  prepHours: number;
  slicingHours: number;
  postProcessingHours: number;
  centsPerHour: number;
}

export interface SupplyInput {
  quantity: number;
  unitCostCents: number;
}

export interface FixedCostsInput {
  monthlyCents: number;
  productiveHoursPerMonth: number;
}

export interface ChannelInput {
  name: string;
  feeRate: number;
}

// printHours, materials e supplies descrevem uma unidade; quantity só multiplica e dilui o lote.
export interface PricingInput {
  quantity: number;
  printHours: number;
  materials: MaterialInput[];
  printer: PrinterInput;
  energyTariffCentsPerKwh: number;
  maintenanceCentsPerHour: number;
  labor: LaborInput;
  supplies: SupplyInput[];
  fixedCosts: FixedCostsInput;
  purgeRate: number;
  failureRate: number;
  marginRate: number;
  taxRate: number;
  minimumOrderCents: number;
  channels: ChannelInput[];
}

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

export interface ChannelPrice {
  name: string;
  unitPriceCents: number;
  totalPriceCents: number;
  minimumPriceApplied: boolean;
}

export interface PricingResult {
  quantity: number;
  costs: CostBreakdown;
  channels: ChannelPrice[];
}
