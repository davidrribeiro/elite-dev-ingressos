# Contrato — pagamento simulado

Convencoes gerais em [README.md](./README.md).

---

## `POST /reservations/:id/payment` — CUSTOMER (dono)

```json
{
  "cardNumber": "4242 4242 4242 4242",
  "holderName": "BRUNO CLIENTE",
  "expiry": "12/30",
  "cvv": "123"
}
```

Espacos e hifens em `cardNumber` sao removidos antes de qualquer coisa. **O
numero nao e persistido** (FR-016) e nao aparece em log.

Os campos `holderName`, `expiry` e `cvv` sao validados de formato e descartados.
Existem para a tela parecer um checkout de verdade; nenhum deles influencia o
resultado, e a tela diz isso.

### 200 aprovado

```json
{
  "status": "APPROVED",
  "reservationId": "uuid",
  "tickets": [
    { "id": "uuid", "seat": { "row": "F", "number": 7 } }
  ]
}
```

Ingressos emitidos na mesma transacao da mudanca de estado: um por assento, tudo
ou nada (FR-013). A resposta nao traz o `code` — o ingresso completo vem de
`GET /tickets/:id`.

### 200 recusado

```json
{
  "status": "DECLINED",
  "declineReason": "Saldo insuficiente",
  "expiresAt": "2026-08-13T21:10:00.000Z",
  "serverNow": "2026-08-13T21:04:10.000Z"
}
```

200, e nao 4xx: ver a justificativa em [README.md](./README.md).

A reserva **segue `PENDING`** e os assentos seguem presos (FR-010). `expiresAt`
volta inalterado — tentativa nao estende prazo (FR-011), e devolve-lo deixa isso
visivel para quem le a resposta.

### Tabela de resultados (FR-008)

| Numero | Resultado | `declineReason` |
|---|---|---|
| `4242424242424242` | `APPROVED` | — |
| `4000000000000002` | `DECLINED` | Saldo insuficiente |
| `4000000000000069` | `DECLINED` | Cartao expirado |
| qualquer outro valido | `DECLINED` | Cartao nao reconhecido pela simulacao |

A tela de pagamento exibe esta tabela (FR-009).

### Erros

**409 `RESERVATION_EXPIRED`** — prazo vencido. Nenhuma tentativa e registrada
(FR-005): nao houve cobranca, entao nao ha o que auditar.

**409 `RESERVATION_ALREADY_PAID`** (FR-014) — inclui `details.ticketIds` para o
front levar direto aos ingressos em vez de mostrar erro seco.

**409 `RESERVATION_NOT_PENDING`** — reserva cancelada.

**400 `INVALID_CARD_FORMAT`** — formato invalido. Erro de preenchimento, nao
recusa: nenhum `Payment` e gravado.

---

## Clique duplo

Sem chave de idempotencia. A transicao condicional `PENDING -> PAID` e o portao:
duas requisicoes simultaneas com o cartao aprovado disputam a linha da reserva, e
exatamente uma consegue emitir. A perdedora cai em `RESERVATION_ALREADY_PAID`,
que ja aponta para os ingressos emitidos — do ponto de vista do cliente que
clicou duas vezes, o desfecho e o correto.

Detalhamento em [research.md](../research.md) R3.

Duas **recusas** simultaneas gravam duas linhas de `Payment`, e esta certo:
foram duas tentativas, nenhuma mudou estado.
