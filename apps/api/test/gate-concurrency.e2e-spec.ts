import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CatalogService } from '../src/catalog/catalog.service';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SENHA = 'elite123';
const SUFIXO = '@e2e-gate-concurrency.dev';
const REPETICOES = 10;

/**
 * Duas leitoras de QR apontadas para o mesmo ingresso, ao mesmo tempo, na
 * entrada de um evento cheio. So uma pode passar.
 */
describe('Validacao sob leitura simultanea (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenCliente: string;
  let tokenPortaria: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CatalogService)
      .useValue({
        getMovie: jest.fn().mockResolvedValue({
          tmdbId: 1,
          title: 'Filme',
          overview: null,
          posterPath: null,
        }),
        posterUrl: () => null,
      })
      .compile();

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
          email: `cliente${SUFIXO}`,
          name: 'Cliente',
          passwordHash,
          role: Role.CUSTOMER,
        },
        {
          email: `portaria${SUFIXO}`,
          name: 'Portaria',
          passwordHash,
          role: Role.GATE,
        },
        {
          email: `organizador${SUFIXO}`,
          name: 'Organizadora',
          passwordHash,
          role: Role.ORGANIZER,
        },
      ],
    });

    tokenCliente = await entrar(`cliente${SUFIXO}`);
    tokenPortaria = await entrar(`portaria${SUFIXO}`);
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  async function limpar() {
    await prisma.ticket.deleteMany({
      where: { reservation: { customer: { email: { endsWith: SUFIXO } } } },
    });
    await prisma.payment.deleteMany({
      where: { reservation: { customer: { email: { endsWith: SUFIXO } } } },
    });
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
    return body.token;
  }

  async function criarIngresso(): Promise<{ eventId: string; code: string }> {
    const organizador = await prisma.user.upsert({
      where: { email: `organizador${SUFIXO}` },
      update: {},
      create: {
        email: `organizador${SUFIXO}`,
        name: 'Organizadora',
        passwordHash: await bcrypt.hash(SENHA, 4),
        role: Role.ORGANIZER,
      },
    });

    const event = await prisma.event.create({
      data: {
        organizerId: organizador.id,
        title: 'Sessao de teste',
        venue: `Sala Portaria ${Date.now()}${Math.random()}${SUFIXO}`,
        startsAt: new Date(Date.now() + 3_600_000),
        priceCents: 3000,
        status: EventStatus.PUBLISHED,
      },
    });
    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    const { body: reserva } = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const { body: pagamento } = await request(app.getHttpServer())
      .post(`/reservations/${reserva.id}/payment`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({
        cardNumber: '4242424242424242',
        holderName: 'X',
        expiry: '12/30',
        cvv: '123',
      })
      .expect(200);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: pagamento.tickets[0].id },
      select: { code: true },
    });

    return { eventId: event.id, code: ticket.code };
  }

  function ler(code: string, eventId: string) {
    return request(app.getHttpServer())
      .post('/gate/validate')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .send({ code, eventId });
  }

  it(`sob ${REPETICOES} leituras simultaneas do mesmo ingresso, exatamente uma recebe VALID`, async () => {
    for (let rodada = 0; rodada < REPETICOES; rodada++) {
      const { eventId, code } = await criarIngresso();

      const [respostaA, respostaB] = await Promise.all([
        ler(code, eventId),
        ler(code, eventId),
      ]);

      const validas = [respostaA, respostaB].filter(
        (r) => r.body.result === 'VALID',
      );
      const jaUsadas = [respostaA, respostaB].filter(
        (r) => r.body.result === 'ALREADY_USED',
      );

      // Exatamente uma VALID, exatamente uma ALREADY_USED. Nunca as duas
      // VALID — isso seria o mesmo ingresso passando duas vezes na porta.
      expect(validas).toHaveLength(1);
      expect(jaUsadas).toHaveLength(1);

      // Confirmacao direta no banco, sem confiar so na resposta HTTP.
      const ticket = await prisma.ticket.findFirstOrThrow({ where: { code } });
      expect(ticket.usedAt).not.toBeNull();
    }
  }, 30_000);
});
