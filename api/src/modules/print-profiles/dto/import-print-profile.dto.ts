import { IsString, MaxLength } from 'class-validator';

export class ImportPrintProfileDto {
  @IsString()
  @MaxLength(2048)
  url: string;
}
