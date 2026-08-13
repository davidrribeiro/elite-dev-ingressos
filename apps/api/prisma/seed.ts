import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

  // TODO: semear ao menos um evento PUBLISHED com assentos disponiveis —
  // e um requisito do desafio. Fazer depois que EventsService existir, para
  // reaproveitar a geracao de assentos em vez de duplicar a logica aqui.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
