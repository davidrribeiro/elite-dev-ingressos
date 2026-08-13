# Contrato — portaria

Convencoes gerais em [README.md](./README.md).

---

## `GET /gate/events` — GATE *(nova)*

Rota que faltava: sem ela o operador nao tem como escolher a sessao, e o retorno
`WRONG_EVENT` exigido pelo enunciado nao chega a existir (FR-018).

Sessoes publicadas, **as de hoje primeiro**, cada bloco ordenado por horario.

```json
{
  "today": [
    {
      "id": "uuid",
      "title": "Inception",
      "venue": "Cine Belas Artes - Sala 2",
      "startsAt": "2026-08-13T21:00:00.000Z",
      "ticketsIssued": 12,
      "ticketsUsed": 3
    }
  ],
  "upcoming": [ ]
}
```

`ticketsIssued` e `ticketsUsed` dao ao operador uma nocao de quanto da fila ja
passou. Nao sao requisito; sao o tipo de informacao que quem esta na porta quer
e que nao custa nada devolver.

---

## `POST /gate/validate` — GATE

```json
{ "code": "A1B2-C3D4-E5F6-G7H8", "eventId": "uuid" }
```

`code` e normalizado antes da consulta: caixa alta, hifens e espacos removidos,
`I` e `L` viram `1`, `O` vira `0` (base32 Crockford, [research.md](../research.md) R4).
A mesma normalizacao vale para leitura por camera e digitacao manual — as duas
entram pela mesma porta.

`eventId` e obrigatorio. Ausente → **400 `GATE_SESSION_REQUIRED`** (FR-017).

### Resposta

Sempre **200**, com um entre quatro `result` (FR-021). Nenhum dos quatro e erro
HTTP: todos sao respostas legitimas de uma leitura que aconteceu.

**`VALID`** (FR-024)

```json
{
  "result": "VALID",
  "ticket": {
    "title": "Inception",
    "startsAt": "2026-08-13T21:00:00.000Z",
    "seat": "F7",
    "holder": "Bruno Cliente"
  }
}
```

**`ALREADY_USED`** (FR-023)

```json
{
  "result": "ALREADY_USED",
  "usedAt": "2026-08-13T20:41:07.000Z",
  "ticket": { "seat": "F7", "holder": "Bruno Cliente" }
}
```

`usedAt` e o instante da validacao anterior — a portaria precisa saber se foi ha
30 segundos (provavel leitura repetida) ou ha 40 minutos (provavel ingresso
copiado).

**`WRONG_EVENT`** (FR-022)

```json
{
  "result": "WRONG_EVENT",
  "belongsTo": { "title": "Duna", "venue": "Sala 4", "startsAt": "..." }
}
```

Identifica a sessao correta para o operador saber para onde mandar a pessoa. O
ingresso **nao e marcado como usado** — quem chegou na porta errada continua com
ingresso valido.

**`INVALID`** (FR-026)

```json
{ "result": "INVALID" }
```

Sem detalhe algum. Nao informa se o codigo tem formato certo, se chegou perto de
existir, nem quantos caracteres faltam. Codigo inexistente e codigo malformado
produzem a mesma resposta.

### Ordem de apuracao

Nao e arbitraria — um ingresso pode se enquadrar em mais de uma condicao:

1. codigo nao existe → `INVALID`
2. `ticket.eventId ≠ eventId` → `WRONG_EVENT` (**antes** de tentar marcar, senao
   um ingresso da sala ao lado seria consumido por engano)
3. `UPDATE ... WHERE id = ? AND used_at IS NULL`; afetou 1 linha → `VALID`
4. afetou 0 linhas → `ALREADY_USED`

O passo 3 e o que garante FR-025 sob leitura simultanea: duas leitoras apontadas
para o mesmo ingresso disputam a mesma linha, e exatamente uma recebe `VALID`.
Ler `usedAt`, decidir em `if` e depois salvar deixaria as duas passarem.

### Registro

Validacao bem-sucedida grava `validatedById` com o usuario do token. Nao ha rota
para desfazer.
