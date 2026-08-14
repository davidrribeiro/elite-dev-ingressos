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
const SUFIXO = '@e2e-payment-concurrency.dev';
const REPETICOES = 10;

const DADOS_CARTAO = {
  cardNumber: '4242 4242 4242 4242',
  holderName: 'BRUNO CLIENTE',
  expiry: '12/30',
  cvv: '123',
};

/**
 * O clique duplo no botao de pagar nao pode gerar duas cobrancas aprovadas
 * nem dois conjuntos de ingressos para a mesma reserva.
 *
 * Sem chave de idempotencia: a transicao condicional PENDING -> PAID e o
 * unico portao. Ver research.md R3.
 */
describe('Pagamento sob clique duplo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;

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

    await prisma.user.create({
      data: {
        email: `cliente${SUFIXO}`,
        name: 'Cliente',
        passwordHash: await bcrypt.hash(SENHA, 4),
        role: Role.CUSTOMER,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `cliente${SUFIXO}`, password: SENHA })
      .expect(200);
    token = login.body.token;
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  async function limpar() {
    // Ticket e Payment tambem nao tem onDelete: Cascade a partir de
    // Reservation — vao antes dela, que vai antes de Event.
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

  async function criarReserva(): Promise<string> {
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
        venue: `Sala Clique Duplo ${Date.now()}${Math.random()}${SUFIXO}`,
        startsAt: new Date(Date.now() + 86_400_000),
        priceCents: 3000,
        status: EventStatus.PUBLISHED,
      },
    });

    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    const { body } = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    return body.id;
  }

  function pagar(reservationId: string) {
    return request(app.getHttpServer())
      .post(`/reservations/${reservationId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send(DADOS_CARTAO);
  }

  it(`sob ${REPETICOES} tentativas simultaneas de pagar a mesma reserva, exatamente uma aprova`, async () => {
    for (let rodada = 0; rodada < REPETICOES; rodada++) {
      const reservationId = await criarReserva();

      const [respostaA, respostaB] = await Promise.all([
        pagar(reservationId),
        pagar(reservationId),
      ]);

      const aprovacoesNaResposta = [respostaA, respostaB].filter(
        (r) => r.body.status === 'APPROVED',
      );

      // Exatamente uma resposta aprova. Nunca as duas — isso seria
      // cobranca duplicada e ingresso duplicado. Nunca nenhuma — a
      // corrida nao deveria fazer as duas perderem.
      expect(aprovacoesNaResposta).toHaveLength(1);

      const vencedora =
        respostaA.body.status === 'APPROVED' ? respostaA : respostaB;
      const perdedora =
        respostaA.body.status === 'APPROVED' ? respostaB : respostaA;

      expect(vencedora.status).toBe(200);
      expect(perdedora.status).toBe(409);
      expect(perdedora.body.error.code).toBe('RESERVATION_ALREADY_PAID');

      // Confirmacao direta no banco: um unico ingresso para o unico
      // assento, nunca dois — o teste nao deveria confiar so na resposta HTTP.
      const ingressos = await prisma.ticket.count({ where: { reservationId } });
      expect(ingressos).toBe(1);

      const aprovacoes = await prisma.payment.count({
        where: { reservationId, status: 'APPROVED' },
      });
      expect(aprovacoes).toBe(1);
    }
  }, 30_000);
});
