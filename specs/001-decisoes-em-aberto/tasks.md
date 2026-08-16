---

description: "Task list for feature implementation"
---

# Tasks: Decisoes em aberto do fluxo de compra

**Input**: Design documents from `/specs/001-decisoes-em-aberto/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: incluidos. Nao por rito de TDD, mas porque tres criterios de sucesso
da spec (SC-005, SC-006, SC-007) sao afirmacoes sobre concorrencia que so um
teste automatizado sustenta. Os testes desta lista sao os que provam corrida;
nao ha teste de getter.

**Organization**: agrupado por user story, para cada uma poder ser implementada,
testada e demonstrada sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependencia pendente)
- **[Story]**: a qual user story a tarefa pertence (US1..US4)

## Path Conventions

Monorepo com dois workspaces: `apps/api` (NestJS) e `apps/web` (Next.js App
Router). Caminhos abaixo sao relativos a raiz do repositorio.

## Nota de escopo importante

Esta feature resolve quatro regras de comportamento, mas nao existe fluxo em que
elas rodem: hoje a API so tem `PrismaModule`. A **Phase 2 e majoritariamente
pre-requisito herdado** — autenticacao, catalogo e eventos foram especificados em
`docs/contrato-api.md`, nao aqui, e precisam existir antes de qualquer user story
desta spec. Estao na lista porque bloqueiam, e nao porque a spec os introduziu.

Se o tempo apertar, o corte vem do fim: US4 (P3) e a Phase 7 nao alteram a
demonstracao dos requisitos obrigatorios do desafio.

---

## Phase 1: Setup

**Purpose**: dependencias e infraestrutura de teste

- [X] T001 Adicionar `qrcode`, `@types/qrcode`, `@zxing/browser` e `@zxing/library` as dependencias em `apps/web/package.json` (justificativa em research.md R6 e R7)
- [X] T002 [P] Configurar banco de teste dedicado em `apps/api/test/jest-e2e.json` e `.env.test`, apontando para um schema separado do de desenvolvimento
- [X] T003 [P] Adicionar script `test:e2e` no `package.json` da raiz, encadeando `db:up` antes da suite

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestrutura sem a qual nenhuma user story roda

**⚠️ CRITICAL**: nenhuma user story pode comecar antes desta fase terminar

- [X] T004 [P] Criar `ClockService` com metodo `now(): Date` em `apps/api/src/common/clock/clock.service.ts` e `clock.module.ts` global — substitui todo `new Date()` de regra de negocio e torna expiracao testavel sem `sleep` (research.md R11)
- [X] T005 [P] Definir enum de codigos de erro e classe `AppError` em `apps/api/src/common/errors/app-error.ts`, cobrindo os codigos de `contracts/README.md`
- [X] T006 Implementar filtro global de excecao em `apps/api/src/common/errors/app-exception.filter.ts` produzindo o envelope `{ error: { code, message, details } }` e registra-lo em `apps/api/src/main.ts` (depende de T005)
- [X] T007 [P] Implementar `AuthModule` com `POST /auth/register`, `POST /auth/login` e `GET /auth/me` em `apps/api/src/auth/`, usando `bcryptjs` e `@nestjs/jwt`
- [X] T008 Implementar `JwtAuthGuard`, `RolesGuard`, decorator `@Roles(...)` e `@CurrentUser()` em `apps/api/src/auth/` (depende de T007)
- [X] T009 [P] Extrair helper puro `generateSeats(rows, seatsPerRow)` em `apps/api/src/events/seat-layout.ts` — usado pela criacao de evento e pelo seed, sem duplicar logica
- [X] T010 [P] Implementar `CatalogModule` em `apps/api/src/catalog/` com `GET /catalog/movies` (usando `now_playing?region=BR` quando nao houver busca) e cache em memoria com TTL de 10 min
- [X] T011 Implementar `EventsModule` em `apps/api/src/events/` com criacao (copiando dados do TMDb e gerando assentos), listagem publica, detalhe com mapa e publicacao (depende de T009, T010)
- [X] T012 Registrar `AuthModule`, `CatalogModule`, `EventsModule`, `ReservationsModule`, `PaymentsModule`, `TicketsModule` e `GateModule` em `apps/api/src/app.module.ts`, no lugar ja reservado por comentario
- [X] T013 Ampliar `apps/api/prisma/seed.ts` para criar duas sessoes publicadas em salas diferentes no mesmo dia, com assentos gerados por `generateSeats` (depende de T009, T011) — duas sessoes sao necessarias para `WRONG_EVENT` existir
- [X] T014 [P] Criar fetcher em `apps/web/lib/api.ts` que injeta o Bearer, desserializa o envelope de erro em excecao tipada por `code` e centraliza a base URL
- [X] T015 [P] Implementar sessao do usuario e telas de entrada em `apps/web/app/(auth)/`, com header que muda conforme o papel
- [X] T016 Implementar os primitivos de interface em `apps/web/components/ui/` conforme o partido visual escolhido pelo autor (paleta, tipografia, densidade) — a decisao de design e do autor e precisa estar registrada em `docs/decisoes.md` antes de qualquer tela ser montada

**Checkpoint**: login funciona nas quatro contas, existe uma sessao publicada com mapa de assentos, e erros da API chegam ao front com `code` estavel

---

## Phase 3: User Story 1 — Assento preso volta ao mapa (Priority: P1) 🎯 MVP

**Goal**: reserva vencida devolve o assento ao estoque, e todo assento exibido como disponivel pode efetivamente ser reservado

**Independent Test**: criar reserva, nao pagar, esperar o prazo, recarregar o mapa em outra conta e comprar o mesmo assento com sucesso

### Tests for User Story 1

- [X] T017 [P] [US1] Teste de assento disputado em `apps/api/test/reservations-concurrency.e2e-spec.ts`: duas `POST /reservations` simultaneas para o mesmo assento, 10 repeticoes, exigindo exatamente uma 201 e uma `SEATS_TAKEN` em cada rodada
- [X] T018 [P] [US1] Teste de expiracao em `apps/api/test/expiration.e2e-spec.ts` usando `ClockService` controlado: reserva vencida some do mapa como ocupada, o assento fica reservavel de novo, e a reserva original consta como `EXPIRED` e nao `CANCELLED`
- [X] T019 [P] [US1] Teste da corrida entre pagamento e varredura em `apps/api/test/expiration.e2e-spec.ts`: pagamento no limite do prazo concorrente com leitura de mapa, exigindo que reserva paga mantenha os assentos ou expire sem emitir — nunca ingresso com assento ja devolvido (research.md R1)
  — **adiada para a US2**: exige `POST /reservations/:id/payment` (T039), que ainda nao existe. Simular pagamento so para este teste divergiria do codigo real.

### Implementation for User Story 1

- [X] T020 [US1] Implementar `releaseExpired(eventId)` em `apps/api/src/reservations/reservations.service.ts`: transacao com `updateMany` de `PENDING` vencidas para `EXPIRED` **seguido** de `deleteMany` das `ReservationSeat` de reservas `EXPIRED` do evento — a ordem inversa abre a corrida descrita em research.md R1
- [X] T021 [P] [US1] Criar `CreateReservationDto` em `apps/api/src/reservations/dto/create-reservation.dto.ts` validando 1 a 6 `seatIds` sem repeticao
- [X] T022 [US1] Implementar criacao de reserva em `apps/api/src/reservations/reservations.service.ts`: `releaseExpired` primeiro, depois transacao com `reservation.create` e `reservationSeat.createMany`; capturar `P2002` e traduzir em `SEATS_TAKEN` com `details.seatIds` obtidos por leitura de diagnostico apos o rollback (depende de T020, T021)
- [X] T023 [US1] Implementar `GET /reservations/:id` em `apps/api/src/reservations/reservations.controller.ts` devolvendo `serverNow`, `lastPayment` e `ticketIds` conforme `contracts/reservations.md`, disparando `releaseExpired` antes de responder
- [X] T024 [US1] Implementar `DELETE /reservations/:id` como transicao condicional para `CANCELLED` seguida da remocao das `ReservationSeat`, recusando reserva ja paga com `RESERVATION_NOT_PENDING`
- [X] T025 [US1] Chamar `releaseExpired` no inicio de `GET /events/:id` e incluir `serverNow` na resposta, em `apps/api/src/events/events.service.ts` — o criterio de assento ocupado continua sendo apenas a existencia de `ReservationSeat`
- [X] T026 [P] [US1] Implementar `apps/web/lib/countdown.ts` calculando o desvio de relogio a partir de `serverNow` uma unica vez e expondo o tempo restante corrigido (research.md R8)
- [X] T027 [US1] Implementar o mapa de assentos em `apps/web/app/(cliente)/eventos/[id]/`, com estados livre/ocupado/selecionado, rotulos de fileira, referencia da tela e comportamento definido para telas estreitas
- [X] T028 [US1] Implementar o checkout em `apps/web/app/(cliente)/checkout/[reservaId]/` com resumo, contador regressivo e acao de cancelar a reserva (depende de T026)
- [X] T029 [US1] Tratar `SEATS_TAKEN` no mapa destacando os assentos em conflito e **preservando os demais selecionados** pelo cliente (depende de T027)

**Checkpoint**: o mapa nunca mente. Todo assento livre aceita reserva, e carrinho abandonado devolve a poltrona sozinho

---

## Phase 4: User Story 2 — Recusa e nova tentativa (Priority: P1)

**Goal**: pagamento simulado com resultado deterministico, recusa que nao destroi a reserva, e ingresso emitido com QR

**Independent Test**: reservar, pagar com o cartao de recusa, conferir a mensagem e a reserva ainda ativa, pagar com o cartao aprovado e receber os ingressos

### Tests for User Story 2

- [X] T030 [P] [US2] Teste unitario da tabela de cartoes em `apps/api/src/payments/simulated-gateway.spec.ts`, cobrindo as quatro linhas de `contracts/payments.md` e a normalizacao de espacos e hifens
- [X] T031 [P] [US2] Teste unitario de `ticket-code` em `apps/api/src/tickets/ticket-code.spec.ts`: codigo gerado tem 16 caracteres do alfabeto Crockford, e a normalizacao converte caixa baixa, hifens, `I`/`L` para `1` e `O` para `0`
- [X] T032 [P] [US2] Teste de clique duplo em `apps/api/test/payment-concurrency.e2e-spec.ts`: duas `POST /reservations/:id/payment` simultaneas com o cartao aprovado, 10 repeticoes, exigindo exatamente uma aprovacao e um unico conjunto de ingressos
- [X] T033 [P] [US2] Teste de vazamento em `apps/api/test/tickets.e2e-spec.ts`: a resposta de `GET /public/tickets/:shareToken` nao contem o `code` em nenhum campo, em nenhuma profundidade

### Implementation for User Story 2

- [X] T034 [P] [US2] Implementar `apps/api/src/payments/simulated-gateway.ts` como funcao pura numero de cartao → `{ status, declineReason }`, sem dependencia de Nest nem de banco
- [X] T035 [P] [US2] Implementar `apps/api/src/tickets/ticket-code.ts` com geracao (`randomBytes(10)` em base32 Crockford, agrupado em quatro) e normalizacao para consulta (research.md R4)
- [X] T036 [US2] Implementar `TicketsService.issueForReservation` em `apps/api/src/tickets/tickets.service.ts`, emitindo um ingresso por assento com `code` e `shareToken` distintos (depende de T035)
- [X] T037 [US2] Implementar `PaymentsService` em `apps/api/src/payments/payments.service.ts`: transicao condicional `PENDING → PAID` com `expiresAt > agora`, emissao na mesma transacao quando `count === 1`, e registro de `Payment` sem persistir numero de cartao (depende de T034, T036)
- [X] T038 [US2] Implementar o caminho de recusa em `PaymentsService`: grava `Payment` com `DECLINED` e motivo, mantem a reserva `PENDING` e devolve `expiresAt` inalterado
- [X] T039 [US2] Implementar `POST /reservations/:id/payment` em `apps/api/src/payments/payments.controller.ts` respondendo 200 tanto para aprovacao quanto para recusa, e mapeando `RESERVATION_EXPIRED`, `RESERVATION_ALREADY_PAID` (com `details.ticketIds`), `RESERVATION_NOT_PENDING` e `INVALID_CARD_FORMAT` (depende de T037, T038)
- [X] T040 [US2] Implementar `GET /me/tickets` e `GET /tickets/:id` em `apps/api/src/tickets/tickets.controller.ts` com `select` explicito por rota — a listagem nao carrega `code`
- [X] T041 [US2] Implementar `GET /public/tickets/:shareToken` com projecao que **nunca** inclui `code`, garantida pelo `select` e nao por remocao posterior de campo
- [X] T042 [US2] Implementar o formulario de pagamento em `apps/web/app/(cliente)/checkout/[reservaId]/`, com a tabela de cartoes de teste visivel na propria tela e aviso de que os demais campos sao decorativos
- [X] T043 [US2] Implementar o estado de recusa no checkout: motivo em destaque, assentos preservados, contador seguindo do mesmo ponto e acao clara de tentar outro cartao
- [X] T044 [US2] Implementar o estado de aprovacao levando aos ingressos emitidos
- [X] T045 [US2] Implementar "Meus ingressos" em `apps/web/app/(cliente)/ingressos/`, renderizando o QR como SVG em Server Component via `qrcode.toString({ type: 'svg' })` (research.md R7)
- [X] T046 [US2] Implementar a acao de copiar o link e a pagina publica `apps/web/app/i/[shareToken]/`, exibindo filme, sessao e poltrona sem o codigo do QR

**Checkpoint**: o fluxo de compra fecha de ponta a ponta, incluindo o caminho de erro. Cliente sai com ingresso e QR na mao

---

## Phase 5: User Story 3 — Portaria opera uma sessao (Priority: P2)

**Goal**: validacao delimitada por sessao, com os quatro retornos alcancaveis e leitura por camera com digitacao manual como alternativa de primeira classe

**Independent Test**: selecionar a sessao A, ler um ingresso da sessao B e obter `WRONG_EVENT`; trocar para B e obter `VALID`

### Tests for User Story 3

- [X] T047 [P] [US3] Teste de ingresso disputado em `apps/api/test/gate-concurrency.e2e-spec.ts`: duas `POST /gate/validate` simultaneas com o mesmo codigo, 10 repeticoes, exigindo exatamente um `VALID` e um `ALREADY_USED`
- [X] T048 [P] [US3] Teste dos quatro retornos em `apps/api/test/gate.e2e-spec.ts`, incluindo a garantia de que `WRONG_EVENT` **nao** marca o ingresso como usado e ele segue validavel na sessao correta

### Implementation for User Story 3

- [X] T049 [P] [US3] Implementar `GET /gate/events` em `apps/api/src/gate/gate.controller.ts` devolvendo `today` e `upcoming` com `ticketsIssued` e `ticketsUsed` conforme `contracts/gate.md`
- [X] T050 [US3] Implementar `GateService.validate` em `apps/api/src/gate/gate.service.ts` na ordem de apuracao definida: inexistente → `INVALID`; evento diferente → `WRONG_EVENT`; `updateMany ... WHERE usedAt IS NULL` com `count === 1` → `VALID`; `count === 0` → `ALREADY_USED` com o `usedAt` existente (depende de T035 para a normalizacao do codigo)
- [X] T051 [US3] Implementar `POST /gate/validate` respondendo sempre 200 com um dos quatro `result`, e `GATE_SESSION_REQUIRED` quando faltar `eventId`
- [X] T052 [US3] Implementar a selecao de sessao em `apps/web/app/portaria/sessoes/`, persistindo a escolha em `localStorage` sob `portaria.sessaoId` (research.md R5)
- [X] T053 [US3] Implementar o guard de layout em `apps/web/app/portaria/layout.tsx` redirecionando para a selecao quando nao houver sessao, e mantendo a sessao atual visivel com acao de troca (depende de T052)
- [X] T054 [US3] Implementar a leitura por camera com `@zxing/browser` em `apps/web/app/portaria/validar/`, tratando permissao negada com mensagem que explica a exigencia de `https` ou `localhost`
- [X] T055 [US3] Implementar a digitacao manual com mascara em quatro grupos e normalizacao antes do envio, no mesmo caminho de validacao da camera
- [X] T056 [US3] Implementar os quatro estados de resultado com distincao visual legivel a distancia, exibindo `usedAt` em `ALREADY_USED` e a sessao correta em `WRONG_EVENT` (depende de T016)

**Checkpoint**: os quatro retornos do enunciado sao demonstraveis com os dados semeados

---

## Phase 6: User Story 4 — Compra definitiva (Priority: P3)

**Goal**: ausencia de estorno declarada na interface, e sessao com ingressos vendidos protegida de cancelamento

**Independent Test**: comprar um ingresso e verificar que nao ha caminho de cancelamento; como organizadora, tentar cancelar a sessao e receber o bloqueio

### Tests for User Story 4

- [X] T057 [P] [US4] Teste em `apps/api/test/events.e2e-spec.ts`: cancelar sessao com ingressos retorna `EVENT_HAS_TICKETS` com `details.ticketCount`; sem ingressos, retorna 204 e a sessao sai da listagem publica

### Implementation for User Story 4

- [X] T058 [US4] Implementar `POST /events/:id/cancel` em `apps/api/src/events/events.controller.ts`, bloqueando quando houver ingresso emitido (depende de T036)
- [X] T059 [US4] Excluir sessoes `CANCELLED` da listagem publica e recusar reservas com `EVENT_NOT_PUBLISHED` em `apps/api/src/events/events.service.ts` e `reservations.service.ts`
- [X] T060 [US4] Implementar cancelamento no painel do organizador em `apps/web/app/(organizador)/eventos/`, exibindo a mensagem de bloqueio com a quantidade vendida
- [X] T061 [US4] Declarar na tela do ingresso que a compra e definitiva, em `apps/web/app/(cliente)/ingressos/` — a ausencia de estorno precisa ser lida como escolha, nao como funcionalidade faltando

**Checkpoint**: nenhum caminho da interface deixa um cliente com ingresso de sessao que nao existe mais

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T062 [P] Enriquecer `apps/api/prisma/seed.ts` com assentos ja vendidos na sessao 1, um ingresso ja validado, uma reserva `PENDING` ja vencida, e impressao dos codigos dos ingressos ao fim da execucao (depende de T036) — sem isso o roteiro do quickstart exige preparacao manual
- [X] T063 [P] Fechar a secao "A decidir" de `docs/decisoes.md` com a expiracao sob demanda e a ordem `UPDATE` antes de `DELETE`, e acrescentar as decisoes de research.md R3, R4 e R6
- [X] T064 [P] Atualizar `docs/contrato-api.md` com `GET /gate/events`, `POST /events/:id/cancel`, o campo `serverNow` e o envelope de erro
- [X] T065 [P] Escrever no `README.md` os cartoes de teste, as contas semeadas, a exigencia de `https` para a camera e o que reconhecidamente nao funciona
- [X] T066 Verificar que numero de cartao nao aparece em log nem em resposta de erro, em `apps/api/src/payments/` e no filtro global
- [X] T067 [P] Avaliar a troca de `@@index([status, expiresAt])` por `[eventId, status, expiresAt]` em `apps/api/prisma/schema.prisma` (research.md R10) — desempenho, nao corretude
- [ ] T068 Percorrer os quatro cenarios de [quickstart.md](./quickstart.md) com o banco recem-semeado, do zero
- [ ] T069 Rodar a checagem de regressao final de [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependencias
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as user stories**
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2 e de **US1** — nao ha o que pagar sem reserva
- **US3 (Phase 5)**: depende da Phase 2 e de **US2** — nao ha o que validar sem ingresso emitido
- **US4 (Phase 6)**: depende da Phase 2 e de T036 (emissao de ingresso) para a regra de bloqueio
- **Polish (Phase 7)**: depende das stories desejadas

### User Story Dependencies

Ao contrario do caso comum, **estas stories nao sao independentes na
implementacao**, porque descrevem estagios consecutivos de um mesmo fluxo: reserva
→ pagamento → validacao. Cada uma continua sendo **independentemente
demonstravel** depois de pronta, que e o que o checkpoint de cada fase verifica.

Forcar independencia aqui exigiria fixtures artificiais (ingresso emitido sem
compra, por exemplo) que testariam um caminho que o sistema real nao percorre.

### Parallel Opportunities

- T002 e T003 em paralelo no Setup
- T004, T005, T007, T009, T010 em paralelo na Foundational; T014 e T015 tambem, por serem do front
- Todos os testes de uma story marcados [P] rodam juntos — sao arquivos diferentes
- T034 e T035 em paralelo: as duas pecas de logica pura de US2
- Dentro de cada story, o par API/front pode andar junto assim que o contrato estiver implementado

---

## Parallel Example: User Story 2

```bash
# Testes da US2, todos em arquivos diferentes:
Task: "Teste unitario da tabela de cartoes em apps/api/src/payments/simulated-gateway.spec.ts"
Task: "Teste unitario de ticket-code em apps/api/src/tickets/ticket-code.spec.ts"
Task: "Teste de clique duplo em apps/api/test/payment-concurrency.e2e-spec.ts"
Task: "Teste de vazamento do code em apps/api/test/tickets.e2e-spec.ts"

# As duas pecas de logica pura, sem banco e sem Nest:
Task: "Implementar apps/api/src/payments/simulated-gateway.ts"
Task: "Implementar apps/api/src/tickets/ticket-code.ts"
```

---

## Implementation Strategy

### MVP (US1)

1. Phase 1 → Phase 2 → Phase 3
2. **PARE E VALIDE**: cenario 1 do quickstart, do zero
3. Neste ponto existe navegacao, mapa de assentos honesto e reserva com prazo — ja e demonstravel

### Entrega incremental

1. Setup + Foundational → base pronta
2. + US1 → mapa e reserva funcionam (MVP)
3. + US2 → fluxo de compra fecha, com ingresso e QR — **este e o ponto minimo de entrega do desafio**
4. + US3 → portaria completa os requisitos obrigatorios
5. + US4 → definitividade declarada e sessao protegida
6. + Phase 7 → seed rico, documentacao e verificacao final

### Se o prazo apertar

Corte de tras para frente: Phase 7 parcial (mas **nunca** T062, T065 e T068 —
seed, README e a passada final do quickstart), depois US4. US1, US2 e US3 cobrem
os requisitos obrigatorios do enunciado e nao devem ser cortadas.

---

## Notes

- Cada tarefa cita o arquivo que toca; nenhuma exige contexto fora deste diretorio e do codigo existente
- Commit por tarefa ou por grupo logico, com mensagem que descreve a decisao e nao o arquivo
- Os testes de corrida rodam em laco (10 repeticoes): corrida que passa uma vez nao passou
- Nenhum teste de expiracao usa `sleep` — todos passam pelo `ClockService` de T004
- T016 nao especifica layout de proposito: interface e decisao do autor, e o enunciado penaliza tela gerada pronta
