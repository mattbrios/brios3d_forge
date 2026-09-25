import { BadRequestException } from '@nestjs/common';
import { r1 } from './fixtures/r1.js';
import { CalculatePricingDto } from './dto/calculate-pricing.dto.js';
import { PricingController } from './pricing.controller.js';
import { PricingError } from './pricing.error.js';
import type { PricingService } from './pricing.service.js';
import type { PricingResult } from './pricing.types.js';
import type { QuotePreviewService } from './quote-preview.service.js';

// Serviço da rota nova (Fase 12) não é exercitado por este spec (tem o próprio); um stub
// mínimo basta para instanciar o controller.
const stubQuotePreviewService = {} as unknown as QuotePreviewService;

describe('PricingController', () => {
  const dto = r1() as CalculatePricingDto;

  it('PricingError becomes BadRequestException', () => {
    const service = {
      calculate: () => {
        throw new PricingError('Duplicate channel name: "Balcão"');
      },
    } as unknown as PricingService;
    const controller = new PricingController(service, stubQuotePreviewService);

    let thrown: unknown;
    try {
      controller.calculate(dto);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getStatus()).toBe(400);
    expect((thrown as BadRequestException).message).toBe('Duplicate channel name: "Balcão"');
  });

  it('other errors are not converted', () => {
    const boom = new Error('boom');
    const service = {
      calculate: () => {
        throw boom;
      },
    } as unknown as PricingService;
    expect(() => new PricingController(service, stubQuotePreviewService).calculate(dto)).toThrow(boom);
  });

  it('returns the service result untouched', () => {
    const result: PricingResult = {
      quantity: 1,
      costs: {
        materialCents: 1,
        energyCents: 2,
        depreciationCents: 3,
        maintenanceCents: 4,
        laborCents: 5,
        suppliesCents: 6,
        fixedCostsCents: 7,
        directCostCents: 8,
        costWithRiskCents: 9,
      },
      channels: [],
    };
    const service = { calculate: () => result } as unknown as PricingService;
    expect(new PricingController(service, stubQuotePreviewService).calculate(dto)).toBe(result);
  });
});
