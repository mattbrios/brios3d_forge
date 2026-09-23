import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NozzleDto } from './create-printer.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Campos opcionais (PATCH); nunca hourmeterHours (AC 20, fora do DTO -> forbidNonWhitelisted).
// A obrigatoriedade condicional de amsSlots depende do valor final (campo enviado ou já
// gravado), então é decidida no serviço, como o needsDrying de materials (AC 19).
export class UpdatePrinterDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  acquisitionCostCents?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100000)
  lifespanHours?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(5000)
  powerWatts?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NozzleDto)
  nozzles?: NozzleDto[];

  @IsOptional()
  @IsBoolean()
  hasAms?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  amsSlots?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
