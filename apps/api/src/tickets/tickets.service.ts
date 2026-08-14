import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CatalogService } from '../catalog/catalog.service';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { generateShareToken, generateTicketCode } from './ticket-code';

const eventFields = {
  id: true,
  title: true,
  venue: true,
  startsAt: true,
  posterPath: true,
} satisfies Prisma.EventSelect;

const seatFields = { row: true, number: true } satisfies Prisma.SeatSelect;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Emite um ingresso por assento, dentro da MESMA transacao que aprovou o
   * pagamento — tudo ou nada (FR-013). Chamado por `PaymentsService`, nunca
   * direto por uma rota.
   *
   * Um `create` por assento, em vez de `createMany`: o maximo de 6 assentos
   * por reserva torna o laco irrelevante em desempenho, e `create` devolve a
   * linha criada — `createMany` do Postgres nao devolve, e uma segunda
   * consulta so para buscar o que acabou de ser inserido seria trabalho a
   * mais sem necessidade.
   *
   * Sem retry em colisao de `code` ou `shareToken`: 80 e 128 bits de
   * entropia tornam a chance irrelevante para a vida deste projeto. Escrever
   * logica de retry para isso seria complexidade sem motivo — constituicao,
   * principio V.
   */
  async issueForReservation(
    tx: Prisma.TransactionClient,
    params: { reservationId: string; eventId: string; seatIds: string[] },
  ) {
    const tickets: { id: string; seat: { row: string; number: number } }[] = [];

    for (const seatId of params.seatIds) {
      const ticket = await tx.ticket.create({
        data: {
          reservationId: params.reservationId,
          eventId: params.eventId,
          seatId,
          code: generateTicketCode(),
          shareToken: generateShareToken(),
        },
        select: { id: true, seat: { select: seatFields } },
      });
      tickets.push(ticket);
    }

    return tickets;
  }

  /** Meus ingressos. Projecao SEM `code`: a consulta abaixo nunca o busca. */
  async findMine(customer: AuthenticatedUser) {
    const tickets = await this.prisma.ticket.findMany({
      where: { reservation: { customerId: customer.id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        usedAt: true,
        event: { select: eventFields },
        seat: { select: seatFields },
      },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      usedAt: ticket.usedAt,
      event: this.withPosterUrl(ticket.event),
      seat: ticket.seat,
    }));
  }

  /** Ingresso completo, com `code` — so o dono. */
  async findById(customer: AuthenticatedUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        shareToken: true,
        usedAt: true,
        event: { select: eventFields },
        seat: { select: seatFields },
        reservation: { select: { customerId: true } },
      },
    });

    if (!ticket) {
      throw AppError.notFound('Ingresso');
    }

    if (ticket.reservation.customerId !== customer.id) {
      throw AppError.forbidden('Este ingresso e de outro cliente.');
    }

    return {
      id: ticket.id,
      code: ticket.code,
      shareToken: ticket.shareToken,
      usedAt: ticket.usedAt,
      event: this.withPosterUrl(ticket.event),
      seat: ticket.seat,
    };
  }

  /**
   * Ingresso compartilhado. Publico e SEM `code`, garantido pela consulta —
   * o `select` abaixo nunca inclui o campo, entao nao ha "esquecer de tirar"
   * antes de responder.
   */
  async findByShareToken(shareToken: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { shareToken },
      select: {
        id: true,
        usedAt: true,
        event: { select: eventFields },
        seat: { select: seatFields },
        reservation: { select: { customer: { select: { name: true } } } },
      },
    });

    if (!ticket) {
      throw AppError.notFound('Ingresso');
    }

    return {
      id: ticket.id,
      usedAt: ticket.usedAt,
      holder: ticket.reservation.customer.name,
      event: this.withPosterUrl(ticket.event),
      seat: ticket.seat,
    };
  }

  private withPosterUrl<T extends { posterPath: string | null }>(event: T) {
    const { posterPath, ...rest } = event;
    return { ...rest, posterUrl: this.catalog.posterUrl(posterPath) };
  }
}
