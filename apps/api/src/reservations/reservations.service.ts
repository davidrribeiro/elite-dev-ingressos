import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReservationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ClockService } from '../common/clock/clock.service';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

const eventSummary = {
  select: { id: true, title: true, venue: true, startsAt: true },
} satisfies { select: Prisma.EventSelect };

const seatSummary = {
  select: { id: true, row: true, number: true },
} satisfies { select: Prisma.SeatSelect };

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devolve ao estoque os assentos de reservas vencidas de uma sessao.
   *
   * Duas escritas, nesta ordem e nunca invertida: primeiro `PENDING` vencida
   * vira `EXPIRED`, so depois as `ReservationSeat` de reservas `EXPIRED` sao
   * apagadas. Na ordem inversa existe uma janela em que um pagamento em curso
   * confirma a compra depois do assento ja ter voltado ao estoque — ingresso
   * emitido para poltrona ja revendida. Ver research.md R1.
   *
   * As duas escritas disputam a MESMA linha da reserva que um pagamento
   * concorrente tambem disputa: uma delas vence, a outra nao encontra nada
   * para mudar. E o mesmo padrao de transicao condicional usado na portaria.
   */
  async releaseExpired(eventId: string): Promise<void> {
    const agora = this.clock.now();

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.updateMany({
        where: {
          eventId,
          status: ReservationStatus.PENDING,
          expiresAt: { lt: agora },
        },
        data: { status: ReservationStatus.EXPIRED },
      });

      await tx.reservationSeat.deleteMany({
        where: { reservation: { eventId, status: ReservationStatus.EXPIRED } },
      });
    });
  }

  /**
   * Cria a reserva e prende os assentos.
   *
   * A garantia contra venda dupla mora no `UNIQUE` de `ReservationSeat.seatId`,
   * nao em verificar disponibilidade antes de inserir — entre a leitura e a
   * escrita cabe outra requisicao. `createMany` dentro da transacao insere os
   * assentos de uma vez; se algum ja estiver preso, a violacao de unicidade
   * derruba a transacao inteira, entao reserva parcial nunca existe.
   */
  async create(customer: AuthenticatedUser, dto: CreateReservationDto) {
    await this.releaseExpired(dto.eventId);

    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: { id: true, status: true, priceCents: true },
    });

    if (!event) {
      throw AppError.notFound('Sessao');
    }

    if (event.status !== 'PUBLISHED') {
      throw new AppError(
        ErrorCode.EVENT_NOT_PUBLISHED,
        'Esta sessao nao esta disponivel para reserva.',
        409,
      );
    }

    // Os assentos precisam existir E pertencer a esta sessao. Sem essa
    // checagem, um seatId de outra sessao ou inexistente passaria pelo
    // createMany e so falharia (ou pior, nao falharia) de forma confusa.
    const assentosValidos = await this.prisma.seat.count({
      where: { id: { in: dto.seatIds }, eventId: dto.eventId },
    });

    if (assentosValidos !== dto.seatIds.length) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Um ou mais assentos nao pertencem a esta sessao.',
        404,
      );
    }

    const prazoMinutos = Number(
      this.config.get<string>('RESERVATION_HOLD_MINUTES') ?? 10,
    );
    const expiresAt = this.clock.minutesFromNow(prazoMinutos);

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        const criada = await tx.reservation.create({
          data: {
            eventId: dto.eventId,
            customerId: customer.id,
            status: ReservationStatus.PENDING,
            totalCents: event.priceCents * dto.seatIds.length,
            expiresAt,
          },
        });

        await tx.reservationSeat.createMany({
          data: dto.seatIds.map((seatId) => ({
            reservationId: criada.id,
            seatId,
          })),
        });

        return criada;
      });

      return this.toDetail(reservation.id);
    } catch (causa) {
      if (
        causa instanceof Prisma.PrismaClientKnownRequestError &&
        causa.code === 'P2002'
      ) {
        throw await this.seatsTakenError(dto.seatIds);
      }
      throw causa;
    }
  }

  /**
   * Diagnostico pos-falha: quais dos assentos pedidos ja estao presos.
   *
   * Roda depois do rollback, so para compor a mensagem — a corretude nao
   * depende disto. Se algum assento for liberado entre a falha e esta
   * leitura, o pior caso e uma lista levemente desatualizada; o cliente tenta
   * de novo.
   */
  private async seatsTakenError(seatIds: string[]): Promise<AppError> {
    const presos = await this.prisma.reservationSeat.findMany({
      where: { seatId: { in: seatIds } },
      select: { seatId: true },
    });

    return new AppError(
      ErrorCode.SEATS_TAKEN,
      presos.length === 1
        ? 'Um dos assentos acabou de ser reservado por outra pessoa.'
        : 'Alguns assentos acabaram de ser reservados por outra pessoa.',
      409,
      { seatIds: presos.map((p) => p.seatId) },
    );
  }

  /** Estado do pedido: resumo do evento, assentos, ultima tentativa de pagamento e ingressos. */
  async findById(customer: AuthenticatedUser, id: string) {
    const posse = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, customerId: true, eventId: true },
    });

    if (!posse) {
      throw AppError.notFound('Reserva');
    }

    if (posse.customerId !== customer.id) {
      throw AppError.forbidden('Esta reserva e de outro cliente.');
    }

    // A varredura pode mudar o status da propria reserva sendo consultada —
    // por isso roda antes da leitura que vira resposta, nao depois.
    await this.releaseExpired(posse.eventId);

    return this.toDetail(id);
  }

  /** Cancela reserva ainda nao paga, devolvendo os assentos ao mapa. */
  async cancel(customer: AuthenticatedUser, id: string): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });

    if (!reservation) {
      throw AppError.notFound('Reserva');
    }

    if (reservation.customerId !== customer.id) {
      throw AppError.forbidden('Esta reserva e de outro cliente.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Transicao condicional: so vira CANCELLED se ainda estiver PENDING.
      // count === 0 aqui significa "ja paga ou ja cancelada", nunca "nao
      // existe" — isso ja foi descartado pela leitura acima.
      const resultado = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.PENDING },
        data: { status: ReservationStatus.CANCELLED },
      });

      if (resultado.count === 0) {
        throw new AppError(
          ErrorCode.RESERVATION_NOT_PENDING,
          'Esta reserva ja foi paga ou cancelada.',
          409,
        );
      }

      await tx.reservationSeat.deleteMany({ where: { reservationId: id } });
    });
  }

  private async toDetail(id: string) {
    const reservation = await this.prisma.reservation.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        status: true,
        totalCents: true,
        expiresAt: true,
        event: eventSummary,
        seats: { select: { seat: seatSummary } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, declineReason: true },
        },
        tickets: { select: { id: true } },
      },
    });

    return {
      id: reservation.id,
      status: reservation.status,
      totalCents: reservation.totalCents,
      expiresAt: reservation.expiresAt,
      serverNow: this.clock.now().toISOString(),
      event: reservation.event,
      seats: reservation.seats.map((s) => s.seat),
      lastPayment: reservation.payments[0] ?? null,
      ticketIds: reservation.tickets.map((t) => t.id),
    };
  }
}
