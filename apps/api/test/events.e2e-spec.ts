import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CatalogService } from '../src/catalog/catalog.service';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SENHA = 'elite123';
const SUFIXO = '@e2e-events.dev';

// O catalogo e substituido: este teste e sobre a sessao, nao sobre o TMDb.
// Bater na API externa deixaria a suite dependente de chave e de rede.
const FILME = {
  tmdbId: 27205,
  title: 'A Origem',
  overview: 'Um ladrao que invade sonhos.',
  posterPath: '/poster.jpg',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  releaseDate: '2010-07-16',
};

describe('Sessoes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenOrganizador: string;
  let tokenOutroOrganizador: string;
  let tokenCliente: string;
  let eventoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CatalogService)
      .useValue({
        getMovie: jest.fn().mockResolvedValue(FILME),
        searchMovies: jest.fn().mockResolvedValue([FILME]),
        posterUrl: (path: string | null) =>
          path ? `https://image.tmdb.org/t/p/w500${path}` : null,
      })
      .compile();

    app = configureApp(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();

    prisma = app.get(PrismaService);
    await limpar();

    const passwordHash = await bcrypt.hash(SENHA, 4); // rounds baixos: teste
    await prisma.user.createMany({
      data: [
        {
          email: `organizador${SUFIXO}`,
          name: 'Organizadora',
          passwordHash,
          role: Role.ORGANIZER,
        },
        {
          email: `outro${SUFIXO}`,
          name: 'Outro Organizador',
          passwordHash,
          role: Role.ORGANIZER,
        },
        {
          email: `cliente${SUFIXO}`,
          name: 'Cliente',
          passwordHash,
          role: Role.CUSTOMER,
        },
      ],
    });

    tokenOrganizador = await entrar(`organizador${SUFIXO}`);
    tokenOutroOrganizador = await entrar(`outro${SUFIXO}`);
    tokenCliente = await entrar(`cliente${SUFIXO}`);
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  async function limpar() {
    // Os assentos caem por cascade junto com o evento.
    await prisma.event.deleteMany({
      where: { organizer: { email: { endsWith: SUFIXO } } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: SUFIXO } } });
  }

  async function entrar(email: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: SENHA })
      .expect(200);
    return body.token as string;
  }

  const novaSessao = {
    tmdbId: FILME.tmdbId,
    venue: 'Cine Belas Artes - Sala 2',
    startsAt: '2026-09-01T21:00:00.000Z',
    priceCents: 4500,
    layout: { rows: 8, seatsPerRow: 12 },
  };

  it('cliente nao cria sessao', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send(novaSessao)
      .expect(403);

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('organizador cria sessao e os assentos nascem junto', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send(novaSessao)
      .expect(201);

    eventoId = body.id;
    expect(body.status).toBe('DRAFT');
    expect(body.title).toBe(FILME.title);

    // 8 fileiras x 12 assentos, em uma transacao com a criacao da sessao.
    const assentos = await prisma.seat.count({ where: { eventId: eventoId } });
    expect(assentos).toBe(96);
  });

  it('recusa layout fora dos limites', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .send({ ...novaSessao, layout: { rows: 99, seatsPerRow: 12 } })
      .expect(400);

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sessao em rascunho nao aparece na listagem publica', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/events')
      .expect(200);

    expect(body.events.map((e: { id: string }) => e.id)).not.toContain(eventoId);
  });

  it('outro organizador nao publica sessao alheia', async () => {
    const { body } = await request(app.getHttpServer())
      .post(`/events/${eventoId}/publish`)
      .set('Authorization', `Bearer ${tokenOutroOrganizador}`)
      .expect(403);

    // 403 e nao 404: a sessao existe, so nao e dele.
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('publica e passa a aparecer na listagem publica', async () => {
    await request(app.getHttpServer())
      .post(`/events/${eventoId}/publish`)
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .get('/events')
      .expect(200);

    expect(body.events.map((e: { id: string }) => e.id)).toContain(eventoId);
    expect(body.serverNow).toEqual(expect.any(String));
  });

  it('mapa de assentos comeca inteiro disponivel', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/events/${eventoId}`)
      .expect(200);

    expect(body.seats).toHaveLength(96);
    expect(body.seats.every((s: { status: string }) => s.status === 'AVAILABLE')).toBe(
      true,
    );

    // Ordenado por fileira e numero: o front desenha na ordem que recebe.
    expect(body.seats[0]).toMatchObject({ row: 'A', number: 1 });
    expect(body.seats[95]).toMatchObject({ row: 'H', number: 12 });
  });

  it('filtra a listagem publica por termo', async () => {
    const achou = await request(app.getHttpServer())
      .get('/events?q=Belas Artes')
      .expect(200);
    expect(achou.body.events.map((e: { id: string }) => e.id)).toContain(eventoId);

    const naoAchou = await request(app.getHttpServer())
      .get('/events?q=nao-existe-esse-lugar')
      .expect(200);
    expect(naoAchou.body.events.map((e: { id: string }) => e.id)).not.toContain(
      eventoId,
    );
  });

  it('painel do organizador lista as sessoes dele', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/organizer/events')
      .set('Authorization', `Bearer ${tokenOrganizador}`)
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: eventoId, totalSeats: 96 });
  });

  it('painel do organizador nao vaza sessao de outro', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/organizer/events')
      .set('Authorization', `Bearer ${tokenOutroOrganizador}`)
      .expect(200);

    expect(body).toHaveLength(0);
  });
});
