import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { LaborDto } from './calculate-pricing.dto.js';

// Door 1 (plano): a entrada recebe ids do cadastro, nunca o custo bruto (AD-024). O custo por
// grama/unidade é sempre resolvido pelo QuotePreviewService a partir do custo médio atual.
export class QuoteMaterialDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @IsPositive()
  grams: number;
}

export class QuoteSupplyDto {
  @IsUUID()
  stockItemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateQuotePreviewDto {
  @IsUUID()
  printerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => QuoteMaterialDto)
  materials: QuoteMaterialDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteSupplyDto)
  supplies: QuoteSupplyDto[];

  @IsNumber()
  @Min(0)
  printHours: number;

  @ValidateNested()
  @Type(() => LaborDto)
  labor: LaborDto;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  channelIds: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderCents?: number;
}
