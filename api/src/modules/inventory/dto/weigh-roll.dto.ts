import { IsNumber, Min } from 'class-validator';

// saldo = bruto - tara (AC 11); a comparação com a tara do rolo fica no serviço (AC 13).
export class WeighRollDto {
  @IsNumber()
  @Min(0)
  grossWeightGrams: number;
}
