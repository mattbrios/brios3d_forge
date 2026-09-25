import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CalculatePricingDto } from './dto/calculate-pricing.dto.js';
import { CreateQuotePreviewDto } from './dto/create-quote-preview.dto.js';
import { PricingError } from './pricing.error.js';
import { PricingService } from './pricing.service.js';
import type { PricingResult } from './pricing.types.js';
import { QuotePreviewService } from './quote-preview.service.js';
import type { QuotePreviewResult } from './quote-preview.types.js';

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly quotePreviewService: QuotePreviewService,
  ) {}

  // Sem estado: tudo chega no corpo e nada é gravado. POST sem criar recurso responde 200.
  // Todo papel chega aqui (Fase 4, door 1): vendas orça, produção confere o custo.
  @Roles('production', 'sales')
  @Post('calculate')
  @HttpCode(200)
  calculate(@Body() dto: CalculatePricingDto): PricingResult {
    try {
      return this.pricingService.calculate(dto);
    } catch (error) {
      if (error instanceof PricingError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // Fase 12: mesma política de papéis de /pricing/calculate. Os erros de "id não encontrado" e
  // "custo médio ausente" (NotFoundException/BadRequestException) já saem prontos do
  // QuotePreviewService; só a PricingError do cálculo puro precisa ser convertida aqui.
  @Roles('production', 'sales')
  @Post('quote-preview')
  @HttpCode(200)
  async quotePreview(@Body() dto: CreateQuotePreviewDto): Promise<QuotePreviewResult> {
    try {
      return await this.quotePreviewService.preview(dto);
    } catch (error) {
      if (error instanceof PricingError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
