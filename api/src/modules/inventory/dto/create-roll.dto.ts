import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRollDto {
  @IsUUID()
  materialId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // > 0 (AC 4).
  @IsNumber()
  @IsPositive()
  initialWeightGrams: number;

  // Peso nominal do rolo (1 kg, 250 g, 3 kg…); quando omitido, assume o peso inicial informado
  // (decisão do serviço, sem check dedicado).
  @IsOptional()
  @IsNumber()
  @IsPositive()
  nominalWeightGrams?: number;

  // >= 0 (AC 4).
  @IsNumber()
  @Min(0)
  spoolTareGrams: number;

  // >= 0 (AC 4).
  @IsNumber()
  @Min(0)
  acquisitionCostCents: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  batch?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  location?: string;
}
