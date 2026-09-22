import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { IsBelowOne } from '../../pricing/dto/is-below-one.decorator.js';

export class UpdateSalesChannelDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsBelowOne()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsBelowOne()
  feeRate?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
