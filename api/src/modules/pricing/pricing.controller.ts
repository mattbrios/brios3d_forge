import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CalculatePricingDto } from './dto/calculate-pricing.dto.js';
import { PricingError } from './pricing.error.js';
import { PricingService } from './pricing.service.js';
import type { PricingResult } from './pricing.types.js';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

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
}
