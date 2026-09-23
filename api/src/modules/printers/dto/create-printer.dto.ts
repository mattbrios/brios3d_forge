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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Nozzle } from '../entities/printer.entity.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class NozzleDto implements Nozzle {
  // (0, 2] mm (AC 5).
  @IsNumber()
  @IsPositive()
  @Max(2)
  diameterMm: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class CreatePrinterDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name: string;

  // > 0 (AC 3).
  @IsNumber()
  @IsPositive()
  acquisitionCostCents: number;

  // (0, 100000] h (AC 3).
  @IsNumber()
  @IsPositive()
  @Max(100000)
  lifespanHours: number;

  // (0, 5000] W (AC 3).
  @IsNumber()
  @IsPositive()
  @Max(5000)
  powerWatts: number;

  // >= 0; ausente grava o padrão 0 (AC 1, AC 2, AC 8).
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourmeterHours?: number;

  // 1 a 10 itens (AC 5).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NozzleDto)
  nozzles: NozzleDto[];

  @IsBoolean()
  hasAms: boolean;

  // Obrigatório e >= 1 só quando hasAms é true (AC 6); ignorado e gravado null quando
  // hasAms é false (AC 7), decisão do serviço.
  @ValidateIf((dto: CreatePrinterDto) => dto.hasAms === true)
  @IsInt()
  @Min(1)
  amsSlots?: number;
}
