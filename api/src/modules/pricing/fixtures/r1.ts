import type { PricingInput } from '../pricing.types.js';

// Caso de referência R1 do plano da Fase 1: só a entrada. Os valores esperados
// ficam escritos literalmente em cada teste, nunca calculados aqui.
export function r1(): PricingInput {
  return {
    quantity: 1,
    printHours: 5,
    materials: [{ grams: 100, costPerGramCents: 10 }],
    printer: { powerWatts: 250, costCents: 400000, lifespanHours: 5000 },
    energyTariffCentsPerKwh: 80,
    maintenanceCentsPerHour: 50,
    labor: { prepHours: 0.25, slicingHours: 0.25, postProcessingHours: 0.5, centsPerHour: 3000 },
    supplies: [
      { quantity: 2, unitCostCents: 50 },
      { quantity: 1, unitCostCents: 200 },
    ],
    fixedCosts: { monthlyCents: 60000, productiveHoursPerMonth: 300 },
    purgeRate: 0.05,
    failureRate: 0.1,
    marginRate: 0.3,
    taxRate: 0.06,
    minimumOrderCents: 0,
    channels: [
      { name: 'Balcão', feeRate: 0 },
      { name: 'Mercado Livre', feeRate: 0.16 },
    ],
  };
}
