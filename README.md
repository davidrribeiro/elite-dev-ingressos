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

Para o catalogo funcionar, preencha `TMDB_API_KEY` no `.env`. Aceita as duas
credenciais da pagina https://www.themoviedb.org/settings/api — a API Key
curta (v3) ou o Read Access Token (v4, um JWT longo) — detectadas pelo
formato, sem precisar escolher a certa.

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

O seed tambem planta uma sessao com movimento (3 ingressos vendidos, um deles
ja validado na portaria, e uma reserva abandonada ja vencida) e uma segunda
sessao vazia, para comparar os dois estados lado a lado. Os codigos dos
ingressos de exemplo aparecem no terminal ao fim do `npm run db:seed` —
copie um deles para testar a portaria sem precisar comprar um ingresso do
zero.

## Cartoes de pagamento simulado

A tela de pagamento mostra esta tabela; nenhum numero real e cobrado.

| Cartao | Resultado |
|---|---|
| `4242 4242 4242 4242` | Aprovado |
| `4000 0000 0000 0002` | Recusado — saldo insuficiente |
| `4000 0000 0000 0069` | Recusado — cartao expirado |
| Qualquer outro numero valido | Recusado — nao reconhecido |

Nome, validade e CVV sao decorativos e nao influenciam o resultado.

## Testes

```bash
npm test              # unitarios (logica pura: gateway, codigo do ingresso, layout de assentos)
npm run test:e2e      # de ponta a ponta, contra um banco real em schema separado
```

`test:e2e` sobe o banco (`db:up`) e aplica as migrations no schema `test`
antes de rodar — nao precisa de nenhum passo manual. Os testes que provam as
tres garantias de concorrencia do projeto (assento nao vendido duas vezes,
pagamento nao cobrado duas vezes, ingresso nao validado duas vezes) disparam
requisicoes simultaneas em dez rodadas cada; exigem banco de verdade porque a
garantia sendo testada e do Postgres, e mock nao prova nada nesse caso.

## Limitacoes conhecidas

- **Leitura de QR pela camera exige `https` ou `localhost`.** E restricao do
  navegador (`getUserMedia`), nao da aplicacao — testar pelo IP da maquina na
  rede local (por exemplo, de um celular) faz a permissao de camera falhar
  silenciosamente. A digitacao manual do codigo cobre esse caso e nao e
  alternativa de segunda classe: e o caminho que garante a portaria operar
  mesmo sem camera.
- **Criacao de evento pelo organizador nao tem tela.** O painel do organizador
  lista as sessoes existentes e permite cancelar, mas criar uma sessao nova a
  partir do catalogo do TMDb hoje so acontece via API ou pelo seed. Os dados
  de teste exigidos pelo desafio ja vem prontos; nao construi essa tela por
  nao ter sido pedida nas tarefas planejadas para a entrega.
- **Sem deploy.** A aplicacao roda local via Docker Compose (banco) e os dois
  `npm run dev:*`; nao foi publicada.
- **Ingresso emitido nao pode ser cancelado, estornado ou transferido.**
  Decisao deliberada (ver `docs/decisoes.md`), nao lacuna — a tela do
  ingresso declara isso explicitamente.

## Documentacao

- [`docs/decisoes.md`](docs/decisoes.md) — o que foi escolhido, o que foi
  descartado e por que, incluindo a secao **Uso de IA**.
- [`docs/contrato-api.md`](docs/contrato-api.md) — contrato entre front e API.
- [`specs/001-decisoes-em-aberto/`](specs/001-decisoes-em-aberto/) —
  especificacao, plano tecnico e as tarefas que guiaram a implementacao.
- [`AGENTS.md`](AGENTS.md) — arquivo de contexto usado com IA.

---
