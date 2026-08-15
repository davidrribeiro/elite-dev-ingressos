import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * `eventId` e opcional aqui, e nao por engano: a ausencia precisa virar
 * GATE_SESSION_REQUIRED, um erro especifico que diz "escolha uma sessao
 * primeiro" — nao um VALIDATION_ERROR generico de campo obrigatorio, que a
 * portaria nao teria como distinguir de qualquer outro formulario mal
 * preenchido. A checagem de presenca fica no service.
 */
export class ValidateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o codigo do ingresso.' })
  code!: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;
}
