import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.guard';
import { CatalogService } from './catalog.service';

/**
 * So o organizador consulta o catalogo: e a tela de montar evento que precisa
 * dele. O cliente ve o evento ja criado, com os dados copiados no banco.
 */
@Controller('catalog')
@Roles(Role.ORGANIZER)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('movies')
  search(@Query('query') query?: string) {
    return this.catalog.searchMovies(query);
  }

  @Get('movies/:tmdbId')
  detail(@Param('tmdbId', ParseIntPipe) tmdbId: number) {
    return this.catalog.getMovie(tmdbId);
  }
}
