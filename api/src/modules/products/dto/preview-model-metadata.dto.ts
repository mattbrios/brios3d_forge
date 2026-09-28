import { IsString, MaxLength } from 'class-validator';

export class PreviewModelMetadataDto {
  @IsString()
  @MaxLength(2048)
  modelUrl: string;
}
