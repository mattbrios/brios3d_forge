import { HttpException, Injectable } from '@nestjs/common';
import type { CreateQuotePreviewDto } from '../pricing/dto/create-quote-preview.dto.js';
import { PricingError } from '../pricing/pricing.error.js';
import { QuotePreviewService } from '../pricing/quote-preview.service.js';
import { SalesChannelsService } from '../settings/sales-channels.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { ProductsService } from './products.service.js';
import type { ProductPricingResponse, ProductVariantResponse, VariantPricingEntry } from './products.types.js';

// Door 1 e door 2: traduz cada ficha ativa num CreateQuotePreviewDto e deixa o
// QuotePreviewService (Fase 12) resolver custo médio, impressora, configurações e canais. Nada
// aqui persiste (AD-024): o custo é sempre o do momento da chamada.
@Injectable()
export class ProductPricingService {
  constructor(
    private readonly products: ProductsService,
    private readonly quotePreview: QuotePreviewService,
    private readonly settings: SettingsService,
    private readonly salesChannels: SalesChannelsService,
  ) {}

  async pricing(productId: string): Promise<ProductPricingResponse> {
    const product = await this.products.getById(productId);
    const active = product.variants.filter((variant) => variant.active);
    if (active.length === 0) {
      return { variants: [] };
    }
    const [settings, channels] = await Promise.all([this.settings.get(), this.salesChannels.list()]);
    const channelIds = channels.filter((channel) => channel.active).map((channel) => channel.id);
    const variants = await Promise.all(
      active.map((variant) => this.priceVariant(variant, channelIds, settings.laborCentsPerHour)),
    );
    return { variants };
  }

  private async priceVariant(
    variant: ProductVariantResponse,
    channelIds: string[],
    laborCentsPerHour: number,
  ): Promise<VariantPricingEntry> {
    const dto: CreateQuotePreviewDto = {
      printerId: variant.printer.id,
      materials: variant.materials.map((line) => ({ materialId: line.materialId, grams: line.grams })),
      supplies: variant.supplies.map((line) => ({ stockItemId: line.stockItemId, quantity: line.quantity })),
      printHours: variant.printHours,
      labor: {
        prepHours: variant.prepHours,
        slicingHours: variant.slicingHours,
        postProcessingHours: variant.postProcessingHours,
        centsPerHour: laborCentsPerHour,
      },
      quantity: 1,
      channelIds,
    };
    try {
      const pricing = await this.quotePreview.preview(dto);
      return { variantId: variant.id, name: variant.name, pricing, error: null };
    } catch (error) {
      // AC 24: a falha de uma variação (sem custo médio, regra do pricing) fica nela. Qualquer
      // outra coisa é defeito e sobe como 500.
      if (error instanceof HttpException || error instanceof PricingError) {
        return { variantId: variant.id, name: variant.name, pricing: null, error: error.message };
      }
      throw error;
    }
  }
}
