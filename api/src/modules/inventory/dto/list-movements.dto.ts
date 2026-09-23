import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Lista unificada de rolo e item (door 3): só paginação (AD-020), sem filtro por dono, tipo ou
// período - o histórico por dono já vem em GET /inventory/items/:id e GET /inventory/rolls/:id.
export class ListMovementsDto {
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
