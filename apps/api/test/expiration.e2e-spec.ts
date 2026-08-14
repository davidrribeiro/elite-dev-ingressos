import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, ReservationStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ClockService } from '../src/common/clock/clock.service';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SENHA = 'elite123';
const SUFIXO = '@e2e-expiration.dev';
const PRAZO_MINUTOS = 10;

/**
 * Relogio controlado pelo teste.
 *
 * Substitui o ClockService real via overrideProvider: sem isso, provar
 * expiracao exigiria um `sleep` de dez minutos, o que tornaria a suite
 * inutilizavel. Ver research.md R11.
 */
class RelogioDeTeste extends ClockService {
  private agora = new Date();

  override now(): Date {
    return this.agora;
  }

  avancarMinutos(minutos: number) {
    this.agora = new Date(this.agora.getTime() + minutos * 60_000);
  }
}

describe('Expiracao de reserva (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let relogio: RelogioDeTeste;
  let token: string;
  let outroToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClockService)
      .useClass(RelogioDeTeste)
      .compile();

    app = configureApp(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();

    relogio = app.get(ClockService);
    prisma = app.get(PrismaService);
    await limpar();

    const passwordHash = await bcrypt.hash(SENHA, 4);
    await prisma.user.createMany({
      data: [
        {
          email: `dono${SUFIXO}`,
          name: 'Dono da reserva',
          passwordHash,
          role: Role.CUSTOMER,
        },
        {
          email: `outro${SUFIXO}`,
          name: 'Outro cliente',
          passwordHash,
          role: Role.CUSTOMER,
        },
      ],
    });

    token = await entrar(`dono${SUFIXO}`);
    outroToken = await entrar(`outro${SUFIXO}`);
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

  it('reserva vencida devolve o assento e vira EXPIRED, nao CANCELLED', async () => {
    const organizador = await prisma.user.create({
      data: {
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
        venue: `Sala Expiracao${SUFIXO}`,
        startsAt: new Date(relogio.now().getTime() + 86_400_000),
        priceCents: 1000,
        status: EventStatus.PUBLISHED,
      },
    });

    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    // Reserva o assento. Ate aqui, tempo normal.
    const criada = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const reservationId = criada.body.id;
    expect(criada.body.status).toBe('PENDING');

    // Antes do prazo vencer: o mapa mostra o assento ocupado para outro cliente.
    const mapaAntes = await request(app.getHttpServer())
      .get(`/events/${event.id}`)
      .expect(200);
    expect(mapaAntes.body.seats[0].status).toBe('TAKEN');

    // Avanca o relogio para depois do prazo. Nenhuma escrita ainda aconteceu —
    // e exatamente o estado de um carrinho abandonado.
    relogio.avancarMinutos(PRAZO_MINUTOS + 1);

    // A leitura do mapa por OUTRO cliente e o que dispara a varredura.
    const mapaDepois = await request(app.getHttpServer())
      .get(`/events/${event.id}`)
      .expect(200);
    expect(mapaDepois.body.seats[0].status).toBe('AVAILABLE');

    // O mesmo assento pode ser reservado por outro cliente agora.
    await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${outroToken}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    // A reserva original consta como EXPIRED, nunca CANCELLED — o cliente nao
    // cancelou, o prazo venceu.
    const original = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(original.status).toBe(ReservationStatus.EXPIRED);

    // A consulta direta da reserva vencida tambem reflete o novo status.
    const consulta = await request(app.getHttpServer())
      .get(`/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(consulta.body.status).toBe('EXPIRED');
  });

  it('reserva ainda dentro do prazo nao e afetada pela varredura', async () => {
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
        title: 'Sessao dentro do prazo',
        venue: `Sala Dentro Prazo${SUFIXO}`,
        startsAt: new Date(relogio.now().getTime() + 86_400_000),
        priceCents: 1000,
        status: EventStatus.PUBLISHED,
      },
    });

    const seat = await prisma.seat.create({
      data: { eventId: event.id, row: 'A', number: 1 },
    });

    const criada = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const mapa = await request(app.getHttpServer())
      .get(`/events/${event.id}`)
      .expect(200);
    expect(mapa.body.seats[0].status).toBe('TAKEN');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: criada.body.id },
    });
    expect(reservation.status).toBe(ReservationStatus.PENDING);
  });
});
