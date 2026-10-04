import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Max, Min } from 'class-validator';
import { INVALID_COLOR_HEX } from '../materials.types.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// O tom é gravado sempre minúsculo; o @Matches roda depois, sobre o valor já convertido.
export const lowercase = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value);
export const COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/;

export class CreateMaterialDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 40)
  type: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  brand: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  color: string;

  // (0, 10] g/cm3 (AC 1, AC 2).
  @IsNumber()
  @IsPositive()
  @Max(10)
  densityGCm3: number;

  // [0, 500] °C (AC 1, AC 2).
  @IsNumber()
  @Min(0)
  @Max(500)
  nozzleTempC: number;

  // [0, 150] °C (AC 1, AC 2).
  @IsNumber()
  @Min(0)
  @Max(150)
  bedTempC: number;

  // Fase 11, door 1: piso opcional em gramas; omitir grava `null` ("sem política de reposição").
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStockGrams?: number | null;

  // Tom opcional `#rrggbb`; omitir ou `null` grava "sem tom".
  @IsOptional()
  @Transform(lowercase)
  @Matches(COLOR_HEX_PATTERN, { message: INVALID_COLOR_HEX })
  colorHex?: string | null;
}
