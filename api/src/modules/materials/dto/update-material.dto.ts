import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Campos opcionais (PATCH); a obrigatoriedade condicional de secagem depende do valor final
// (campo enviado ou já gravado), então é decidida no serviço, como o combined-rate de
// sales-channels (AC 16).
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
  needsDrying?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  dryingTemperatureC?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dryingHours?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
