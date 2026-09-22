import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword: string;
}
