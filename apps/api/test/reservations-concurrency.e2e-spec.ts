import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SENHA = 'elite123';
const SUFIXO = '@e2e-res-concurrency.dev';
const REPETICOES = 10;

/**
 * A prova concreta da invariante central do desafio: o mesmo assento nao pode
 * ser vendido duas vezes, nem sob duas requisicoes simultaneas.
 *
 * Corrida que passa uma vez nao passou — por isso o laco. Um teste que dispara
 * as duas requisicoes em sequencia nunca testaria a corrida de verdade.
 */
describe('Reserva sob disputa (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();

    prisma = app.get(PrismaService);
    await limpar();

    const passwordHash = await bcrypt.hash(SENHA, 4);
    await prisma.user.createMany({
      data: [
        {
          email: `clienteA${SUFIXO}`,
          name: 'Cliente A',
          passwordHash,
          role: Role.CUSTOMER,
        },
        {
          email: `clienteB${SUFIXO}`,
          name: 'Cliente B',
          passwordHash,
          role: Role.CUSTOMER,
        },
      ],
    });

    tokenA = await entrar(`clienteA${SUFIXO}`);
    tokenB = await entrar(`clienteB${SUFIXO}`);
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  async function limpar() {
    // Reservation nao tem onDelete: Cascade a partir de Event — apagar o
    // evento com reserva pendente quebraria a FK. As linhas de reserva vao
    // primeiro; ReservationSeat cai junto por cascade a partir dela.
    await prisma.reservation.deleteMany({
      where: { customer: { email: { endsWith: SUFIXO } } },
    });
    await prisma.event.deleteMany({ where: { venue: { endsWith: SUFIXO } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFIXO } } });
  }

  async function entrar(email: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: SENHA })
      .expect(200);
    return body.token as string;
  }

  /** Uma sessao nova com um unico assento — o alvo da disputa. */
  async function criarSessaoComUmAssento(): Promise<{
    eventId: string;
    seatId: string;
  }> {
    const organizador = await prisma.user.upsert({
      where: { email: `organizador${SUFIXO}` },
      update: {},
      create: {
        email: `organizador${SUFIXO}`,
        name: 'Organizador',
        passwordHash: await bcrypt.hash(SENHA, 4),
        role: Role.ORGANIZER,
      },
    });

    const event = await prisma.event.create({
      data: {
        organizerId: organizador.id,
        title: 'Sessao de teste',
        venue: `Sala Unica${SUFIXO}`,
        startsAt: new Date(Date.now() + 86_400_000),
        priceCents: 1000,
        status: EventStatus.PUBLISHED,
      },
    });

    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    return { eventId: event.id, seatId: seat.id };
  }

  function reservar(token: string, eventId: string, seatId: string) {
    return request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, seatIds: [seatId] });
  }

  it(`sob ${REPETICOES} disputas simultaneas pelo mesmo assento, exatamente uma reserva vence em cada rodada`, async () => {
    for (let rodada = 0; rodada < REPETICOES; rodada++) {
      const { eventId, seatId } = await criarSessaoComUmAssento();

      const [respostaA, respostaB] = await Promise.all([
        reservar(tokenA, eventId, seatId),
        reservar(tokenB, eventId, seatId),
      ]);

      const codigos = [respostaA.status, respostaB.status].sort();

      // Uma das duas cria (201), a outra recebe conflito (409). Nunca as
      // duas 201 — isso seria o mesmo assento vendido duas vezes.
      expect(codigos).toEqual([201, 409]);

      const perdedora = respostaA.status === 409 ? respostaA : respostaB;
      expect(perdedora.body.error.code).toBe('SEATS_TAKEN');
      expect(perdedora.body.error.details.seatIds).toContain(seatId);

      // Confirmacao direta no banco: exatamente uma linha prende o assento,
      // nao duas, e o teste nao deveria confiar so na resposta HTTP.
      const reservasDoAssento = await prisma.reservationSeat.count({
        where: { seatId },
      });
      expect(reservasDoAssento).toBe(1);
    }
  }, 30_000);
});
