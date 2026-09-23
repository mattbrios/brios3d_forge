import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const ITEM_MOVEMENT_DTO_TYPES = ['consumo', 'perda'] as const;

// Baixa manual do item (AC 20): `entrada` nasce em /entries e `ajuste` em /count (AC 23), então
// nenhum dos dois passa por aqui.
export class CreateItemMovementDto {
  @IsIn(ITEM_MOVEMENT_DTO_TYPES)
  type: (typeof ITEM_MOVEMENT_DTO_TYPES)[number];

  // > 0; a comparação com o saldo fica no banco, pelo CHECK sobre o UPDATE relativo (AD-023).
  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
