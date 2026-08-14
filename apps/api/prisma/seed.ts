import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { EventStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { generateSeats } from '../src/events/seat-layout';

config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Senha unica para todo mundo: o avaliador precisa entrar em quatro contas
// diferentes para percorrer o fluxo. Documentar no README.
const SENHA_PADRAO = 'elite123';

const usuarios = [
  { email: 'organizador@elite.dev', name: 'Ana Organizadora', role: Role.ORGANIZER },
  { email: 'cliente1@elite.dev', name: 'Bruno Cliente', role: Role.CUSTOMER },
  { email: 'cliente2@elite.dev', name: 'Carla Cliente', role: Role.CUSTOMER },
  { email: 'portaria@elite.dev', name: 'Portaria Sala 2', role: Role.GATE },
];

/**
 * Duas sessoes, em salas diferentes, no mesmo dia.
 *
 * Duas e o minimo para a portaria conseguir devolver WRONG_EVENT: com uma so,
 * um dos quatro retornos exigidos pelo enunciado nao teria como ser
 * demonstrado.
 */
const sessoes = [
  {
    tmdbId: 27205,
    title: 'A Origem',
    overview:
      'Dom Cobb invade sonhos para roubar segredos. Sua ultima missao e o oposto: plantar uma ideia na mente de alguem.',
    venue: 'Cine Belas Artes - Sala 2',
    horas: 21,
    priceCents: 4500,
    layout: { rows: 8, seatsPerRow: 12 },
  },
  {
    tmdbId: 438631,
    title: 'Duna',
    overview:
      'Paul Atreides chega a Arrakis, o planeta deserto que guarda a substancia mais valiosa do universo.',
    venue: 'Cine Belas Artes - Sala 4',
    horas: 19,
    priceCents: 5200,
    layout: { rows: 6, seatsPerRow: 10 },
  },
];

/** Amanha no horario informado, para as sessoes semeadas nunca nascerem no passado. */
function amanhaAs(horas: number): Date {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  data.setHours(horas, 0, 0, 0);
  return data;
}

/**
 * Busca o poster no TMDb quando ha chave configurada.
 *
 * O seed nao depende disso: sem chave, ou com o TMDb fora do ar, a sessao e
 * criada sem poster e o resto do fluxo funciona igual. Vale a tentativa porque
 * uma listagem com capa e a primeira impressao de quem abre o projeto.
 */
async function buscarPoster(tmdbId: number): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(
      `${process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3'}/movie/${tmdbId}`,
    );
    url.searchParams.set('language', 'pt-BR');

    // Mesma logica de deteccao do CatalogService: a API Key v3 vai na query,
    // o Read Access Token v4 (um JWT, tres segmentos separados por ponto) vai
    // no header Authorization. Nao dependemos do CatalogService aqui porque o
    // seed roda fora do container de injecao do Nest.
    const headers: HeadersInit = {};
    if (apiKey.split('.').length === 3) {
      headers.authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set('api_key', apiKey);
    }

    const resposta = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) return null;

    const filme = (await resposta.json()) as { poster_path?: string | null };
    return filme.poster_path ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);

  for (const usuario of usuarios) {
    await prisma.user.upsert({
      where: { email: usuario.email },
      update: {},
      create: { ...usuario, passwordHash },
    });
  }

  console.log(`${usuarios.length} usuarios semeados (senha: ${SENHA_PADRAO})`);

  const organizador = await prisma.user.findUniqueOrThrow({
    where: { email: 'organizador@elite.dev' },
    select: { id: true },
  });

  for (const sessao of sessoes) {
    // Idempotente pelo par organizador + sala: rodar o seed duas vezes nao
    // duplica sessao nem multiplica assentos.
    const jaExiste = await prisma.event.findFirst({
      where: { organizerId: organizador.id, venue: sessao.venue },
      select: { id: true },
    });

    if (jaExiste) {
      console.log(`- ${sessao.venue}: ja existe, pulando`);
      continue;
    }

    const posterPath = await buscarPoster(sessao.tmdbId);
    // Mesma funcao usada pela criacao de evento na API. Duplicar a logica aqui
    // seria a forma mais facil de o seed montar uma sala que o sistema nao
    // sabe montar.
    const assentos = generateSeats(
      sessao.layout.rows,
      sessao.layout.seatsPerRow,
    );

    const evento = await prisma.$transaction(async (tx) => {
      const criado = await tx.event.create({
        data: {
          organizerId: organizador.id,
          tmdbId: sessao.tmdbId,
          title: sessao.title,
          overview: sessao.overview,
          posterPath,
          venue: sessao.venue,
          startsAt: amanhaAs(sessao.horas),
          priceCents: sessao.priceCents,
          // PUBLISHED: o enunciado pede ao menos um evento publicado com
          // ingressos disponiveis, para percorrer o fluxo sem montar nada.
          status: EventStatus.PUBLISHED,
        },
        select: { id: true, title: true, startsAt: true },
      });

      await tx.seat.createMany({
        data: assentos.map((assento) => ({ ...assento, eventId: criado.id })),
      });

      return criado;
    });

    console.log(
      `- ${evento.title} em ${sessao.venue}: ${assentos.length} assentos` +
        `${posterPath ? '' : ' (sem poster: TMDB_API_KEY ausente ou catalogo fora do ar)'}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
