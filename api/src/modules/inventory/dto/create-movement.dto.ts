import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const MOVEMENT_DTO_TYPES = ['consumo', 'perda'] as const;

// Baixa manual (AC 16): entrada e ajuste não passam por esta rota (Fase 9, door 6 - a entrada
// nasce em POST /inventory/rolls e o ajuste em PATCH .../weigh).
export class CreateMovementDto {
  @IsIn(MOVEMENT_DTO_TYPES)
  type: (typeof MOVEMENT_DTO_TYPES)[number];

  // `quantity`, não `quantityGrams` (Fase 10, door 4): a unidade vem do dono do movimento, e a
  // chave antiga passa a ser propriedade não declarada, recusada com 400 pelo ValidationPipe.
  // > 0 (AC 16); a comparação com o saldo disponível fica no banco (AD-023).
  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
