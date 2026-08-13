# Contrato — reservas, expiracao e cancelamento

Convencoes gerais em [README.md](./README.md).

---

## `POST /reservations` — CUSTOMER

Cria a reserva e prende os assentos. **Roda a varredura de vencidas da sessao
antes de tentar inserir** (FR-003).

```json
{ "eventId": "uuid", "seatIds": ["uuid", "uuid"] }
```

`seatIds`: 1 a 6 itens, sem repeticao, todos pertencentes a `eventId`.

**201**

```json
{
  "id": "uuid",
  "status": "PENDING",
  "totalCents": 9000,
  "expiresAt": "2026-08-13T21:10:00.000Z",
  "serverNow": "2026-08-13T21:00:00.000Z",
  "event": { "id": "uuid", "title": "Inception", "venue": "Sala 2", "startsAt": "..." },
  "seats": [{ "id": "uuid", "row": "F", "number": 7 }]
}
```

**409 `SEATS_TAKEN`** — algum assento foi pego. A transacao inteira caiu; nenhum
assento ficou reservado.

```json
{
  "error": {
    "code": "SEATS_TAKEN",
    "message": "A poltrona F7 acabou de ser reservada por outra pessoa.",
    "details": { "seatIds": ["uuid-do-F7"] }
  }
}
```

O front destaca esses assentos no mapa e **preserva os demais selecionados** —
o cliente troca so o que conflitou (edge case da spec).

**409 `EVENT_NOT_PUBLISHED`** — sessao em rascunho ou cancelada (FR-031).

---

## `GET /reservations/:id` — CUSTOMER (dono)

Estado do pedido. Serve a tela de checkout e o retorno do cliente que fechou o
navegador.

```json
{
  "id": "uuid",
  "status": "PENDING",
  "totalCents": 9000,
  "expiresAt": "2026-08-13T21:10:00.000Z",
  "serverNow": "2026-08-13T21:03:22.000Z",
  "event": { },
  "seats": [ ],
  "lastPayment": { "status": "DECLINED", "declineReason": "Saldo insuficiente" },
  "ticketIds": []
}
```

`lastPayment` e nulo quando nao houve tentativa; permite a tela reaparecer com o
motivo da ultima recusa apos recarga. `ticketIds` so tem conteudo quando
`status` e `PAID`.

Uma reserva vencida ainda nao varrida deve responder `EXPIRED` — a rota tambem
dispara a varredura da sessao, para o cliente nunca ver um contador negativo
sobre um pedido descrito como ativo.

---

## `DELETE /reservations/:id` — CUSTOMER (dono)

Cancela reserva ainda nao paga e devolve os assentos imediatamente (FR-007).

**204** sem corpo.

**409 `RESERVATION_NOT_PENDING`** — ja paga ou ja cancelada. Compra confirmada
nao se desfaz (FR-027).

---

## `GET /events/:id` — publico *(alterada)*

Duas mudancas:

1. Executa a varredura de vencidas da sessao **antes** de montar o mapa
   (FR-003). E o que sustenta "disponivel significa reservavel".
2. Passa a incluir `serverNow`.

O criterio de disponibilidade do assento nao muda e continua sendo unico:
existe linha de `ReservationSeat` para ele ou nao. Sem status de reserva na
consulta do mapa.

```json
{
  "id": "uuid",
  "title": "Inception",
  "serverNow": "2026-08-13T21:00:00.000Z",
  "seats": [
    { "id": "uuid", "row": "A", "number": 1, "status": "AVAILABLE" },
    { "id": "uuid", "row": "A", "number": 2, "status": "TAKEN" }
  ]
}
```

`TAKEN` continua cobrindo reserva pendente e paga: para quem escolhe lugar, os
dois casos significam a mesma coisa.

---

## `POST /events/:id/cancel` — ORGANIZER (dono) *(nova)*

**204** quando a sessao nao tem ingresso emitido.

**409 `EVENT_HAS_TICKETS`** (FR-030):

```json
{
  "error": {
    "code": "EVENT_HAS_TICKETS",
    "message": "Esta sessao ja vendeu 12 ingressos e nao pode ser cancelada.",
    "details": { "ticketCount": 12 }
  }
}
```
