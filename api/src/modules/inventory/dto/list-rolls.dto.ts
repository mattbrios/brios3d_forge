import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ROLL_STATUSES, type RollStatus } from '../inventory.types.js';

// Contrato de paginação/busca/filtro (AD-020): page 1-based default 1, pageSize default 20
// máx 100.
export class ListRollsDto {
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsIn(ROLL_STATUSES)
  status?: RollStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
