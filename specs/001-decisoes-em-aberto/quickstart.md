# Quickstart — como provar que funciona

Roteiro de validacao de [spec.md](./spec.md). Cada bloco fecha uma das quatro
decisoes e termina em um resultado observavel, nao em "deve funcionar".

Este arquivo tambem e o rascunho do trecho de demonstracao do README final: o
avaliador precisa percorrer os quatro cenarios sem montar nada.

## Pre-requisitos

```bash
npm install
cp .env.example .env                      # preencher TMDB_API_KEY
cp apps/web/.env.example apps/web/.env.local
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api                           # terminal 1 — :3333
npm run dev:web                           # terminal 2 — :3000
```

Contas semeadas, senha `elite123`: `organizador@elite.dev`,
`cliente1@elite.dev`, `cliente2@elite.dev`, `portaria@elite.dev`.

## O que o seed precisa produzir

Hoje ele so cria os quatro usuarios ([seed.ts](../../apps/api/prisma/seed.ts)
tem o TODO). Para este roteiro rodar sem preparacao manual, precisa terminar com:

| Item | Por que |
|---|---|
| **Duas** sessoes publicadas, salas diferentes, no mesmo dia | Uma so nao permite demonstrar `WRONG_EVENT` |
| Assentos gerados nas duas (ex.: 8 fileiras x 12) | Mapa com o que escolher |
| Alguns assentos ja vendidos na sessao 1 | Mapa vazio nao prova nada; com buracos, prova |
| Um ingresso ja validado (`usedAt` preenchido) | `ALREADY_USED` sem precisar validar duas vezes na frente do avaliador |
| Uma reserva `PENDING` **ja vencida** na sessao 1 | Cenario 1 observavel na hora, sem esperar 10 minutos |

Os codigos dos ingressos semeados devem ser impressos no fim do seed — a
portaria precisa deles para o teste manual.

O seed reaproveita a geracao de assentos do `EventsService` em vez de duplicar a
logica.

---

## Cenario 1 — assento preso volta ao mapa

Cobre US1, FR-001..007. Prova SC-001 e SC-002.

1. Como `cliente1`, abra a sessao 1 e observe a poltrona presa pela reserva
   vencida do seed: **aparece livre**, porque a leitura do mapa varreu antes de
   responder.
2. Reserve-a. Deve funcionar — e a diferenca entre "parece livre" e "esta livre".
3. Ainda como `cliente1`, reserve outra poltrona e **nao pague**. Confira o
   contador na tela de checkout.
4. Em janela anonima, como `cliente2`, abra a mesma sessao: a poltrona do passo 3
   esta indisponivel.
5. Espere o prazo (ou reduza `RESERVATION_HOLD_MINUTES` para 1 e reinicie a API).
   Recarregue como `cliente2`: a poltrona voltou e pode ser comprada.
6. Volte a aba do `cliente1` e tente pagar: recusa por reserva expirada, sem
   cobranca registrada.
7. No historico do `cliente1`, o pedido aparece como **expirado**, nao como
   cancelado por ele.

---

## Cenario 2 — recusa e nova tentativa

Cobre US2, FR-008..016. Prova SC-003.

1. Como `cliente2`, escolha duas poltronas e va ao pagamento.
2. Confira que os cartoes de teste estao **na tela**, sem precisar sair dela.
3. Pague com `4000 0000 0000 0002`. Esperado: recusa com "Saldo insuficiente",
   reserva ainda ativa, poltronas ainda suas, contador seguindo do mesmo ponto
   (a tentativa nao esticou o prazo).
4. Tente `4000 0000 0000 0069`: "Cartao expirado".
5. Tente um numero qualquer valido: "Cartao nao reconhecido pela simulacao".
6. Pague com `4242 4242 4242 4242`: confirmado, **dois** ingressos emitidos, um
   por poltrona.
7. Volte e tente pagar o mesmo pedido: recusado, com caminho para os ingressos ja
   emitidos.
8. Em "Meus ingressos", abra um deles e confira o QR e o link de
   compartilhamento. Abra o link em janela anonima: mostra filme, sessao e
   poltrona, **sem o codigo do QR**.

---

## Cenario 3 — portaria

Cobre US3, FR-017..026. Prova SC-004 e SC-008.

1. Como `portaria`, acesse a area de portaria: a tela **exige** escolher a sessao
   antes de qualquer coisa.
2. Escolha a sessao 1. Recarregue a pagina: a sessao continua selecionada.
3. Leia pela camera o QR de um ingresso do cenario 2 → **`VALID`**, com filme,
   horario, poltrona e nome.
4. Leia o mesmo ingresso de novo → **`ALREADY_USED`**, informando ha quanto tempo
   passou.
5. Digite o codigo do ingresso ja validado no seed → **`ALREADY_USED`**.
6. Digite um codigo inventado → **`INVALID`**, sem pista nenhuma.
7. Leia um ingresso da sessao 2 → **`WRONG_EVENT`**, dizendo a qual sessao ele
   pertence. Confira que ele **nao** foi marcado como usado: troque para a sessao
   2 e valide → `VALID`.
8. Afaste-se da tela alguns passos: os quatro resultados precisam ser
   distinguiveis sem ler o texto secundario.

> Se a camera nao abrir, confira a URL. `getUserMedia` exige `https` ou
> `localhost`; pelo IP da maquina na rede local o navegador bloqueia. A
> digitacao manual cobre o fluxo, e o README precisa registrar isso.

---

## Cenario 4 — compra definitiva

Cobre US4, FR-027..031.

1. Como `cliente2`, abra um ingresso emitido: nao ha acao de cancelar ou
   estornar, e a tela declara que a compra e definitiva.
2. Como `organizador`, tente cancelar a sessao 1 (que ja tem ingressos):
   bloqueado, informando quantos foram vendidos.
3. Crie uma sessao nova, publique, nao venda nada e cancele: sai da listagem
   publica e nao aceita reservas novas.

---

## Testes automatizados

As tres corridas. Prova SC-005, SC-006 e SC-007.

```bash
npm run db:up
npm run test:e2e -w api
```

| Teste | O que dispara | Resultado exigido |
|---|---|---|
| Assento disputado | duas `POST /reservations` simultaneas, mesmo assento | exatamente uma 201, uma `SEATS_TAKEN` |
| Clique duplo | duas `POST .../payment` simultaneas, cartao aprovado | exatamente uma aprovacao; ingressos emitidos uma vez so |
| Ingresso disputado | duas `POST /gate/validate` simultaneas, mesmo codigo | exatamente um `VALID`, um `ALREADY_USED` |
| Pagamento vs varredura | pagamento de reserva no limite do prazo, concorrente com leitura de mapa | reserva paga mantem os assentos, ou expira sem emitir — nunca ingresso com assento devolvido |

Todos exigem **banco real**: as garantias sendo testadas sao do Postgres, e mock
nao prova nenhuma delas. Cada teste roda o cenario em laco (10x e suficiente)
porque corrida que passa uma vez nao passou.

O relogio dos testes de expiracao vem do `ClockService`
([research.md](./research.md) R11) — nenhum teste usa `sleep`.

---

## Checagem rapida de regressao

Depois de qualquer mexida no fluxo de reserva:

- [ ] Todo assento livre no mapa aceita reserva (SC-001)
- [ ] Recusa mantem os assentos; aprovacao emite um ingresso por assento
- [ ] Link publico nao carrega o `code` em nenhum lugar da resposta
- [ ] Os quatro resultados da portaria continuam alcancaveis com o seed limpo
- [ ] Nenhum log da API imprime numero de cartao
