# Elite Events

Plataforma de eventos e ingressos: o organizador monta sessoes a partir do
catalogo do TMDb, o cliente escolhe o lugar no mapa de assentos, paga de forma
simulada e recebe um ingresso com QR; a portaria valida na entrada.

Desafio Elite Dev — Verzel.

## Stack

| Camada | Escolha |
|---|---|
| Front-end | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Back-end | NestJS 11, TypeScript |
| Banco | PostgreSQL 16 + Prisma 7 |
| Catalogo | TMDb |

Monorepo com npm workspaces: `apps/web` e `apps/api` sao aplicacoes
independentes. O front nunca fala com o banco — toda regra e validacao ficam
na API.

## Como rodar

Precisa de Node 20+ e Docker.

```bash
# 1. dependencias
npm install

# 2. variaveis de ambiente
cp .env.example .env                     # API, banco e TMDb
cp apps/web/.env.example apps/web/.env.local

# 3. banco (Postgres em container)
npm run db:up

# 4. schema + dados de teste
npm run db:migrate
npm run db:seed

# 5. as duas aplicacoes, em terminais separados
npm run dev:api    # http://localhost:3333
npm run dev:web    # http://localhost:3000
```

Para o catalogo funcionar, preencha `TMDB_API_KEY` no `.env` com uma chave
gratuita de https://www.themoviedb.org/settings/api.

Outros comandos: `npm run db:down` derruba o banco, `npm run db:studio` abre o
Prisma Studio.

## Contas de teste

Criadas pelo `npm run db:seed`. Senha de todas: `elite123`.

| Papel | E-mail |
|---|---|
| Organizador | organizador@elite.dev |
| Cliente | cliente1@elite.dev |
| Cliente | cliente2@elite.dev |
| Portaria | portaria@elite.dev |

## Documentacao

- [`docs/decisoes.md`](docs/decisoes.md) — o que foi escolhido, o que foi
  descartado e por que.
- [`docs/contrato-api.md`](docs/contrato-api.md) — contrato entre front e API.
- [`AGENTS.md`](AGENTS.md) — arquivo de contexto usado com IA.

---

## _(a preencher antes de entregar)_

- **Uso de IA** — ferramentas usadas, em que partes, e o que foi feito na mao.
  Exigido pelo enunciado.
- **O que nao esta funcionando** — a ausencia de explicacao pesa na nota.
- **Deploy** — URL da aplicacao publicada, se houver (vale 1 ponto).
- **Testes** — o que esta coberto e como rodar.
