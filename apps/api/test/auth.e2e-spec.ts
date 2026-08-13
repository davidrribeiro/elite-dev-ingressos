import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const CONTA = {
  email: 'teste-auth@elite.dev',
  name: 'Conta de Teste',
  password: 'elite123',
};

describe('Autenticacao (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: CONTA.email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: CONTA.email } });
    await app.close();
  });

  it('cadastra sempre como CUSTOMER, mesmo se o papel for enviado', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...CONTA, role: 'ORGANIZER' })
      .expect(400); // forbidNonWhitelisted: campo nao declarado no DTO e recusado

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cadastra e devolve token com papel de cliente', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/auth/register')
      .send(CONTA)
      .expect(201);

    expect(body.user.role).toBe('CUSTOMER');
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('recusa e-mail ja cadastrado', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/auth/register')
      .send(CONTA)
      .expect(409);

    expect(body.error.code).toBe('EMAIL_ALREADY_USED');
  });

  it('nao distingue senha errada de e-mail inexistente', async () => {
    const senhaErrada = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CONTA.email, password: 'errada' })
      .expect(401);

    const naoExiste = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ninguem@elite.dev', password: 'elite123' })
      .expect(401);

    // Respostas identicas: distinguir os dois casos entregaria a lista de
    // e-mails cadastrados a quem tentar.
    expect(senhaErrada.body).toEqual(naoExiste.body);
    expect(senhaErrada.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('protege rota autenticada por padrao', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('recusa token adulterado', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer nao.e.um.token')
      .expect(401);

    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('devolve o usuario da sessao com token valido', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CONTA.email, password: CONTA.password })
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(body.email).toBe(CONTA.email);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('mantem /health publico', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });
});
