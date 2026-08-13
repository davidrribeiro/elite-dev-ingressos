# Contratos — convencoes

Complementa `docs/contrato-api.md`, que segue sendo o contrato geral do projeto.
Aqui estao apenas as rotas que esta feature cria ou altera, com as convencoes
transversais.

Base: `http://localhost:3333` · Autenticacao: `Authorization: Bearer <jwt>`

## Envelope de erro

Toda falha responde com o mesmo formato, produzido por um filtro global:

```json
{
  "error": {
    "code": "RESERVATION_EXPIRED",
    "message": "Sua reserva expirou. Escolha os lugares novamente.",
    "details": {}
  }
}
```

`code` e estavel e o front decide por ele. `message` e texto para humano, em
portugues, e pode mudar sem quebrar o front. `details` so aparece quando ha algo
acionavel — a lista de assentos em conflito, por exemplo.

### Codigos desta feature

| `code` | HTTP | Quando |
|---|---|---|
| `SEATS_TAKEN` | 409 | Um ou mais assentos ja estavam presos. `details.seatIds` traz quais |
| `RESERVATION_EXPIRED` | 409 | Prazo vencido no momento da operacao |
| `RESERVATION_NOT_PENDING` | 409 | Reserva ja paga ou cancelada |
| `RESERVATION_ALREADY_PAID` | 409 | Pagamento repetido. `details.ticketIds` leva aos ingressos |
| `EVENT_NOT_PUBLISHED` | 409 | Reserva em sessao rascunho ou cancelada |
| `EVENT_HAS_TICKETS` | 409 | Cancelamento de sessao com ingressos vendidos. `details.ticketCount` |
| `GATE_SESSION_REQUIRED` | 400 | Validacao sem `eventId` |
| `INVALID_CARD_FORMAT` | 400 | Numero fora do formato. Nenhuma tentativa registrada |

## Recusa de pagamento nao e erro HTTP

Cartao recusado responde **200** com `status: "DECLINED"`. E desfecho previsto
de negocio, nao falha de requisicao: a requisicao foi processada, a reserva
segue viva e o cliente pode tentar de novo. Tratar como 4xx faria o front
confundir recusa com erro de sistema e obrigaria a distinguir os dois casos no
tratador de erro.

## `serverNow`

Toda resposta que carrega `expiresAt` carrega tambem `serverNow`, no mesmo
objeto, em ISO 8601 UTC. O front calcula o desvio de relogio uma vez e aplica em
todos os contadores. Ver [research.md](../research.md) R8.

## Projecoes: o `code` do ingresso

Tres rotas devolvem ingresso, com tres projecoes diferentes. A diferenca e a
regra de seguranca central do projeto, entao e o `select` que a garante — nunca
apagar campo depois de buscar o objeto inteiro.

| Rota | Papel | `code` | `shareToken` |
|---|---|---|---|
| `GET /tickets/:id` | dono | sim | sim |
| `GET /me/tickets` | dono | nao | nao |
| `GET /public/tickets/:shareToken` | publico | **nunca** | nao |

## Autorizacao

Toda rota de reserva, pagamento e ingresso confere que o recurso pertence ao
usuario do token. Recurso de outro dono responde **403**, nao 404 — o cliente
sabe que aquele pedido existe, so nao e dele.
