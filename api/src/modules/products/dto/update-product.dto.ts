import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { INVALID_MODEL_URL } from '../products.types.js';
import { trim } from './create-product.dto.js';

// Campos de POST /products, todos opcionais, mais `active` (produto nunca é apagado, door 4).
export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString({ message: INVALID_MODEL_URL })
  @IsNotEmpty({ message: INVALID_MODEL_URL })
  modelUrl?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  modelTitle?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'modelImageUrl deve ser uma URL https' })
  modelImageUrl?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  modelDesigner?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  modelLicense?: string | null;

  @IsOptional()
  @IsBoolean()
  commercialUseAllowed?: boolean | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
