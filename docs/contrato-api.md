# Contrato da API

Rascunho do contrato entre `apps/web` e `apps/api`. Serve para as duas pontas
serem construidas em paralelo sem uma esperar a outra.

Este arquivo fica no nivel de visao geral — metodo, rota, papel, formato do
corpo. Para o detalhe fino de cada fluxo (ordem de apuracao da portaria,
tabela de cartoes de teste, os codigos de erro possiveis por rota), ver
`specs/001-decisoes-em-aberto/contracts/`, que e onde esse detalhe foi
efetivamente implementado e testado.

Base: `http://localhost:3333`
Autenticacao: `Authorization: Bearer <jwt>`

## Envelope de erro

Toda falha responde no mesmo formato, produzido por um filtro global:

```json
{ "error": { "code": "SEATS_TAKEN", "message": "...", "details": {} } }
```

O front decide pelo `code`, estavel; `message` e texto para humano e pode
mudar. `details` so aparece quando ha algo acionavel (lista de assentos em
conflito, contagem de ingressos vendidos). Lista completa de codigos em
`specs/001-decisoes-em-aberto/contracts/README.md`.

## `serverNow`

Toda resposta que carrega `expiresAt` carrega tambem `serverNow`, no mesmo
objeto — usado pelo front para corrigir o desvio do relogio do cliente antes
de montar um contador regressivo, calculado uma unica vez por tela.

## Autenticacao

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/auth/register` | publico | Cadastro de cliente. Organizador e portaria vem do seed. |
| POST | `/auth/login` | publico | Retorna `{ token, user }` |
| GET | `/auth/me` | autenticado | Usuario da sessao |

## Catalogo externo (TMDb)

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| GET | `/catalog/movies?query=` | ORGANIZER | Busca no TMDb, ja normalizada |
| GET | `/catalog/movies/:tmdbId` | ORGANIZER | Detalhe de um filme |

A resposta normalizada isola o front do formato do TMDb:
`{ tmdbId, title, overview, posterUrl, releaseDate }`

## Eventos

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/events` | ORGANIZER | Cria evento e gera os assentos |
| GET | `/events?q=&from=&to=` | publico | Lista apenas `PUBLISHED` |
| GET | `/events/:id` | publico | Detalhe + mapa de assentos com status |
| PATCH | `/events/:id` | ORGANIZER (dono) | Edita evento |
| POST | `/events/:id/publish` | ORGANIZER (dono) | `DRAFT` -> `PUBLISHED` |
| POST | `/events/:id/cancel` | ORGANIZER (dono) | Bloqueado se houver ingresso emitido (`409 EVENT_HAS_TICKETS`) |
| GET | `/organizer/events` | ORGANIZER | Painel: eventos do organizador, com `ticketsIssued` |

Corpo de `POST /events`:

```json
{
  "tmdbId": 27205,
  "venue": "Cine Belas Artes - Sala 2",
  "startsAt": "2026-09-01T21:00:00Z",
  "priceCents": 4500,
  "layout": { "rows": 8, "seatsPerRow": 12 }
}
```

Mapa de assentos em `GET /events/:id`:

```json
{
  "seats": [
    { "id": "...", "row": "A", "number": 1, "status": "AVAILABLE" },
    { "id": "...", "row": "A", "number": 2, "status": "TAKEN" }
  ]
}
```

`TAKEN` cobre tanto reserva pendente quanto paga — do ponto de vista de quem
esta escolhendo lugar, os dois casos significam a mesma coisa.

## Reserva e pagamento

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/reservations` | CUSTOMER | `{ eventId, seatIds[] }` -> `PENDING` com `expiresAt` |
| GET | `/reservations/:id` | CUSTOMER (dono) | Estado do pedido |
| DELETE | `/reservations/:id` | CUSTOMER (dono) | Cancela e devolve os assentos ao estoque |
| POST | `/reservations/:id/payment` | CUSTOMER (dono) | Cobranca simulada |

Se um dos assentos ja tiver sido pego, `POST /reservations` responde **409**
com a lista de assentos em conflito, para o front destacar no mapa.

O pagamento simulado precisa expor a recusa de forma deliberada — decidir como
o cliente escolhe aprovar ou recusar (numero de cartao especifico, campo
explicito, valor terminado em X). Resposta: `{ status: "APPROVED", tickets: [...] }`
ou `{ status: "DECLINED", declineReason: "..." }`.

## Ingressos

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| GET | `/me/tickets` | CUSTOMER | Meus ingressos |
| GET | `/tickets/:id` | CUSTOMER (dono) | Ingresso + `code` para o QR |
| GET | `/public/tickets/:shareToken` | publico | Ingresso compartilhado, **sem** o `code` |

## Portaria

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| GET | `/gate/events` | GATE | Sessoes publicadas para escolher, `{ today: [], upcoming: [] }`, com `ticketsIssued`/`ticketsUsed` |
| POST | `/gate/validate` | GATE | `{ code, eventId }` |

`eventId` ausente responde **400 `GATE_SESSION_REQUIRED`** — o operador
precisa escolher a sessao antes de validar.

Resposta de `/gate/validate` com um resultado unico e explicito, os quatro
casos do enunciado:

```json
{ "result": "VALID", "ticket": { "title": "...", "seat": "A-12", "holder": "..." } }
```

`result`: `VALID` | `INVALID` | `ALREADY_USED` | `WRONG_EVENT`

Em `ALREADY_USED`, devolver tambem `usedAt` — a portaria precisa saber ha
quanto tempo aquele ingresso passou para decidir o que fazer. Em
`WRONG_EVENT`, devolver `belongsTo` com a sessao correta, e o ingresso **nao**
e marcado como usado.
