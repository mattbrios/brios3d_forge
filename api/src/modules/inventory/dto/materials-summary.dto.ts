import { IsOptional, IsString } from 'class-validator';

export class MaterialsSummaryDto {
  // Nome do material: casa contra type/brand/color, mesmo campo de busca de GET /materials.
  @IsOptional()
  @IsString()
  search?: string;
}
