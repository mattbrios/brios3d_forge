import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MODEL_PLATFORMS, type ModelPlatform } from '../entities/product.entity.js';

// AD-020: page 1-based default 1, pageSize default 20 máx 100, ordem fixa por nome.
export class ListProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(MODEL_PLATFORMS)
  platform?: ModelPlatform;

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
