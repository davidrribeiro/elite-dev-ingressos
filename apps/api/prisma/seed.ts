import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  EventStatus,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { generateSeats } from '../src/events/seat-layout';
import {
  formatTicketCode,
  generateShareToken,
  generateTicketCode,
} from '../src/tickets/ticket-code';

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

interface IngressoImpresso {
  holder: string;
  seat: string;
  code: string;
  situacao: string;
}

/**
 * Popula a primeira sessao com compras de verdade: assentos vendidos, um
 * ingresso ja validado (para demonstrar ALREADY_USED sem precisar ler duas
 * vezes na frente de quem avalia) e uma reserva PENDING ja vencida (para
 * demonstrar a devolucao do assento sem esperar dez minutos).
 *
 * Escreve direto pelas tabelas em vez de chamar os services do Nest: o seed
 * roda fora do container de injecao, entao replica exatamente as mesmas
 * escritas que PaymentsService.approve() faz — reserva PAID, ReservationSeat,
 * Payment aprovado e Ticket, nessa ordem — para o estado gerado ser
 * indistinguivel de uma compra real passada pela API.
 */
async function semearVendasDeExemplo(params: {
  eventId: string;
  priceCents: number;
}): Promise<IngressoImpresso[]> {
  const [cliente1, cliente2, portaria, assentos] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'cliente1@elite.dev' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'cliente2@elite.dev' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'portaria@elite.dev' } }),
    prisma.seat.findMany({
      where: { eventId: params.eventId },
      orderBy: [{ row: 'asc' }, { number: 'asc' }],
      take: 4,
    }),
  ]);

  const [seatJaValidado, seatVendidoA, seatVendidoB, seatReservaVencida] = assentos;
  const impressos: IngressoImpresso[] = [];

  async function comprar(
    seat: (typeof assentos)[number],
    customerId: string,
    holderName: string,
    jaValidado: boolean,
  ) {
    const reserva = await prisma.reservation.create({
      data: {
        eventId: params.eventId,
        customerId,
        status: ReservationStatus.PAID,
        totalCents: params.priceCents,
        // Prazo irrelevante aqui — a reserva ja nasce paga, como uma compra
        // concluida ha algum tempo.
        expiresAt: new Date(),
      },
    });

    await prisma.reservationSeat.create({
      data: { reservationId: reserva.id, seatId: seat.id },
    });

    await prisma.payment.create({
      data: {
        reservationId: reserva.id,
        status: PaymentStatus.APPROVED,
        amountCents: params.priceCents,
      },
    });

    const code = generateTicketCode();

    await prisma.ticket.create({
      data: {
        reservationId: reserva.id,
        eventId: params.eventId,
        seatId: seat.id,
        code,
        shareToken: generateShareToken(),
        ...(jaValidado
          ? { usedAt: new Date(), validatedById: portaria.id }
          : {}),
      },
    });

    impressos.push({
      holder: holderName,
      seat: `${seat.row}${seat.number}`,
      code: formatTicketCode(code),
      situacao: jaValidado ? 'JA VALIDADO na portaria' : 'valido, nao usado',
    });
  }

  await comprar(seatJaValidado, cliente1.id, cliente1.name, true);
  await comprar(seatVendidoA, cliente1.id, cliente1.name, false);
  await comprar(seatVendidoB, cliente2.id, cliente2.name, false);

  // Reserva PENDING ja vencida: nao e liberada aqui de proposito — a
  // liberacao e sob demanda (releaseExpired), disparada pela primeira
  // leitura do mapa ou tentativa de reserva. E exatamente isso que o
  // cenario 1 do quickstart pede para demonstrar.
  const reservaVencida = await prisma.reservation.create({
    data: {
      eventId: params.eventId,
      customerId: cliente2.id,
      status: ReservationStatus.PENDING,
      totalCents: params.priceCents,
      expiresAt: new Date(Date.now() - 5 * 60_000),
    },
    select: { id: true },
  });

  await prisma.reservationSeat.create({
    data: { reservationId: reservaVencida.id, seatId: seatReservaVencida.id },
  });

  return impressos;
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

  const codigosParaImprimir: IngressoImpresso[] = [];

  for (const [indice, sessao] of sessoes.entries()) {
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

    // So a primeira sessao ganha compras de exemplo — a segunda fica limpa,
    // para quem avalia ver os dois estados lado a lado: uma sala com
    // movimento e uma sala vazia.
    if (indice === 0) {
      const impressos = await semearVendasDeExemplo({
        eventId: evento.id,
        priceCents: sessao.priceCents,
      });
      codigosParaImprimir.push(...impressos);
      console.log(
        `  3 ingressos vendidos (1 ja validado) + 1 reserva pendente vencida`,
      );
    }
  }

  if (codigosParaImprimir.length > 0) {
    console.log('\nIngressos de exemplo (para digitar na portaria):');
    for (const ingresso of codigosParaImprimir) {
      console.log(
        `  ${ingresso.code}  ${ingresso.seat}  ${ingresso.holder}  — ${ingresso.situacao}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
