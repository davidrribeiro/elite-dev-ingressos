# Phase 1 — Modelo de dados

Entidades tocadas por [spec.md](./spec.md), com as maquinas de estado e as
regras de transicao. Referencia: `apps/api/prisma/schema.prisma`.

## Conclusao primeiro: nao ha migration

O schema atual ja atende os 31 requisitos funcionais. Nenhum campo novo, nenhuma
tabela nova, nenhuma restricao nova. A analise item a item esta no fim deste
documento.

Isso e resultado do trabalho de modelagem que ja tinha sido feito, nao sorte: os
estados `EXPIRED` e `CANCELLED` ja estavam separados no enum, `Payment` ja era
uma entidade propria em vez de campos na reserva, e `Ticket` ja tinha `usedAt`
nulavel em vez de um booleano.

---

## Reserva

Pedido de um cliente sobre um ou mais assentos de uma sessao.

| Campo | Papel nesta feature |
|---|---|
| `status` | `PENDING` \| `PAID` \| `CANCELLED` \| `EXPIRED` — as quatro sao alcancaveis e distinguiveis (FR-004) |
| `expiresAt` | instante limite, gravado na criacao como `agora + RESERVATION_HOLD_MINUTES` (FR-001) |
| `totalCents` | preco da sessao x quantidade de assentos, congelado na criacao |
| `customerId` | dono; toda transicao verifica |

### Estados

```text
                    pagamento aprovado
        ┌──────────────────────────────────────▶ PAID  (terminal)
        │
     PENDING ───── cliente cancela ───────────▶ CANCELLED  (terminal)
        │
        └───── varredura, expiresAt < agora ──▶ EXPIRED  (terminal)
```

`PENDING` e o unico estado nao terminal. Os tres finais nao voltam: nao ha
estorno (FR-027), e uma reserva expirada nao "revive" — o cliente cria outra.

### Regras de transicao

Todas sao **escritas condicionais de uma instrucao**, decididas pela contagem de
linhas afetadas. Nenhuma le, decide em `if` e depois escreve.

| Transicao | Condicao (`WHERE`) | Efeito |
|---|---|---|
| → `PAID` | `id`, `customerId`, `status = PENDING`, `expiresAt > agora` | emite ingressos na mesma transacao (FR-013) |
| → `CANCELLED` | `id`, `customerId`, `status = PENDING` | apaga `ReservationSeat` na mesma transacao (FR-007) |
| → `EXPIRED` | `eventId`, `status = PENDING`, `expiresAt < agora` | em lote; apaga `ReservationSeat` na sequencia (FR-002) |

Ver [research.md](./research.md) R1 e R3 para a ordem das operacoes e a corrida
que ela evita.

### Invariante

> Uma reserva que nao esta `PENDING` nem `PAID` nao segura assento nenhum.

Restabelecida a cada varredura, por construcao. Uma reserva `PAID` mantem suas
linhas de `ReservationSeat` permanentemente — o assento saiu do estoque para
sempre.

---

## ReservationSeat

A trava anti-overbooking. Nao muda nesta feature; entra aqui porque seu ciclo de
vida e o que as transicoes acima manipulam.

- `UNIQUE (seatId)`: a **existencia** da linha e o bloqueio do assento.
- Criada em lote junto com a reserva; violacao de unicidade derruba a transacao
  inteira, entao reserva parcial nao existe (research R2).
- Apagada quando a reserva sai de `PENDING` sem virar `PAID`.

Um assento e exibido como indisponivel no mapa **se e somente se** existe linha
de `ReservationSeat` para ele apos a varredura. Nao ha segundo criterio, nao ha
filtro por status na leitura do mapa. E isso que faz "disponivel significa
reservavel" (FR-002, SC-001) ser verdade e nao esperanca.

---

## Tentativa de pagamento (`Payment`)

Registro de uma cobranca simulada. Uma reserva tem N tentativas; no maximo uma
aprovada.

| Campo | Papel |
|---|---|
| `status` | `APPROVED` \| `DECLINED` |
| `amountCents` | copiado da reserva no momento da tentativa |
| `declineReason` | motivo exibido ao cliente; nulo quando aprovado |

**Nao ha campo de cartao, e isso e deliberado** (FR-016). O numero informado
determina o resultado e e descartado. `declineReason` guarda o motivo, nao o
instrumento.

Uma tentativa recusada nao altera a reserva (FR-010) nem estende o prazo
(FR-011). E um registro de auditoria, sem efeito de estado.

### Tabela de decisao do gateway simulado

Logica pura, isolada em `simulated-gateway.ts`, testavel sem banco.

| Numero informado | Resultado | `declineReason` |
|---|---|---|
| `4242424242424242` | `APPROVED` | — |
| `4000000000000002` | `DECLINED` | Saldo insuficiente |
| `4000000000000069` | `DECLINED` | Cartao expirado |
| qualquer outro, formato valido | `DECLINED` | Cartao nao reconhecido pela simulacao |
| formato invalido | — | erro de validacao; nenhuma tentativa registrada |

Comparacao apos remover espacos e hifens.

---

## Ingresso (`Ticket`)

Direito de entrada de uma pessoa em um assento de uma sessao.

| Campo | Papel nesta feature |
|---|---|
| `code` | conteudo do QR; base32 Crockford, 16 caracteres (research R4). Nunca sai por rota publica |
| `shareToken` | token do link publico; distinto do `code` |
| `usedAt` | nulo = nao validado. A nulidade **e** o estado, nao ha booleano paralelo |
| `validatedById` | operador de portaria que validou |
| `seatId` | `UNIQUE` — um assento gera no maximo um ingresso na vida da sessao (FR-029) |

### Estados

```text
   emitido (usedAt = null) ──── validado na portaria ────▶ usado (usedAt = instante)
```

Sem volta. Nao ha "desvalidar".

### Regra de validacao

```text
count = UPDATE tickets SET used_at = agora, validated_by_id = operador
        WHERE id = ? AND used_at IS NULL
```

`count === 1` → `VALID`. `count === 0` → outra leitora chegou primeiro →
`ALREADY_USED` (FR-025).

A ordem de apuracao dos quatro resultados importa, porque um ingresso pode se
enquadrar em mais de uma condicao:

1. codigo nao existe → `INVALID`
2. existe, mas `eventId` difere do selecionado → `WRONG_EVENT` (**antes** de
   tentar marcar; um ingresso da sala ao lado nao pode ser consumido por engano)
3. tenta marcar; `count === 1` → `VALID`
4. `count === 0` → `ALREADY_USED`, devolvendo o `usedAt` existente (FR-023)

### Sobre `Ticket.seatId @unique`

Vale registrar por que fica como esta. Como cada `Seat` pertence a exatamente um
`Event`, `UNIQUE (seatId)` e `UNIQUE (eventId, seatId)` sao **equivalentes** —
trocar um pelo outro nao ganha nada. A pergunta de verdade e se uma compra
confirmada pode ser desfeita, liberando o assento para venda nova. A spec
responde que nao (FR-027), entao a restricao atual esta correta e nao ha o que
mudar.

Se um dia houver estorno, a mudanca nao e trocar as colunas do indice: e torna-lo
parcial, valendo so para ingressos nao cancelados.

---

## Sessao de portaria

**Nao e entidade persistida.** E a sessao escolhida pelo operador, guardada no
`localStorage` do dispositivo e enviada em cada validacao (research R5). Aparece
aqui para deixar explicito que a ausencia de tabela e escolha, nao esquecimento.

---

## Evento

Sem campo novo. Duas regras entram:

- Cancelar sessao com ingressos emitidos e **bloqueado** (FR-030). A checagem e
  uma contagem de `Ticket` do evento; nao ha corrida relevante, porque o caminho
  que emitiria um ingresso durante o cancelamento exigiria uma reserva `PENDING`
  ainda viva, e o pior caso e um cancelamento que falha e precisa ser repetido.
- Sessao `CANCELLED` sai da listagem publica e recusa reservas novas (FR-031).

---

## Verificacao: por que nenhum requisito exige migration

| Requisito | Onde ja e atendido |
|---|---|
| FR-001 prazo de 10 min | `Reservation.expiresAt` + `RESERVATION_HOLD_MINUTES` no `.env` |
| FR-002/003 liberacao | apagar `ReservationSeat`; sem coluna nova |
| FR-004 expirada ≠ cancelada | `ReservationStatus` ja tem os dois valores |
| FR-008 tabela de cartoes | logica de aplicacao; nada persistido |
| FR-012 registrar tentativas | `Payment` ja e entidade propria com `status` e `declineReason` |
| FR-013 um ingresso por assento | `Ticket` por `seatId` |
| FR-016 nao guardar cartao | `Payment` ja nao tem o campo |
| FR-017..020 sessao da portaria | estado de cliente; sem persistencia |
| FR-021..026 quatro retornos | `Ticket.usedAt` nulavel + `eventId` |
| FR-029 um ingresso por assento | `Ticket.seatId @unique` |
| FR-030/031 cancelar sessao | `EventStatus.CANCELLED` + contagem de `Ticket` |

Unico ajuste opcional, de desempenho e nao de corretude: trocar
`Reservation.@@index([status, expiresAt])` por `[eventId, status, expiresAt]`
(research R10).
