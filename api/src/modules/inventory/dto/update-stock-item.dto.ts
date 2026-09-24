import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
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

// Campos opcionais (PATCH); mesmas regras do create, mais `active` (AC 6). Omitir
// `compatiblePrinterIds` preserva os vínculos existentes (AC 33); enviá-lo substitui o conjunto
// inteiro (AC 32).
export class UpdateStockItemDto {
  @IsOptional()
  @IsIn(STOCK_ITEM_CATEGORIES)
  category?: StockItemCategory;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sku?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  unitOfMeasure?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsUUID()
  preferredSupplierId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  compatiblePrinterIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Fase 11, door 1: omitir preserva o piso, `null` explícito limpa a política.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuantity?: number | null;
}
