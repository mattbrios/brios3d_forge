import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CreateQuotePreviewDto } from '../pricing/dto/create-quote-preview.dto.js';
import { PricingError } from '../pricing/pricing.error.js';
import type { QuotePreviewService } from '../pricing/quote-preview.service.js';
import type { QuotePreviewResult } from '../pricing/quote-preview.types.js';
import type { SalesChannelsService } from '../settings/sales-channels.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import { ProductPricingService } from './product-pricing.service.js';
import type { ProductsService } from './products.service.js';
import type { ProductResponse, ProductVariantResponse } from './products.types.js';

const ACTIVE_CHANNEL = 'c0000000-0000-0000-0000-000000000001';
const INACTIVE_CHANNEL = 'c0000000-0000-0000-0000-000000000002';

function variant(overrides: Partial<ProductVariantResponse>): ProductVariantResponse {
  return {
    id: 'v-ativa',
    productId: 'p',
    name: 'Laranja',
    printer: { id: 'printer-1', name: 'Impressora' },
    printHours: 0.47,
    prepHours: 0.5,
    slicingHours: 0.25,
    postProcessingHours: 0.25,
    active: true,
    materials: [{ materialId: 'm-1', name: 'PLA · X · Laranja', grams: 8 }],
    supplies: [{ stockItemId: 's-1', name: 'Argola', quantity: 2 }],
    ...overrides,
  };
}

const FAKE_RESULT = { quantity: 1 } as unknown as QuotePreviewResult;

function build(variants: ProductVariantResponse[], preview: (dto: CreateQuotePreviewDto) => Promise<QuotePreviewResult>) {
  const calls: CreateQuotePreviewDto[] = [];
  const products = {
    getById: async () => ({ id: 'p', variants }) as unknown as ProductResponse,
  } as unknown as ProductsService;
  const quotePreview = {
    preview: async (dto: CreateQuotePreviewDto) => {
      calls.push(dto);
      return preview(dto);
    },
  } as unknown as QuotePreviewService;
  const settings = { get: async () => ({ laborCentsPerHour: 3000 }) } as unknown as SettingsService;
  const salesChannels = {
    list: async () => [
      { id: ACTIVE_CHANNEL, name: 'Balcão', taxRate: 0, feeRate: 0, active: true },
      { id: INACTIVE_CHANNEL, name: 'Antigo', taxRate: 0, feeRate: 0, active: false },
    ],
  } as unknown as SalesChannelsService;
  return { service: new ProductPricingService(products, quotePreview, settings, salesChannels), calls };
}

// C31: um caso por ramo da tabela de decisão do serviço de preço do produto.
describe('ProductPricingService', () => {
  it('(a) an inactive variant never reaches preview', async () => {
    const { service, calls } = build(
      [variant({ id: 'v-inativa', name: 'Preto', active: false }), variant({})],
      async () => FAKE_RESULT,
    );
    const response = await service.pricing('p');
    expect(calls).toHaveLength(1);
    expect(response.variants.map((entry) => entry.variantId)).toEqual(['v-ativa']);
  });

  it('(b) sends quantity 1, only active channels, the settings labor rate and no minimumOrderCents', async () => {
    const { service, calls } = build([variant({})], async () => FAKE_RESULT);
    const response = await service.pricing('p');
    expect(calls).toEqual([
      {
        printerId: 'printer-1',
        materials: [{ materialId: 'm-1', grams: 8 }],
        supplies: [{ stockItemId: 's-1', quantity: 2 }],
        printHours: 0.47,
        labor: { prepHours: 0.5, slicingHours: 0.25, postProcessingHours: 0.25, centsPerHour: 3000 },
        quantity: 1,
        channelIds: [ACTIVE_CHANNEL],
      },
    ]);
    expect('minimumOrderCents' in calls[0]).toBe(false);
    expect(response.variants).toEqual([{ variantId: 'v-ativa', name: 'Laranja', pricing: FAKE_RESULT, error: null }]);
  });

  it('(c) an HttpException from preview becomes { pricing: null, error: message }', async () => {
    const bad = build([variant({})], async () => {
      throw new BadRequestException('x');
    });
    expect((await bad.service.pricing('p')).variants).toEqual([
      { variantId: 'v-ativa', name: 'Laranja', pricing: null, error: 'x' },
    ]);
    const notFound = build([variant({})], async () => {
      throw new NotFoundException('y');
    });
    expect((await notFound.service.pricing('p')).variants).toEqual([
      { variantId: 'v-ativa', name: 'Laranja', pricing: null, error: 'y' },
    ]);
  });

  it('(d) an error that is neither an HttpException nor a PricingError is rethrown', async () => {
    const defect = new Error('boom');
    const { service } = build([variant({})], async () => {
      throw defect;
    });
    await expect(service.pricing('p')).rejects.toBe(defect);
  });

  it('(e) a PricingError from preview becomes { pricing: null, error: message }', async () => {
    const { service } = build([variant({})], async () => {
      throw new PricingError('z');
    });
    expect((await service.pricing('p')).variants).toEqual([
      { variantId: 'v-ativa', name: 'Laranja', pricing: null, error: 'z' },
    ]);
  });
});
