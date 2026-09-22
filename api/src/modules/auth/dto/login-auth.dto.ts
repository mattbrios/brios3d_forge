import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginAuthDto {
  // Espaços nas pontas saem antes da validação; a caixa é normalizada no serviço.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email: string;

  // O teto limita o custo do scrypt por requisição.
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;
}
