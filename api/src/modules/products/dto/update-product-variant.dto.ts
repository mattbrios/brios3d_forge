import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from './create-product.dto.js';
import {
  MAX_MATERIAL_LINES,
  MAX_SUPPLY_LINES,
  VariantMaterialDto,
  VariantSupplyDto,
} from './create-product-variant.dto.js';

// Campos de POST, todos opcionais, mais `active`. `materials`/`supplies` enviados substituem a
// lista inteira; omitidos preservam a lista gravada (AC 17).
export class UpdateProductVariantDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prepHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slicingHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  postProcessingHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MATERIAL_LINES)
  @ValidateNested({ each: true })
  @Type(() => VariantMaterialDto)
  materials?: VariantMaterialDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SUPPLY_LINES)
  @ValidateNested({ each: true })
  @Type(() => VariantSupplyDto)
  supplies?: VariantSupplyDto[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
