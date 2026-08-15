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
const SUFIXO = '@e2e-gate.dev';

describe('Portaria (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenCliente: string;
  let tokenPortaria: string;
  let eventoA: string;
  let eventoB: string;
  let ticketValidoA: { id: string; code: string };
  let ticketDaOutraSessao: { id: string; code: string };

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
          name: 'Bruno Cliente',
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

    const organizador = await prisma.user.findUniqueOrThrow({
      where: { email: `organizador${SUFIXO}` },
    });

    async function criarSessaoComIngresso(
      venue: string,
    ): Promise<{ eventId: string; ticket: { id: string; code: string } }> {
      const event = await prisma.event.create({
        data: {
          organizerId: organizador.id,
          title: 'Sessao de teste',
          venue,
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
        select: { id: true, code: true },
      });

      return { eventId: event.id, ticket };
    }

    const sessaoA = await criarSessaoComIngresso(`Sala A${SUFIXO}`);
    eventoA = sessaoA.eventId;
    ticketValidoA = sessaoA.ticket;

    const sessaoB = await criarSessaoComIngresso(`Sala B${SUFIXO}`);
    eventoB = sessaoB.eventId;
    ticketDaOutraSessao = sessaoB.ticket;
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

  function validar(code: string, eventId?: string) {
    return request(app.getHttpServer())
      .post('/gate/validate')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .send({ code, ...(eventId ? { eventId } : {}) });
  }

  it('cliente nao acessa a portaria', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/gate/validate')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ code: ticketValidoA.code, eventId: eventoA })
      .expect(403);

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('sem eventId responde GATE_SESSION_REQUIRED', async () => {
    const { body, status } = await validar(ticketValidoA.code);
    expect(status).toBe(400);
    expect(body.error.code).toBe('GATE_SESSION_REQUIRED');
  });

  it('codigo inexistente responde INVALID sem detalhe', async () => {
    const { body, status } = await validar('CODIGOFALSO12345', eventoA);
    expect(status).toBe(200);
    expect(body).toEqual({ result: 'INVALID' });
  });

  it('ingresso de outra sessao responde WRONG_EVENT e nao marca como usado', async () => {
    const { body, status } = await validar(ticketDaOutraSessao.code, eventoA);

    expect(status).toBe(200);
    expect(body.result).toBe('WRONG_EVENT');
    expect(body.belongsTo.venue).toBe(`Sala B${SUFIXO}`);

    // O ingresso continua valido na sessao correta.
    const ticketNoBanco = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketDaOutraSessao.id },
    });
    expect(ticketNoBanco.usedAt).toBeNull();

    const { body: correto } = await validar(
      ticketDaOutraSessao.code,
      eventoB,
    ).expect(200);
    expect(correto.result).toBe('VALID');
  });

  it('normaliza o codigo digitado a mao: minuscula, hifen e I/L/O trocados', async () => {
    // Usa um ingresso ainda intacto (o de eventoA, ainda nao validado neste arquivo).
    const codigoDigitadoErrado = ticketValidoA.code
      .toLowerCase()
      .replace(/1/g, 'i') // digitou I no lugar de 1
      .match(/.{1,4}/g)
      ?.join('-');

    const { body, status } = await validar(codigoDigitadoErrado!, eventoA);
    expect(status).toBe(200);
    expect(body.result).toBe('VALID');
    expect(body.ticket.holder).toBe('Bruno Cliente');
  });

  it('a mesma leitura de novo responde ALREADY_USED com o instante anterior', async () => {
    const { body, status } = await validar(ticketValidoA.code, eventoA);

    expect(status).toBe(200);
    expect(body.result).toBe('ALREADY_USED');
    expect(body.usedAt).toEqual(expect.any(String));
    expect(body.ticket.seat).toBe('A1');
  });

  it('GET /gate/events lista as sessoes publicadas com contagem de ingressos', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/gate/events')
      .set('Authorization', `Bearer ${tokenPortaria}`)
      .expect(200);

    const todas = [...body.today, ...body.upcoming];
    const encontrada = todas.find((e: { id: string }) => e.id === eventoA);
    expect(encontrada).toMatchObject({ ticketsIssued: 1, ticketsUsed: 1 });
  });
});
