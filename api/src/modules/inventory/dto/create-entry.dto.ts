import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

// Entrada com custo (AC 12): é esta rota, e não o cadastro, que carrega o custo pago (door 6).
// Fracionária de propósito - tinta em litro e tubo em metro admitem 0,5.
export class CreateEntryDto {
  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCostCents: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
