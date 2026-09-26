import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from './create-product.dto.js';

// A ficha recebe ids do cadastro, nunca custo (AC 21, AD-024).
export class VariantMaterialDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @IsPositive()
  grams: number;
}

export class VariantSupplyDto {
  @IsUUID()
  stockItemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export const MAX_MATERIAL_LINES = 32;
export const MAX_SUPPLY_LINES = 50;

export class CreateProductVariantDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsUUID()
  printerId: string;

  @IsNumber()
  @Min(0)
  printHours: number;

  @IsNumber()
  @Min(0)
  prepHours: number;

  @IsNumber()
  @Min(0)
  slicingHours: number;

  @IsNumber()
  @Min(0)
  postProcessingHours: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MATERIAL_LINES)
  @ValidateNested({ each: true })
  @Type(() => VariantMaterialDto)
  materials: VariantMaterialDto[];

  // Omitir é o mesmo que uma ficha sem insumo.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SUPPLY_LINES)
  @ValidateNested({ each: true })
  @Type(() => VariantSupplyDto)
  supplies?: VariantSupplyDto[];
}
