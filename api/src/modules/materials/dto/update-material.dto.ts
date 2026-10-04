import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { INVALID_COLOR_HEX } from '../materials.types.js';
import { COLOR_HEX_PATTERN, lowercase } from './create-material.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Campos opcionais (PATCH).
export class UpdateMaterialDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 40)
  type?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  brand?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  color?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(10)
  densityGCm3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  nozzleTempC?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(150)
  bedTempC?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Fase 11, door 1: primeiro campo do sistema em que `undefined` e `null` significam coisas
  // diferentes num PATCH - omitir preserva o piso, `null` explícito limpa a política. O
  // `@IsOptional()` do class-validator deixa `null` passar, e o serviço distingue os dois.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStockGrams?: number | null;

  // Mesma semântica do mínimo: omitir preserva o tom, `null` remove.
  @IsOptional()
  @Transform(lowercase)
  @Matches(COLOR_HEX_PATTERN, { message: INVALID_COLOR_HEX })
  colorHex?: string | null;
}
