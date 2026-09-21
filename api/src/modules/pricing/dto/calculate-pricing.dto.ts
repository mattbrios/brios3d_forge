import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  ChannelInput,
  FixedCostsInput,
  LaborInput,
  MaterialInput,
  PricingInput,
  PrinterInput,
  SupplyInput,
} from '../pricing.types.js';
import { IsBelowOne } from './is-below-one.decorator.js';

export class MaterialDto implements MaterialInput {
  @IsNumber()
  @Min(0)
  grams: number;

  @IsNumber()
  @Min(0)
  costPerGramCents: number;
}

export class PrinterDto implements PrinterInput {
  @IsNumber()
  @Min(0)
  powerWatts: number;

  @IsNumber()
  @Min(0)
  costCents: number;

  // Divisor da depreciação: zero é recusado.
  @IsNumber()
  @IsPositive()
  lifespanHours: number;
}

export class LaborDto implements LaborInput {
  @IsNumber()
  @Min(0)
  prepHours: number;

  @IsNumber()
  @Min(0)
  slicingHours: number;

  @IsNumber()
  @Min(0)
  postProcessingHours: number;

  @IsNumber()
  @Min(0)
  centsPerHour: number;
}

export class SupplyDto implements SupplyInput {
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCostCents: number;
}

export class FixedCostsDto implements FixedCostsInput {
  @IsNumber()
  @Min(0)
  monthlyCents: number;

  // Divisor dos custos fixos: zero é recusado.
  @IsNumber()
  @IsPositive()
  productiveHoursPerMonth: number;
}

export class ChannelDto implements ChannelInput {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsNumber()
  @Min(0)
  @IsBelowOne()
  feeRate: number;
}

export class CalculatePricingDto implements PricingInput {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  printHours: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => MaterialDto)
  materials: MaterialDto[];

  @ValidateNested()
  @Type(() => PrinterDto)
  printer: PrinterDto;

  @IsNumber()
  @Min(0)
  energyTariffCentsPerKwh: number;

  @IsNumber()
  @Min(0)
  maintenanceCentsPerHour: number;

  @ValidateNested()
  @Type(() => LaborDto)
  labor: LaborDto;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SupplyDto)
  supplies: SupplyDto[];

  @ValidateNested()
  @Type(() => FixedCostsDto)
  fixedCosts: FixedCostsDto;

  @IsNumber()
  @Min(0)
  @Max(1)
  purgeRate: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  failureRate: number;

  @IsNumber()
  @Min(0)
  @IsBelowOne()
  marginRate: number;

  @IsNumber()
  @Min(0)
  @IsBelowOne()
  taxRate: number;

  @IsNumber()
  @Min(0)
  minimumOrderCents: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChannelDto)
  channels: ChannelDto[];
}
