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
const SUFIXO = '@e2e-tickets.dev';

describe('Ingressos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let outroToken: string;
  let ticketId: string;
  let shareToken: string;
  let code: string;

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
          name: 'Dono do ingresso',
          passwordHash,
          role: Role.CUSTOMER,
        },
        {
          email: `outro${SUFIXO}`,
          name: 'Outro cliente',
          passwordHash,
          role: Role.CUSTOMER,
        },
        {
          email: `organizador${SUFIXO}`,
          name: 'Organizadora',
          passwordHash,
          role: Role.ORGANIZER,
        },
      ],
    });

    token = await entrar(`cliente${SUFIXO}`);
    outroToken = await entrar(`outro${SUFIXO}`);

    const organizador = await prisma.user.findUniqueOrThrow({
      where: { email: `organizador${SUFIXO}` },
    });
    const event = await prisma.event.create({
      data: {
        organizerId: organizador.id,
        title: 'Sessao de teste',
        venue: `Sala Ingressos${SUFIXO}`,
        startsAt: new Date(Date.now() + 86_400_000),
        priceCents: 3000,
        status: EventStatus.PUBLISHED,
      },
    });
    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    const { body: reserva } = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const { body: pagamento } = await request(app.getHttpServer())
      .post(`/reservations/${reserva.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cardNumber: '4242424242424242',
        holderName: 'X',
        expiry: '12/30',
        cvv: '123',
      })
      .expect(200);

    ticketId = pagamento.tickets[0].id;

    const ticketNoBanco = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    shareToken = ticketNoBanco.shareToken;
    code = ticketNoBanco.code;
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  async function limpar() {
    await prisma.ticket.deleteMany({
      where: { reservation: { customer: { email: { endsWith: SUFIXO } } } },
    });
    // Payment.reservationId tambem nao tem onDelete: Cascade.
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

  it('GET /me/tickets nao inclui o code em nenhuma profundidade', async () => {
    const { text, body } = await request(app.getHttpServer())
      .get('/me/tickets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toHaveLength(1);
    expect(text).not.toContain(code);
  });

  it('GET /tickets/:id do dono traz o code', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.code).toBe(code);
    expect(body.shareToken).toBe(shareToken);
  });

  it('GET /tickets/:id de outro cliente e recusado', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${outroToken}`)
      .expect(403);

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('GET /public/tickets/:shareToken nao contem o code em nenhum campo, em nenhuma profundidade', async () => {
    const { text, body } = await request(app.getHttpServer())
      .get(`/public/tickets/${shareToken}`)
      .expect(200);

    // Duas checagens: o texto cru da resposta nao contem a string do code
    // (pega qualquer lugar aninhado), e o objeto nao tem a chave 'code' em
    // nenhum nivel.
    expect(text).not.toContain(code);
    expect(JSON.stringify(body)).not.toContain('"code"');
    expect(body.holder).toBe('Dono do ingresso');
  });

  it('link publico funciona sem autenticacao', async () => {
    await request(app.getHttpServer())
      .get(`/public/tickets/${shareToken}`)
      .expect(200);
  });

  it('shareToken invalido responde NOT_FOUND, nao 500', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/public/tickets/token-que-nao-existe')
      .expect(404);

    expect(body.error.code).toBe('NOT_FOUND');
  });
});
