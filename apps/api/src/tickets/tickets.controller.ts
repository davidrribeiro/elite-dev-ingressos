import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.guard';
import { TicketsService } from './tickets.service';

@Controller()
@Roles(Role.CUSTOMER)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('me/tickets')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tickets.findMine(user);
  }

  @Get('tickets/:id')
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.findById(user, id);
  }
}

/**
 * Rota separada, sem `@Roles`: o link publico e o unico lugar do sistema que
 * um visitante sem conta acessa. Misturar com o controller acima faria a
 * classe carregar duas politicas de acesso diferentes.
 */
@Controller('public/tickets')
export class PublicTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Public()
  @Get(':shareToken')
  findByShareToken(@Param('shareToken') shareToken: string) {
    return this.tickets.findByShareToken(shareToken);
  }
}
