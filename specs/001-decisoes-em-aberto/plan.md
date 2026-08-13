# Implementation Plan: Decisoes em aberto do fluxo de compra

**Branch**: `001-decisoes-em-aberto` (trabalho na `main`; nenhuma extensao git registrada) | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-decisoes-em-aberto/spec.md`

## Summary

Fechar as quatro regras que faltavam para o fluxo de compra existir de ponta a
ponta: devolucao de assentos de reservas vencidas, resultado deterministico do
pagamento simulado, delimitacao da portaria por sessao e definitividade da
compra.

A abordagem tecnica tem um unico principio, herdado do que ja esta em
`AGENTS.md`: **toda transicao de estado disputada e uma escrita condicional de
uma instrucao so, decidida pelo numero de linhas afetadas**. Nunca ler, decidir
em `if` e depois escrever. Isso ja valia para a trava do assento e para a
validacao do ingresso; esta feature estende o mesmo padrao para expiracao e
pagamento, o que elimina as tres corridas restantes sem transacao serializavel,
sem lock explicito e sem rotina agendada.

Resultado da analise de dados: **nenhuma migration e necessaria**. O schema atual
ja suporta todos os 31 requisitos. Ha um indice opcional de desempenho descrito
em [data-model.md](./data-model.md).

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node 20+

**Primary Dependencies**: NestJS 11, Prisma 7.9.1 (driver adapter `@prisma/adapter-pg`), Next.js 16 / React 19, Tailwind v4, `@nestjs/jwt`, `bcryptjs`, `class-validator`. A adicionar: `qrcode` (geracao do QR no servidor) e `@zxing/browser` (leitura pela camera na portaria).

**Storage**: PostgreSQL 16 em container (`docker-compose.yml`), acessado apenas pela API.

**Testing**: Jest + Supertest (ja configurados em `apps/api`). Os testes desta feature exigem banco real — as garantias sendo testadas sao do banco, e mock nao prova nada aqui.

**Target Platform**: navegador moderno (a portaria depende de `getUserMedia`, que exige `https` ou `localhost`) + servidor Linux.

**Project Type**: aplicacao web, monorepo com dois workspaces independentes.

**Performance Goals**: sem meta de carga. A restricao real e de corretude sob concorrencia, nao de throughput: o sistema precisa se comportar corretamente com 2 a 10 requisicoes simultaneas disputando o mesmo assento ou o mesmo ingresso.

**Constraints**:
- Nivel de isolamento padrao (Read Committed). Se o desenho precisar de `Serializable` para ficar correto, o desenho esta errado.
- Sem rotina agendada, sem worker, sem fila — decisao registrada em [spec.md](./spec.md) e justificada em [research.md](./research.md).
- Nada de numero de cartao no banco (FR-016).
- O `code` do ingresso nunca trafega no fluxo de compartilhamento publico.

**Scale/Scope**: escopo de avaliacao. ~4 modulos de API tocados, ~6 telas de front, 4 contas e 1 sessao semeadas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra `.specify/memory/constitution.md` v1.0.0 (ratificada em
2026-08-13, depois deste plano ser escrito — os portoes originais vinham das
mesmas invariantes, entao a reavaliacao nao mudou nenhum resultado).

| Principio | Antes do Phase 0 | Apos o Phase 1 |
|---|---|---|
| I. Garantias criticas moram no banco | PASS | PASS — expiracao e pagamento passaram a usar o mesmo padrao de escrita condicional; as quatro corridas tem teste em laco previsto nas tarefas |
| II. A API e a unica autoridade | PASS | PASS — o contador regressivo e informativo; quem decide a expiracao e a escrita condicional do servidor |
| III. Toda escolha relevante fica registrada | PASS | PASS — 11 decisoes em research.md, com o descartado e o motivo; T063 leva o essencial para `docs/decisoes.md` |
| IV. A interface e decisao do autor | PASS | PASS — o plano define comportamento e contrato; layout fica fora do escopo destes artefatos, e T016 exige o partido visual registrado antes de qualquer tela |
| V. Simplicidade tem que se pagar | PASS | PASS — nenhuma infraestrutura nova; 2 libs de front, ambas com alternativa avaliada em research.md R6 e R7 |

Nenhuma violacao. A tabela de Complexity Tracking fica vazia e foi removida.

O principio V e o que mais pesou no desenho: a varredura sob demanda (R1) existe
justamente para nao introduzir agendador, e a ausencia de chave de idempotencia
(R3) segue a mesma regra.

## Project Structure

### Documentation (this feature)

```text
specs/001-decisoes-em-aberto/
├── plan.md              # Este arquivo
├── research.md          # Phase 0: as 10 decisoes tecnicas e o que foi descartado
├── data-model.md        # Phase 1: entidades, estados e por que nao ha migration
├── quickstart.md        # Phase 1: como provar que funciona
├── contracts/
│   ├── README.md        # Convencoes: erros, projecoes, autorizacao
│   ├── reservations.md  # Reserva, expiracao, cancelamento
│   ├── payments.md      # Pagamento simulado
│   └── gate.md          # Portaria: sessoes e validacao
├── checklists/
│   └── requirements.md  # Validacao da spec
└── tasks.md             # Phase 2 (/speckit-tasks — nao criado aqui)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma            # inalterado (1 indice opcional)
│   └── seed.ts                  # ganha sessao publicada, assentos e um ingresso ja validado
├── src/
│   ├── common/
│   │   ├── errors/              # envelope de erro e filtro global
│   │   └── clock/               # relogio injetavel (torna a expiracao testavel sem sleep)
│   ├── reservations/
│   │   ├── reservations.service.ts   # criar, cancelar, releaseExpired
│   │   ├── reservations.controller.ts
│   │   └── dto/
│   ├── payments/
│   │   ├── payments.service.ts       # tabela de cartoes + transicao condicional
│   │   ├── simulated-gateway.ts      # numero do cartao -> resultado
│   │   └── dto/
│   ├── tickets/
│   │   ├── tickets.service.ts        # emissao, codigo, shareToken
│   │   └── ticket-code.ts            # base32 Crockford, geracao e normalizacao
│   ├── gate/
│   │   ├── gate.service.ts           # validacao condicional, 4 resultados
│   │   └── gate.controller.ts
│   └── events/
│       └── events.service.ts         # chama releaseExpired antes do mapa; bloqueia cancelamento
└── test/
    └── concurrency.e2e-spec.ts       # as corridas: assento, pagamento, portaria

apps/web/
├── app/
│   ├── (cliente)/
│   │   ├── eventos/[id]/            # mapa de assentos
│   │   ├── checkout/[reservaId]/    # contador + cartoes de teste + recusa
│   │   └── ingressos/               # meus ingressos, QR
│   ├── i/[shareToken]/              # ingresso compartilhado, sem o code
│   └── portaria/
│       ├── sessoes/                 # selecao obrigatoria de sessao
│       └── validar/                 # camera + digitacao + 4 retornos
├── components/ui/                   # primitivos proprios (fora do escopo deste plano)
└── lib/
    ├── api.ts                       # fetcher, envelope de erro tipado
    └── countdown.ts                 # tempo restante com correcao de desvio de relogio
```

**Structure Decision**: monorepo ja existente, sem diretorio novo de topo. Cada
decisao da spec vira um modulo NestJS de dominio (`reservations`, `payments`,
`tickets`, `gate`), registrados em `apps/api/src/app.module.ts`, onde ja ha um
comentario reservando o lugar deles. Dois utilitarios saem para arquivos
proprios por serem logica pura e testavel sem banco: `simulated-gateway.ts` (a
tabela de cartoes) e `ticket-code.ts` (geracao e normalizacao do codigo).

## Phase 0 — Research

Concluido. Ver [research.md](./research.md). Dez decisoes registradas, das quais
tres sao estruturais:

- **R1**: ordem das operacoes na liberacao de vencidas (`UPDATE` antes de
  `DELETE`) — a inversao abre uma corrida que emite ingresso para assento ja
  devolvido ao estoque.
- **R3**: o pagamento nao precisa de chave de idempotencia; a propria transicao
  condicional `PENDING -> PAID` e o portao contra clique duplo.
- **R4**: o codigo do ingresso e base32 Crockford agrupado, nao base64url — a
  portaria digita esse codigo a mao quando a camera falha.

Nenhum `NEEDS CLARIFICATION` restou.

## Phase 1 — Design & Contracts

Concluido.

- [data-model.md](./data-model.md) — entidades, maquina de estados da reserva e
  do ingresso, regras de transicao e a analise que conclui pela ausencia de
  migration.
- [contracts/](./contracts/) — rotas afetadas e novas, com corpos, projecoes por
  papel e codigos de erro. Complementa `docs/contrato-api.md`, que continua
  sendo o contrato geral do projeto.
- [quickstart.md](./quickstart.md) — roteiro de validacao manual dos quatro
  cenarios da spec e os comandos dos testes de concorrencia.

### Constitution Check (pos-desenho)

Reavaliado na tabela acima. Sem violacoes novas. As duas dependencias de front
adicionadas (`qrcode`, `@zxing/browser`) foram avaliadas contra alternativas em
research.md R6 e R7; ambas foram escolhidas por deixarem a aparencia sob
controle do autor, criterio que o enunciado do desafio cobra explicitamente.

## Riscos conhecidos

| Risco | Impacto | Mitigacao |
|---|---|---|
| Camera nao abre fora de `https` | Portaria parece quebrada em teste por IP na rede local | Digitacao manual e caminho de primeira classe, nao alternativa escondida; a tela explica o motivo. Registrar no README |
| Relogio do cliente adiantado faz o contador zerar cedo | Cliente acha que perdeu a reserva que ainda vale | API devolve `serverNow` junto de `expiresAt`; o front calcula o desvio uma vez (R8) |
| Teste de concorrencia depende de banco real | Nao roda em CI sem servico de Postgres | Suite separada (`test/concurrency.e2e-spec.ts`), documentada no quickstart |
| Varredura de vencidas em toda leitura do mapa | Custo por requisicao numa tabela que cresce | Duas instrucoes indexadas; indice opcional em data-model.md se incomodar |
