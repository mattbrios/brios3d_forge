import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { INVALID_MODEL_URL } from '../products.types.js';

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Metadados do modelo digitados à mão nesta fase (a Fase 14 os busca pela URL). `null` num campo
// opcional é aceito e grava vazio.
export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  // A plataforma e o id são decididos por `parseModelUrl`; aqui só a presença (AC 5).
  @IsString({ message: INVALID_MODEL_URL })
  @IsNotEmpty({ message: INVALID_MODEL_URL })
  modelUrl: string;

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

  // Door 5: omitir ou enviar `null` grava "não informado".
  @IsOptional()
  @IsBoolean()
  commercialUseAllowed?: boolean | null;
}
