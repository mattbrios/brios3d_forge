import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const MOVEMENT_DTO_TYPES = ['consumo', 'perda'] as const;

// Baixa manual (AC 16): entrada e ajuste não passam por esta rota (door 6, a entrada nasce em
// POST /inventory/rolls e o ajuste em PATCH .../weigh).
export class CreateMovementDto {
  @IsIn(MOVEMENT_DTO_TYPES)
  type: (typeof MOVEMENT_DTO_TYPES)[number];

  // > 0 (AC 16); a comparação com o saldo disponível fica no serviço (AC 17).
  @IsNumber()
  @IsPositive()
  quantityGrams: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
