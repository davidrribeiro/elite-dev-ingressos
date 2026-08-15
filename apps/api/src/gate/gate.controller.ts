import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import { GateService } from './gate.service';

@Controller('gate')
@Roles(Role.GATE)
export class GateController {
  constructor(private readonly gate: GateService) {}

  @Get('events')
  listEvents() {
    return this.gate.listEvents();
  }

  @Post('validate')
  @HttpCode(200) // os quatro resultados sao respostas legitimas, nunca erro de requisicao
  validate(
    @CurrentUser() operator: AuthenticatedUser,
    @Body() dto: ValidateTicketDto,
  ) {
    return this.gate.validate(operator, dto);
  }
}
