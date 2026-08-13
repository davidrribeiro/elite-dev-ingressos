import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_ROWS, MAX_SEATS_PER_ROW } from '../seat-layout';

export class SeatLayoutDto {
  @IsInt()
  @Min(1)
  @Max(MAX_ROWS)
  rows!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_SEATS_PER_ROW)
  seatsPerRow!: number;
}

export class CreateEventDto {
  @IsInt()
  @Min(1)
  tmdbId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  venue!: string;

  @IsDateString({}, { message: 'Informe a data e hora da sessao.' })
  startsAt!: string;

  // Em centavos: dinheiro em ponto flutuante gera diferenca de arredondamento
  // na soma de varios ingressos.
  @IsInt({ message: 'Informe o preco em centavos.' })
  @Min(0)
  @Max(100_000_00)
  priceCents!: number;

  @ValidateNested()
  @Type(() => SeatLayoutDto)
  layout!: SeatLayoutDto;
}
