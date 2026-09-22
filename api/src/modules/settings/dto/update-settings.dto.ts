import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsBelowOne } from '../../pricing/dto/is-below-one.decorator.js';

export class FixedCostItemDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsNumber()
  @Min(0)
  monthlyCents: number;
}

// Todos os campos opcionais (PATCH), mas pelo menos um precisa vir - conferido no serviço.
// `fixedCostItems`, quando vem, substitui a lista inteira (door 2).
export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  energyTariffCentsPerKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCentsPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsBelowOne()
  defaultMarginRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsBelowOne()
  failureRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsBelowOne()
  purgeRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceCentsPerHour?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  productiveHoursPerMonth?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FixedCostItemDto)
  fixedCostItems?: FixedCostItemDto[];
}
