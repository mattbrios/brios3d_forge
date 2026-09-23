import { r1 } from '../pricing/fixtures/r1.js';
import { PricingService } from '../pricing/pricing.service.js';
import type { PricingInput } from '../pricing/pricing.types.js';
import type { Printer } from './entities/printer.entity.js';
import { toPricingPrinterInput } from './printers.types.js';

function printer(overrides: Partial<Printer> = {}): Printer {
  return {
    id: 'p1',
    name: 'X2D',
    acquisitionCostCents: 500000,
    lifespanHours: 10000,
    powerWatts: 250,
    hourmeterHours: 0,
    nozzles: [{ diameterMm: 0.4, type: 'Hardened Steel' }],
    hasAms: false,
    amsSlots: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('toPricingPrinterInput', () => {
  it('maps printer fields to PrinterInput without conversion', () => {
    const result = toPricingPrinterInput(
      printer({ powerWatts: 250, acquisitionCostCents: 500000, lifespanHours: 10000 }),
    );
    expect(result).toEqual({ powerWatts: 250, costCents: 500000, lifespanHours: 10000 });
  });

  it('produces the same pricing result as a manually typed PrinterInput', () => {
    const service = new PricingService();
    const fromPrinter: PricingInput = {
      ...r1(),
      printer: toPricingPrinterInput(
        printer({ powerWatts: 250, acquisitionCostCents: 500000, lifespanHours: 10000 }),
      ),
    };
    const typedByHand: PricingInput = {
      ...r1(),
      printer: { powerWatts: 250, costCents: 500000, lifespanHours: 10000 },
    };

    const resultFromPrinter = service.calculate(fromPrinter);
    const resultTypedByHand = service.calculate(typedByHand);

    expect(resultFromPrinter.costs.depreciationCents).toBe(resultTypedByHand.costs.depreciationCents);
    expect(resultFromPrinter.costs.energyCents).toBe(resultTypedByHand.costs.energyCents);
  });
});
