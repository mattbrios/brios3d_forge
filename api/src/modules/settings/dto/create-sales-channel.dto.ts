import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Length, Min } from 'class-validator';
import { IsBelowOne } from '../../pricing/dto/is-below-one.decorator.js';

export class CreateSalesChannelDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsNumber()
  @Min(0)
  @IsBelowOne()
  taxRate: number;

  @IsNumber()
  @Min(0)
  @IsBelowOne()
  feeRate: number;
}
