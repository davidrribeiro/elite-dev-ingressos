import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ClockService } from '../common/clock/clock.service';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTicketCode } from '../tickets/ticket-code';
import { ValidateTicketDto } from './dto/validate-ticket.dto';

export type ValidateResult =
  | {
      result: 'VALID';
      ticket: { title: string; startsAt: Date; seat: string; holder: string };
    }
  | {
      result: 'ALREADY_USED';
      usedAt: Date;
      ticket: { seat: string; holder: string };
    }
  | {
      result: 'WRONG_EVENT';
      belongsTo: { title: string; venue: string; startsAt: Date };
    }
  | { result: 'INVALID' };

@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Sessoes publicadas para o operador escolher, as de hoje primeiro. */
  async listEvents() {
    const eventos = await this.prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        venue: true,
        startsAt: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const usados = await this.prisma.ticket.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventos.map((e) => e.id) },
        usedAt: { not: null },
      },
      _count: { _all: true },
    });
    const usadosPorEvento = new Map(
      usados.map((u) => [u.eventId, u._count._all]),
    );

    const hoje = this.clock.now();
    const listados = eventos.map((evento) => ({
      id: evento.id,
      title: evento.title,
      venue: evento.venue,
      startsAt: evento.startsAt,
      ticketsIssued: evento._count.tickets,
      ticketsUsed: usadosPorEvento.get(evento.id) ?? 0,
    }));

    return {
      today: listados.filter((e) => mesmoDia(e.startsAt, hoje)),
      upcoming: listados.filter((e) => !mesmoDia(e.startsAt, hoje)),
    };
  }

  /**
   * Valida um ingresso contra a sessao selecionada.
   *
   * A ordem de apuracao nao e estilo, e o que garante os quatro resultados
   * corretos: primeiro se o codigo existe, depois se e desta sessao — e so
   * ENTAO tenta marcar como usado. Checar `WRONG_EVENT` antes de tentar
   * marcar impede que um ingresso da sala ao lado seja consumido por engano.
   *
   * O passo 3 (`updateMany ... WHERE usedAt IS NULL`) e o que garante
   * FR-025 sob leitura simultanea: duas leitoras apontadas para o mesmo
   * ingresso disputam a mesma linha, e exatamente uma recebe `count === 1`.
   * Ler `usedAt`, decidir em `if` e so depois salvar deixaria as duas
   * passarem.
   */
  async validate(
    operator: AuthenticatedUser,
    dto: ValidateTicketDto,
  ): Promise<ValidateResult> {
    if (!dto.eventId) {
      throw new AppError(
        ErrorCode.GATE_SESSION_REQUIRED,
        'Selecione a sessao antes de validar.',
        400,
      );
    }

    const code = normalizeTicketCode(dto.code);

    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      select: {
        id: true,
        eventId: true,
        usedAt: true,
        seat: { select: { row: true, number: true } },
        event: { select: { title: true, venue: true, startsAt: true } },
        reservation: { select: { customer: { select: { name: true } } } },
      },
    });

    if (!ticket) {
      // Sem detalhe algum, de proposito (FR-026): codigo inexistente e
      // codigo malformado produzem a mesma resposta.
      return { result: 'INVALID' };
    }

    if (ticket.eventId !== dto.eventId) {
      return { result: 'WRONG_EVENT', belongsTo: ticket.event };
    }

    const marcado = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, usedAt: null },
      data: { usedAt: this.clock.now(), validatedById: operator.id },
    });

    const assento = `${ticket.seat.row}${ticket.seat.number}`;
    const holder = ticket.reservation.customer.name;

    if (marcado.count === 1) {
      return {
        result: 'VALID',
        ticket: {
          title: ticket.event.title,
          startsAt: ticket.event.startsAt,
          seat: assento,
          holder,
        },
      };
    }

    // count === 0: outra leitura marcou entre o SELECT acima e este UPDATE.
    // O usedAt que temos em maos e de ANTES da corrida — busca de novo para
    // devolver o instante real da validacao que venceu.
    const atualizado = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { usedAt: true },
    });

    return {
      result: 'ALREADY_USED',
      usedAt: atualizado.usedAt!,
      ticket: { seat: assento, holder },
    };
  }
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
