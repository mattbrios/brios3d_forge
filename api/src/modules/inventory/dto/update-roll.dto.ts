import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Length, Min, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const present = (_dto: object, value: unknown) => value !== undefined;

// AD-031: só os dados descritivos do rolo. Material, custo, peso inicial e saldo ficam de fora: os dois
// primeiros entram no custo médio e o saldo só muda pelo ledger (AD-022).
// Tara e peso nominal são NOT NULL: omitir preserva, `null` é recusado (`ValidateIf` em vez de
// `IsOptional`, que deixaria o `null` passar). Lote, data e localização aceitam `null` para limpar.
export class UpdateRollDto {
  @ValidateIf(present)
  @IsNumber()
  @Min(0)
  spoolTareGrams?: number;

  @ValidateIf(present)
  @IsNumber()
  @IsPositive()
  nominalWeightGrams?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  batch?: string | null;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  location?: string | null;
}
