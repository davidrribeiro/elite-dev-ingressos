import { Injectable } from '@nestjs/common';
import { Prisma, PaymentStatus, ReservationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ClockService } from '../common/clock/clock.service';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationsService } from '../reservations/reservations.service';
import { TicketsService } from '../tickets/tickets.service';
import { PayReservationDto } from './dto/pay-reservation.dto';
import { chargeSimulated } from './simulated-gateway';

/** Aceita tanto o cliente comum quanto um cliente dentro de transacao. */
type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly reservations: ReservationsService,
    private readonly tickets: TicketsService,
  ) {}

  /**
   * Cobra o cartao informado contra a reserva.
   *
   * A ordem das checagens nao e estilo, e a regra: o **estado da reserva** e
   * conferido antes de o **cartao** ser avaliado. Se o gateway rodasse
   * primeiro, uma reserva ja vencida com um cartao de recusa responderia
   * `DECLINED` em vez de `RESERVATION_EXPIRED` — o cliente teria a impressao
   * de que ainda dava tempo, quando o prazo ja tinha passado.
   */
  async pay(
    customer: AuthenticatedUser,
    reservationId: string,
    dto: PayReservationDto,
  ) {
    const posse = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, customerId: true, eventId: true },
    });

    if (!posse) {
      throw AppError.notFound('Reserva');
    }

    if (posse.customerId !== customer.id) {
      throw AppError.forbidden('Esta reserva e de outro cliente.');
    }

    // Varre vencidas ANTES de avaliar a reserva — o mesmo padrao usado em
    // GET /reservations/:id. Se o prazo ja passou, essa chamada e o que
    // garante que o status abaixo ja reflete EXPIRED, e nao um PENDING
    // desatualizado.
    await this.reservations.releaseExpired(posse.eventId);

    const reserva = await this.prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { status: true, expiresAt: true, totalCents: true },
    });

    if (reserva.status !== ReservationStatus.PENDING) {
      throw await this.errorForStatus(
        this.prisma,
        reservationId,
        reserva.status,
      );
    }

    const resultado = chargeSimulated(dto.cardNumber);

    if (resultado.status === 'INVALID_FORMAT') {
      // Erro de preenchimento, nao recusa: nenhuma tentativa e registrada.
      throw new AppError(
        ErrorCode.INVALID_CARD_FORMAT,
        'Numero de cartao invalido.',
        400,
      );
    }

    if (resultado.status === 'DECLINED') {
      await this.prisma.payment.create({
        data: {
          reservationId,
          status: PaymentStatus.DECLINED,
          amountCents: reserva.totalCents,
          declineReason: resultado.declineReason,
        },
      });

      // expiresAt devolvido SEM alteracao — tentativa nao estende prazo
      // (FR-011), e devolve-lo deixa isso visivel para quem ler a resposta.
      return {
        status: 'DECLINED' as const,
        declineReason: resultado.declineReason,
        expiresAt: reserva.expiresAt,
        serverNow: this.clock.now().toISOString(),
      };
    }

    return this.approve(reservationId, reserva.totalCents);
  }

  /**
   * Aprova: transicao condicional `PENDING -> PAID`, e so quando `count`
   * confirma que esta reserva (e nenhuma outra tentativa concorrente) venceu
   * a corrida, emite os ingressos na mesma transacao.
   *
   * Sem chave de idempotencia — a propria transicao e o portao contra clique
   * duplo. Duas requisicoes simultaneas com o cartao aprovado disputam a
   * mesma linha; exatamente uma consegue `count === 1`. A perdedora cai no
   * `count === 0` abaixo, que resolve para `RESERVATION_ALREADY_PAID` com os
   * ingressos que a vencedora acabou de emitir. Ver research.md R3.
   */
  private async approve(reservationId: string, amountCents: number) {
    // timeout acima do padrao de 5s: a perdedora da corrida fica bloqueada
    // esperando o lock de linha da vencedora ate ela commitar, e so depois
    // ainda consulta o status atual para montar o erro certo. Sob carga (a
    // suite inteira de testes de corrida rodando em sequencia), 5s e curto
    // o suficiente para estourar por fila de conexao, nao por bug.
    return this.prisma.$transaction(
      async (tx) => {
        const agora = this.clock.now();

        const transicao = await tx.reservation.updateMany({
          where: {
            id: reservationId,
            status: ReservationStatus.PENDING,
            expiresAt: { gt: agora },
          },
          data: { status: ReservationStatus.PAID },
        });

        if (transicao.count === 0) {
          const atual = await tx.reservation.findUniqueOrThrow({
            where: { id: reservationId },
            select: { status: true },
          });
          throw await this.errorForStatus(tx, reservationId, atual.status);
        }

        await tx.payment.create({
          data: {
            reservationId,
            status: PaymentStatus.APPROVED,
            amountCents,
          },
        });

        const [assentos, reserva] = await Promise.all([
          tx.reservationSeat.findMany({
            where: { reservationId },
            select: { seatId: true },
          }),
          tx.reservation.findUniqueOrThrow({
            where: { id: reservationId },
            select: { eventId: true },
          }),
        ]);

        const tickets = await this.tickets.issueForReservation(tx, {
          reservationId,
          eventId: reserva.eventId,
          seatIds: assentos.map((a) => a.seatId),
        });

        return {
          status: 'APPROVED' as const,
          reservationId,
          tickets: tickets.map((t) => ({ id: t.id, seat: t.seat })),
        };
      },
      { timeout: 10_000 },
    );
  }

  /**
   * Traduz um status que nao e mais `PENDING` para o erro certo.
   *
   * `PENDING` cai no ultimo `else`: so chega aqui vindo do `count === 0` da
   * transicao acima, e a unica razao de a transicao falhar com o status
   * ainda `PENDING` no banco e `expiresAt` ja ter passado — o prazo venceu
   * entre a varredura e a tentativa de aprovar, uma janela de milissegundos,
   * mas real.
   */
  private async errorForStatus(
    db: Db,
    reservationId: string,
    status: ReservationStatus,
  ): Promise<AppError> {
    if (status === ReservationStatus.PAID) {
      const tickets = await db.ticket.findMany({
        where: { reservationId },
        select: { id: true },
      });
      return new AppError(
        ErrorCode.RESERVATION_ALREADY_PAID,
        'Esta reserva ja foi paga.',
        409,
        { ticketIds: tickets.map((t) => t.id) },
      );
    }

    if (status === ReservationStatus.CANCELLED) {
      return new AppError(
        ErrorCode.RESERVATION_NOT_PENDING,
        'Esta reserva foi cancelada.',
        409,
      );
    }

    return new AppError(
      ErrorCode.RESERVATION_EXPIRED,
      'Sua reserva expirou. Escolha os lugares novamente.',
      409,
    );
  }
}
