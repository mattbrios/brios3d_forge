import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

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

  @IsBoolean()
  needsDrying: boolean;

  // Obrigatório e em [0, 120] °C só quando needsDrying é true (AC 4); ignorado e gravado null
  // quando needsDrying é false (AC 5), decisão do serviço.
  @ValidateIf((dto: CreateMaterialDto) => dto.needsDrying === true)
  @IsNumber()
  @Min(0)
  @Max(120)
  dryingTemperatureC?: number;

  // Obrigatório e > 0 só quando needsDrying é true (AC 4).
  @ValidateIf((dto: CreateMaterialDto) => dto.needsDrying === true)
  @IsNumber()
  @IsPositive()
  dryingHours?: number;
}
