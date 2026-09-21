import { Injectable } from '@nestjs/common';
import { PricingError } from './pricing.error.js';
import { roundCost, roundPriceUp } from './rounding.js';
import type { ChannelPrice, PricingInput, PricingResult } from './pricing.types.js';

// 1 - (margem + imposto + taxa) abaixo disso o divisor some ou fica negativo.
const MIN_DIVISOR = 1e-9;

// Serviço puro e sem estado: nada de banco, rede ou relógio. Os valores ficam exatos
// até o último passo, e só o resultado sai arredondado.
@Injectable()
export class PricingService {
  calculate(input: PricingInput): PricingResult {
    const divisors = this.channelDivisors(input);

    const material =
      input.materials.reduce((sum, item) => sum + item.grams * item.costPerGramCents, 0) *
      (1 + input.purgeRate);
    const energy =
      (input.printer.powerWatts / 1000) * input.printHours * input.energyTariffCentsPerKwh;
    const depreciation =
      (input.printer.costCents / input.printer.lifespanHours) * input.printHours;
    const maintenance = input.maintenanceCentsPerHour * input.printHours;
    const labor =
      ((input.labor.prepHours + input.labor.slicingHours) / input.quantity +
        input.labor.postProcessingHours) *
      input.labor.centsPerHour;
    const supplies = input.supplies.reduce(
      (sum, item) => sum + item.quantity * item.unitCostCents,
      0,
    );
    const fixedCosts =
      (input.fixedCosts.monthlyCents / input.fixedCosts.productiveHoursPerMonth) *
      input.printHours;

    const direct = material + energy + depreciation + maintenance + labor + supplies + fixedCosts;
    const withRisk = direct * (1 + input.failureRate);

    return {
      quantity: input.quantity,
      costs: {
        materialCents: roundCost(material),
        energyCents: roundCost(energy),
        depreciationCents: roundCost(depreciation),
        maintenanceCents: roundCost(maintenance),
        laborCents: roundCost(labor),
        suppliesCents: roundCost(supplies),
        fixedCostsCents: roundCost(fixedCosts),
        directCostCents: roundCost(direct),
        costWithRiskCents: roundCost(withRisk),
      },
      channels: input.channels.map((channel, index) =>
        this.priceChannel(
          channel.name,
          roundPriceUp(withRisk / divisors[index]),
          input.quantity,
          input.minimumOrderCents,
        ),
      ),
    };
  }

  // Valida canais duplicados e taxas antes de calcular qualquer coisa.
  private channelDivisors(input: PricingInput): number[] {
    const seen = new Set<string>();
    return input.channels.map((channel) => {
      if (seen.has(channel.name)) {
        throw new PricingError(`Duplicate channel name: "${channel.name}"`);
      }
      seen.add(channel.name);
      const divisor = 1 - input.marginRate - input.taxRate - channel.feeRate;
      if (divisor < MIN_DIVISOR) {
        throw new PricingError(
          `Channel "${channel.name}": margin + taxes + fee must be below 100%`,
        );
      }
      return divisor;
    });
  }

  private priceChannel(
    name: string,
    calculatedUnitCents: number,
    quantity: number,
    minimumOrderCents: number,
  ): ChannelPrice {
    const minimumPriceApplied = calculatedUnitCents * quantity < minimumOrderCents;
    const unitPriceCents = minimumPriceApplied
      ? roundPriceUp(minimumOrderCents / quantity)
      : calculatedUnitCents;
    return {
      name,
      unitPriceCents,
      totalPriceCents: unitPriceCents * quantity,
      minimumPriceApplied,
    };
  }
}
