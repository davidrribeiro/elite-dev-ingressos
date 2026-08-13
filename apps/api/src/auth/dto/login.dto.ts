import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail invalido.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a senha.' })
  password!: string;
}
