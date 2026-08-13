import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListEventsDto {
  /** Busca por titulo do filme ou local. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
