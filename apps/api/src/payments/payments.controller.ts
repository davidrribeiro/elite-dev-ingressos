import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { PayReservationDto } from './dto/pay-reservation.dto';
import { PaymentsService } from './payments.service';

@Controller('reservations')
@Roles(Role.CUSTOMER)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/payment')
  @HttpCode(200) // aprovado e recusado sao 200: os dois sao desfecho de negocio, nao erro de requisicao
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayReservationDto,
  ) {
    return this.payments.pay(user, id, dto);
  }
}
