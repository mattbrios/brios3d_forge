import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { STOCK_ITEM_CATEGORIES, type StockItemCategory } from '../entities/stock-item.entity.js';

// Contrato de paginação/busca/filtro (AD-020): page 1-based default 1, pageSize default 20
// máx 100; `search` casa contra `name` e `sku`.
export class ListStockItemsDto {
  @IsOptional()
  @IsIn(STOCK_ITEM_CATEGORIES)
  category?: StockItemCategory;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
