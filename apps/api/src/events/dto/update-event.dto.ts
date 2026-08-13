import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * O layout de assentos fica de fora de proposito: mudar fileiras depois de
 * publicado apagaria assentos que podem ja estar vendidos. Para mudar a sala,
 * crie outra sessao.
 */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  venue?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number;
}
