import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Contagem de inventário (AC 25): o contado vira o saldo, e a diferença vira um `ajuste`
// assinado - mesmo mecanismo da pesagem do rolo.
export class CountItemDto {
  @IsNumber()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
