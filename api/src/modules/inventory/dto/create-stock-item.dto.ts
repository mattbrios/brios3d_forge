import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { STOCK_ITEM_CATEGORIES, type StockItemCategory } from '../entities/stock-item.entity.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// O saldo não entra aqui: o cadastro nasce com `0` e sem movimento (door 6); quem carrega
// quantidade e custo é POST /inventory/items/:id/entries.
export class CreateStockItemDto {
  @IsIn(STOCK_ITEM_CATEGORIES)
  category: StockItemCategory;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sku?: string;

  // Texto livre de exibição (`un`, `m`, `kg`, `L`, `folha`): o sistema nunca converte unidades.
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  unitOfMeasure: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsUUID()
  preferredSupplierId?: string;

  // Só para `peca_reposicao` (AC 30); a existência de cada impressora é checada no serviço.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  compatiblePrinterIds?: string[];

  // Fase 11, door 1: piso opcional na unidade do item; omitir grava `null`.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuantity?: number | null;
}
