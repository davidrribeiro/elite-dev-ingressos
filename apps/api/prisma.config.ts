import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// PRISMA_ENV=test aponta para o schema separado dos testes e2e.
const envFile = process.env.PRISMA_ENV === 'test' ? '.env.test' : '.env';
config({ path: path.resolve(__dirname, '../..', envFile) });

// O Prisma 7 tirou a connection string do schema.prisma e trouxe para ca.
// O .env fica na raiz do monorepo, compartilhado com o docker-compose.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
