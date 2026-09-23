import { IsNumber, Min } from 'class-validator';

// Endpoint dedicado (door 2, plano): só aceita hourmeterHours, valor absoluto >= 0 (AC 26, AC 27).
export class AdjustHourmeterDto {
  @IsNumber()
  @Min(0)
  hourmeterHours: number;
}
