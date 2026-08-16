import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
// `import type`: exigencia do isolatedModules para tipo usado em assinatura
// decorada. Ver o mesmo padrao em auth.controller.ts.
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  list(@Query() filters: ListEventsDto) {
    return this.events.listPublished(filters);
  }

  @Public()
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.findById(id);
  }

  @Roles(Role.ORGANIZER)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Roles(Role.ORGANIZER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(user, id, dto);
  }

  @Roles(Role.ORGANIZER)
  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.publish(user, id);
  }

  @Roles(Role.ORGANIZER)
  @Post(':id/cancel')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.events.cancel(user, id);
  }
}

/** Painel do organizador. Rota separada para nao colidir com `GET /events/:id`. */
@Controller('organizer/events')
@Roles(Role.ORGANIZER)
export class OrganizerEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.events.listByOrganizer(user);
  }
}
