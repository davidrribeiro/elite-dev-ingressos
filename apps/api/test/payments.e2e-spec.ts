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
const SUFIXO = '@e2e-payments.dev';

const CARTAO = {
  APROVADO: '4242 4242 4242 4242',
  SALDO_INSUFICIENTE: '4000 0000 0000 0002',
  EXPIRADO: '4000 0000 0000 0069',
  NAO_RECONHECIDO: '5555 5555 5555 4444',
  FORMATO_INVALIDO: '123',
};

const DADOS_DECORATIVOS = {
  holderName: 'BRUNO CLIENTE',
  expiry: '12/30',
  cvv: '123',
};

describe('Pagamento simulado (e2e)', () => {
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
    // Payment.reservationId tambem nao tem onDelete: Cascade — a ordem e
    // Ticket/Payment antes de Reservation, e Reservation antes de Event.
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

  /** Uma sessao nova com assentos livres, e uma reserva ja criada sobre um deles. */
  async function criarReserva(quantidadeAssentos = 1) {
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
        venue: `Sala Pagamento ${Date.now()}${Math.random()}${SUFIXO}`,
        startsAt: new Date(Date.now() + 86_400_000),
        priceCents: 3000,
        status: EventStatus.PUBLISHED,
      },
    });

    const seats = await Promise.all(
      Array.from({ length: quantidadeAssentos }, (_, i) =>
        prisma.seat.create({
          data: { eventId: event.id, row: 'A', number: i + 1 },
        }),
      ),
    );

    const { body: reserva } = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, seatIds: seats.map((s) => s.id) })
      .expect(201);

    return {
      eventId: event.id,
      seatIds: seats.map((s) => s.id),
      reservationId: reserva.id,
    };
  }

  function pagar(reservationId: string, cardNumber: string) {
    return request(app.getHttpServer())
      .post(`/reservations/${reservationId}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cardNumber, ...DADOS_DECORATIVOS });
  }

  it('aprova com o cartao de teste aprovado e emite um ingresso por assento', async () => {
    const { reservationId } = await criarReserva(2);

    const { body } = await pagar(reservationId, CARTAO.APROVADO).expect(200);

    expect(body.status).toBe('APPROVED');
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets[0]).not.toHaveProperty('code'); // code so em GET /tickets/:id

    const reserva = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(reserva.status).toBe('PAID');
  });

  it.each([
    [CARTAO.SALDO_INSUFICIENTE, 'Saldo insuficiente'],
    [CARTAO.EXPIRADO, 'Cartao expirado'],
    [CARTAO.NAO_RECONHECIDO, 'Cartao nao reconhecido pela simulacao'],
  ])(
    'recusa %s mantendo a reserva ativa',
    async (cardNumber, motivoEsperado) => {
      const { reservationId, seatIds } = await criarReserva(1);

      const { body } = await pagar(reservationId, cardNumber).expect(200);

      expect(body.status).toBe('DECLINED');
      expect(body.declineReason).toBe(motivoEsperado);

      // A reserva segue PENDING e o assento continua preso.
      const reserva = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      expect(reserva.status).toBe('PENDING');
      const assentoPreso = await prisma.reservationSeat.count({
        where: { seatId: seatIds[0] },
      });
      expect(assentoPreso).toBe(1);
    },
  );

  it('recusa nao estende o prazo', async () => {
    const { reservationId } = await criarReserva(1);
    const antes = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    await pagar(reservationId, CARTAO.SALDO_INSUFICIENTE).expect(200);

    const depois = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(depois.expiresAt).toEqual(antes.expiresAt);
  });

  it('cartao de formato invalido nao registra tentativa', async () => {
    const { reservationId } = await criarReserva(1);

    const { body } = await pagar(reservationId, CARTAO.FORMATO_INVALIDO).expect(
      400,
    );
    expect(body.error.code).toBe('INVALID_CARD_FORMAT');

    const tentativas = await prisma.payment.count({ where: { reservationId } });
    expect(tentativas).toBe(0);
  });

  it('permite nova tentativa apos recusa, no mesmo pedido', async () => {
    const { reservationId } = await criarReserva(1);

    await pagar(reservationId, CARTAO.SALDO_INSUFICIENTE).expect(200);
    const { body } = await pagar(reservationId, CARTAO.APROVADO).expect(200);

    expect(body.status).toBe('APPROVED');

    const tentativas = await prisma.payment.count({ where: { reservationId } });
    expect(tentativas).toBe(2); // uma recusada, uma aprovada — as duas ficam registradas
  });

  it('reserva ja paga recusa nova tentativa e aponta para os ingressos', async () => {
    const { reservationId } = await criarReserva(1);
    await pagar(reservationId, CARTAO.APROVADO).expect(200);

    const { body } = await pagar(reservationId, CARTAO.APROVADO).expect(409);

    expect(body.error.code).toBe('RESERVATION_ALREADY_PAID');
    expect(body.error.details.ticketIds).toHaveLength(1);
  });

  it('reserva cancelada recusa pagamento', async () => {
    const { reservationId } = await criarReserva(1);

    await request(app.getHttpServer())
      .delete(`/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const { body } = await pagar(reservationId, CARTAO.APROVADO).expect(409);
    expect(body.error.code).toBe('RESERVATION_NOT_PENDING');
  });

  it('numero de cartao nunca aparece no log de erro nem na resposta', async () => {
    const { reservationId } = await criarReserva(1);
    const { text } = await pagar(
      reservationId,
      CARTAO.SALDO_INSUFICIENTE,
    ).expect(200);
    expect(text).not.toContain('4000000000000002');
    expect(text).not.toContain('4000 0000 0000 0002');
  });
});
