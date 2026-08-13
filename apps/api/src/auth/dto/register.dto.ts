import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cadastro publico. Cria sempre CUSTOMER — organizador e portaria vem do seed.
 * O papel nao e campo de entrada de proposito: aceita-lo deixaria qualquer um
 * se cadastrar como portaria e validar ingressos.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'E-mail invalido.' })
  email!: string;

  @IsString()
  @MinLength(2, { message: 'Informe o nome.' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres.' })
  @MaxLength(72) // limite do bcrypt: acima disso a senha e truncada silenciosamente
  password!: string;
}
