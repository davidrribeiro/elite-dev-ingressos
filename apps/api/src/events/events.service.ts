import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CatalogService } from '../catalog/catalog.service';
import { ClockService } from '../common/clock/clock.service';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { generateSeats } from './seat-layout';

/** Campos do evento devolvidos nas listagens. */
const eventSummary = {
  id: true,
  title: true,
  overview: true,
  posterPath: true,
  venue: true,
  startsAt: true,
  priceCents: true,
  status: true,
} satisfies Prisma.EventSelect;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly clock: ClockService,
    private readonly reservations: ReservationsService,
  ) {}

  /**
   * Cria a sessao e gera os assentos em uma unica transacao.
   *
   * Os dados do filme sao **copiados** do TMDb no momento da criacao, em vez de
   * consultados a cada leitura: assim a sessao continua intacta se o catalogo
   * mudar o titulo, tirar o filme do ar ou ficar indisponivel.
   */
  async create(organizer: AuthenticatedUser, dto: CreateEventDto) {
    const movie = await this.catalog.getMovie(dto.tmdbId);
    const seats = generateSeats(dto.layout.rows, dto.layout.seatsPerRow);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organizerId: organizer.id,
          tmdbId: movie.tmdbId,
          title: movie.title,
          overview: movie.overview,
          posterPath: movie.posterPath,
          venue: dto.venue,
          startsAt: new Date(dto.startsAt),
          priceCents: dto.priceCents,
          status: EventStatus.DRAFT,
        },
        select: eventSummary,
      });

      await tx.seat.createMany({
        data: seats.map((seat) => ({ ...seat, eventId: event.id })),
      });

      return { ...event, posterUrl: this.catalog.posterUrl(movie.posterPath) };
    });
  }

  /** Listagem publica: apenas sessoes publicadas. */
  async listPublished(filters: ListEventsDto) {
    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
    };

    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { venue: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.from || filters.to) {
      where.startsAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const events = await this.prisma.event.findMany({
      where,
      select: { ...eventSummary, _count: { select: { seats: true } } },
      orderBy: { startsAt: 'asc' },
    });

    return {
      serverNow: this.clock.now().toISOString(),
      events: events.map(({ _count, ...event }) => ({
        ...event,
        posterUrl: this.catalog.posterUrl(event.posterPath),
        totalSeats: _count.seats,
      })),
    };
  }

  /**
   * Detalhe com o mapa de assentos.
   *
   * O criterio de assento ocupado e unico e simples: existe linha de
   * ReservationSeat para ele, ou nao. Sem segundo criterio e sem filtro por
   * status da reserva — e isso que faz "disponivel significa reservavel".
   */
  async findById(id: string) {
    // Antes de qualquer leitura: sem isso, um assento preso por reserva
    // vencida apareceria ocupado para sempre, e "disponivel" deixaria de
    // significar "reservavel".
    await this.reservations.releaseExpired(id);

    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        ...eventSummary,
        seats: {
          select: {
            id: true,
            row: true,
            number: true,
            reservationSeat: { select: { id: true } },
          },
          orderBy: [{ row: 'asc' }, { number: 'asc' }],
        },
      },
    });

    if (!event) {
      throw AppError.notFound('Sessao');
    }

    const { seats, ...rest } = event;

    return {
      ...rest,
      posterUrl: this.catalog.posterUrl(event.posterPath),
      serverNow: this.clock.now().toISOString(),
      seats: seats.map((seat) => ({
        id: seat.id,
        row: seat.row,
        number: seat.number,
        status: seat.reservationSeat ? 'TAKEN' : 'AVAILABLE',
      })),
    };
  }

  /** Painel do organizador: as sessoes dele, em qualquer status. */
  async listByOrganizer(organizer: AuthenticatedUser) {
    const events = await this.prisma.event.findMany({
      where: { organizerId: organizer.id },
      select: {
        ...eventSummary,
        createdAt: true,
        _count: { select: { seats: true, tickets: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    return events.map(({ _count, ...event }) => ({
      ...event,
      posterUrl: this.catalog.posterUrl(event.posterPath),
      totalSeats: _count.seats,
      ticketsIssued: _count.tickets,
    }));
  }

  async update(organizer: AuthenticatedUser, id: string, dto: UpdateEventDto) {
    await this.assertOwnership(organizer, id);

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: new Date(dto.startsAt) }
          : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
      },
      select: eventSummary,
    });
  }

  async publish(organizer: AuthenticatedUser, id: string) {
    const event = await this.assertOwnership(organizer, id);

    if (event.status === EventStatus.CANCELLED) {
      throw new AppError(
        ErrorCode.EVENT_NOT_PUBLISHED,
        'Uma sessao cancelada nao pode ser publicada.',
        409,
      );
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
      select: eventSummary,
    });
  }

  /**
   * Cancela a sessao, bloqueado quando ja houver ingresso emitido.
   *
   * A checagem e uma contagem, nao uma corrida a se preocupar: o caminho que
   * emitiria um ingresso durante o cancelamento exigiria uma reserva
   * `PENDING` sendo paga no mesmo instante, e o pior caso e o organizador
   * repetir o cancelamento depois de ver o bloqueio — nao um ingresso
   * cancelado por baixo dos panos.
   */
  async cancel(organizer: AuthenticatedUser, id: string): Promise<void> {
    await this.assertOwnership(organizer, id);

    const ticketCount = await this.prisma.ticket.count({
      where: { eventId: id },
    });

    if (ticketCount > 0) {
      throw new AppError(
        ErrorCode.EVENT_HAS_TICKETS,
        `Esta sessao ja vendeu ${ticketCount} ${ticketCount === 1 ? 'ingresso' : 'ingressos'} e nao pode ser cancelada.`,
        409,
        { ticketCount },
      );
    }

    await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });
  }

  /**
   * 403 e nao 404 quando o evento existe mas e de outro organizador: esconder a
   * existencia nao protege nada aqui e confunde quem esta depurando.
   */
  private async assertOwnership(organizer: AuthenticatedUser, id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, organizerId: true, status: true },
    });

    if (!event) {
      throw AppError.notFound('Sessao');
    }

    if (event.organizerId !== organizer.id) {
      throw AppError.forbidden('Esta sessao e de outro organizador.');
    }

    return event;
  }
}
