import { HttpException } from '@nestjs/common';
import { r1 } from './fixtures/r1.js';
import { PricingError } from './pricing.error.js';
import { PricingService } from './pricing.service.js';
import type { PricingInput, PricingResult } from './pricing.types.js';

// Todos os números esperados vêm do plano (caso R1), escritos à mão.
describe('PricingService', () => {
  const service = new PricingService();

  const zeroed = (): PricingInput => ({
    ...r1(),
    printHours: 1,
    materials: [{ grams: 0, costPerGramCents: 0 }],
    printer: { powerWatts: 0, costCents: 0, lifespanHours: 1 },
    energyTariffCentsPerKwh: 0,
    maintenanceCentsPerHour: 0,
    labor: { prepHours: 0, slicingHours: 0, postProcessingHours: 0, centsPerHour: 0 },
    supplies: [],
    fixedCosts: { monthlyCents: 0, productiveHoursPerMonth: 1 },
    purgeRate: 0,
    failureRate: 0,
  });

  const moneyFields = (result: PricingResult): number[] => [
    ...Object.values(result.costs),
    ...result.channels.flatMap((channel) => [channel.unitPriceCents, channel.totalPriceCents]),
  ];

  const channel = (result: PricingResult, name: string) => {
    const found = result.channels.find((entry) => entry.name === name);
    if (!found) {
      throw new Error(`channel ${name} missing`);
    }
    return found;
  };

  describe('S1 cost components', () => {
    it('R1 material cost', () => {
      expect(service.calculate(r1()).costs.materialCents).toBe(1050);
    });

    it('R1 energy cost', () => {
      expect(service.calculate(r1()).costs.energyCents).toBe(100);
    });

    it('R1 depreciation cost', () => {
      expect(service.calculate(r1()).costs.depreciationCents).toBe(400);
    });

    it('R1 maintenance cost', () => {
      expect(service.calculate(r1()).costs.maintenanceCents).toBe(250);
    });

    it('R1 labor cost', () => {
      expect(service.calculate(r1()).costs.laborCents).toBe(3000);
    });

    it('R1 supplies cost', () => {
      expect(service.calculate(r1()).costs.suppliesCents).toBe(300);
    });

    it('R1 fixed costs', () => {
      expect(service.calculate(r1()).costs.fixedCostsCents).toBe(1000);
    });

    it('multimaterial sums before purge', () => {
      const input = r1();
      input.materials.push({ grams: 20, costPerGramCents: 15 });
      expect(service.calculate(input).costs.materialCents).toBe(1365);
    });

    it('empty supplies cost zero', () => {
      const input = r1();
      input.supplies = [];
      const { costs } = service.calculate(input);
      expect(costs.suppliesCents).toBe(0);
      expect(costs.materialCents).toBe(1050);
      expect(costs.energyCents).toBe(100);
      expect(costs.depreciationCents).toBe(400);
      expect(costs.maintenanceCents).toBe(250);
      expect(costs.laborCents).toBe(3000);
      expect(costs.fixedCostsCents).toBe(1000);
    });
  });

  describe('S2 direct cost, risk and channel price', () => {
    it('R1 direct cost', () => {
      expect(service.calculate(r1()).costs.directCostCents).toBe(6100);
    });

    it('R1 cost with risk', () => {
      expect(service.calculate(r1()).costs.costWithRiskCents).toBe(6710);
    });

    it('R1 unit price per channel', () => {
      const result = service.calculate(r1());
      expect(channel(result, 'Balcão').unitPriceCents).toBe(10485);
      expect(channel(result, 'Mercado Livre').unitPriceCents).toBe(13980);
    });

    it('channels keep input order', () => {
      const input = r1();
      input.channels = [
        { name: 'C', feeRate: 0 },
        { name: 'A', feeRate: 0 },
        { name: 'B', feeRate: 0 },
      ];
      const result = service.calculate(input);
      expect(result.channels.map((entry) => entry.name)).toEqual(['C', 'A', 'B']);
    });

    it('total is unit times quantity', () => {
      for (const quantity of [1, 3, 10]) {
        const input = r1();
        input.quantity = quantity;
        const result = service.calculate(input);
        for (const entry of result.channels) {
          expect(entry.totalPriceCents).toBe(entry.unitPriceCents * quantity);
        }
      }
    });

    it('batch of 10 dilutes prep and slicing', () => {
      const input = r1();
      input.quantity = 10;
      const result = service.calculate(input);
      expect(result.costs.laborCents).toBe(1650);
      expect(result.costs.directCostCents).toBe(4750);
      expect(result.costs.costWithRiskCents).toBe(5225);
      expect(channel(result, 'Balcão').unitPriceCents).toBe(8165);
      expect(channel(result, 'Balcão').totalPriceCents).toBe(81650);
    });
  });

  describe('S3 minimum order price', () => {
    it('minimum price raises a channel below the floor', () => {
      const input = r1();
      input.minimumOrderCents = 12000;
      const balcao = channel(service.calculate(input), 'Balcão');
      expect(balcao.unitPriceCents).toBe(12000);
      expect(balcao.totalPriceCents).toBe(12000);
      expect(balcao.minimumPriceApplied).toBe(true);
    });

    it('minimum price keeps a channel at or above the floor', () => {
      const above = r1();
      above.minimumOrderCents = 12000;
      const mercadoLivre = channel(service.calculate(above), 'Mercado Livre');
      expect(mercadoLivre.unitPriceCents).toBe(13980);
      expect(mercadoLivre.minimumPriceApplied).toBe(false);

      const equal = r1();
      equal.minimumOrderCents = 10485;
      const balcao = channel(service.calculate(equal), 'Balcão');
      expect(balcao.unitPriceCents).toBe(10485);
      expect(balcao.minimumPriceApplied).toBe(false);
    });

    it('minimum price per unit rounds up', () => {
      const input = r1();
      input.quantity = 3;
      input.minimumOrderCents = 100000;
      const balcao = channel(service.calculate(input), 'Balcão');
      expect(balcao.unitPriceCents).toBe(33334);
      expect(balcao.totalPriceCents).toBe(100002);
      expect(balcao.minimumPriceApplied).toBe(true);
    });
  });

  describe('S4 rounding', () => {
    it('every money field is an integer', () => {
      const batch = r1();
      batch.quantity = 3;
      const tenth = r1();
      tenth.quantity = 10;
      const floor = r1();
      floor.quantity = 3;
      floor.minimumOrderCents = 100000;
      for (const input of [r1(), batch, tenth, floor]) {
        for (const value of moneyFields(service.calculate(input))) {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    });

    it('half cent rounds up', () => {
      const input = r1();
      input.materials = [{ grams: 33, costPerGramCents: 10 }];
      input.purgeRate = 0.05;
      expect(service.calculate(input).costs.materialCents).toBe(347);
    });

    it('exact price is not bumped', () => {
      const input = zeroed();
      input.materials = [{ grams: 64, costPerGramCents: 100 }];
      input.channels = [{ name: 'Balcão', feeRate: 0 }];
      const result = service.calculate(input);
      expect(result.costs.costWithRiskCents).toBe(6400);
      expect(channel(result, 'Balcão').unitPriceCents).toBe(10000);
    });

    it('direct cost uses unrounded components', () => {
      const input = zeroed();
      input.printer = { powerWatts: 1000, costCents: 0, lifespanHours: 1 };
      input.energyTariffCentsPerKwh = 100.4;
      input.maintenanceCentsPerHour = 100.4;
      const { costs } = service.calculate(input);
      expect(costs.energyCents).toBe(100);
      expect(costs.maintenanceCents).toBe(100);
      expect(costs.directCostCents).toBe(201);
    });
  });

  describe('S5 domain rules', () => {
    it('rates summing to 100% throw PricingError', () => {
      const atLimit = r1();
      atLimit.marginRate = 0.5;
      atLimit.taxRate = 0.3;
      atLimit.channels = [{ name: 'Balcão', feeRate: 0.2 }];
      expect(() => service.calculate(atLimit)).toThrow(PricingError);
      expect(() => service.calculate(atLimit)).toThrow(
        'Channel "Balcão": margin + taxes + fee must be below 100%',
      );

      const below = r1();
      below.marginRate = 0.5;
      below.taxRate = 0.3;
      below.channels = [{ name: 'Balcão', feeRate: 0.19 }];
      expect(() => service.calculate(below)).not.toThrow();
    });

    it('duplicate channel name throws PricingError', () => {
      const input = r1();
      input.channels = [
        { name: 'Balcão', feeRate: 0 },
        { name: 'Balcão', feeRate: 0.1 },
      ];
      expect(() => service.calculate(input)).toThrow(PricingError);
      expect(() => service.calculate(input)).toThrow('Duplicate channel name: "Balcão"');
    });

    it('domain errors are not http exceptions', () => {
      const rates = r1();
      rates.marginRate = 0.5;
      rates.taxRate = 0.3;
      rates.channels = [{ name: 'Balcão', feeRate: 0.2 }];
      const duplicate = r1();
      duplicate.channels = [
        { name: 'Balcão', feeRate: 0 },
        { name: 'Balcão', feeRate: 0 },
      ];
      for (const input of [rates, duplicate]) {
        let thrown: unknown;
        try {
          service.calculate(input);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(PricingError);
        expect(thrown).not.toBeInstanceOf(HttpException);
      }
    });

    it('pure and constructible without dependencies', () => {
      const fresh = new PricingService();
      const input = r1();
      const before = structuredClone(input);
      const first = fresh.calculate(input);
      const second = fresh.calculate(structuredClone(before));
      expect(first.costs.directCostCents).toBe(6100);
      expect(second).toEqual(first);
      expect(input).toEqual(before);
    });
  });
});
