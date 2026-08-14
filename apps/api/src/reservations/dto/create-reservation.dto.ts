import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

/** Teto arbitrario, nao vindo de requisito: uma reserva nao e revenda por atacado. */
const MAX_SEATS_PER_RESERVATION = 6;

export class CreateReservationDto {
  @IsUUID()
  eventId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Escolha ao menos um assento.' })
  @ArrayMaxSize(MAX_SEATS_PER_RESERVATION, {
    message: `No maximo ${MAX_SEATS_PER_RESERVATION} assentos por reserva.`,
  })
  @ArrayUnique({ message: 'Assentos repetidos na mesma reserva.' })
  @IsUUID('4', { each: true })
  seatIds!: string[];
}
