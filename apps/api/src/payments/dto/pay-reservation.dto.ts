import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * `holderName`, `expiry` e `cvv` sao validados de formato e descartados —
 * existem para a tela parecer um checkout de verdade, mas nenhum influencia
 * o resultado. Quem decide e o numero do cartao, avaliado pelo gateway
 * simulado.
 *
 * `cardNumber` so exige presenca aqui: o formato de verdade (13 a 19
 * digitos) e responsabilidade do gateway, que devolve `INVALID_FORMAT` em
 * vez de recusa quando o numero nao parece cartao nenhum. Misturar essa
 * checagem no DTO confundiria "campo mal preenchido" com "cartao invalido",
 * que o contrato trata como dois erros distintos.
 */
export class PayReservationDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o numero do cartao.' })
  cardNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome impresso no cartao.' })
  @MaxLength(120)
  holderName!: string;

  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, {
    message: 'Validade invalida. Use o formato MM/AA.',
  })
  expiry!: string;

  @Matches(/^\d{3,4}$/, { message: 'CVV invalido.' })
  cvv!: string;
}
