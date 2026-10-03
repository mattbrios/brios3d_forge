import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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
}
