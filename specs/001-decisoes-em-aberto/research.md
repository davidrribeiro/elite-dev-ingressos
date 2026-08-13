# Phase 0 — Research

Decisoes tecnicas para implementar [spec.md](./spec.md). Formato: decisao,
motivo, alternativas descartadas.

O material aqui alimenta `docs/decisoes.md` na entrega final — este arquivo e o
rascunho tecnico, aquele e a narrativa para quem avalia.

---

## R1 — Como devolver assentos de reservas vencidas

**Decisao**: varredura sob demanda, escopada ao evento, em duas instrucoes
condicionais dentro de uma transacao, **nesta ordem**:

1. `reservation.updateMany({ where: { eventId, status: PENDING, expiresAt: { lt: agora } }, data: { status: EXPIRED } })`
2. `reservationSeat.deleteMany({ where: { reservation: { eventId, status: EXPIRED } } })`

Chamada no inicio de `GET /events/:id` (mapa) e de `POST /reservations`.

**Motivo — a ordem nao e detalhe de estilo, e a corretude.** Considere a ordem
invertida (apagar assentos primeiro):

- A varredura apaga as linhas de `ReservationSeat` da reserva X, vencida.
- Ao mesmo tempo, uma requisicao de pagamento de X, iniciada um instante antes,
  ainda enxerga X como paga­vel e a confirma.
- Resultado: ingressos emitidos para assentos que ja voltaram ao estoque, e o
  proximo cliente compra a mesma poltrona. Exatamente o defeito que o desafio
  pede para impedir.

Na ordem correta, a disputa acontece **na linha da reserva**, que os dois lados
querem escrever. O Postgres serializa: quem pega o lock primeiro vence, e o
segundo re-avalia seu `WHERE` depois do commit do primeiro (comportamento de
`UPDATE` sob Read Committed). Ou a reserva vira `PAID` e a varredura nao
encontra nada, ou vira `EXPIRED` e o pagamento nao encontra nada. A etapa 2 so
apaga assentos de reservas ja `EXPIRED`, entao uma reserva paga nunca perde os
lugares.

A etapa 2 tambem e idempotente e auto-corretiva: "reserva expirada nao segura
assento" e uma invariante que ela restabelece toda vez que roda, independente de
como o banco chegou naquele estado.

**Descartado — expiracao preguicosa apenas na leitura**: tratar reservas
vencidas como livres ao montar o mapa, sem escrever nada. Nao funciona neste
schema. A trava do assento e a **existencia** da linha em `ReservationSeat`, com
`UNIQUE` em `seatId`. Filtrar na leitura mostraria o assento livre, e o `INSERT`
seguinte bateria na restricao para sempre. O assento ficaria visivelmente livre e
permanentemente incomprável — pior que nao liberar.

**Descartado — job periodico** (`@nestjs/schedule`, `pg_cron` ou worker): exige
processo ou extensao a mais no ambiente de avaliacao, e deixa uma janela entre o
vencimento e a proxima execucao em que o mapa mente. A varredura sob demanda nao
tem janela: quem le o mapa ja le depois da limpeza.

**Descartado — indice unico parcial** (`UNIQUE (seat_id) WHERE status IN (...)`),
que preservaria historico de tentativas: exige SQL cru na migration, fora do
schema do Prisma, e o historico de quem tentou reservar nao vale essa
complexidade aqui. Ja estava descartado em `docs/decisoes.md`.

**Custo aceito**: duas instrucoes indexadas em cada leitura de mapa. Se
incomodar, o indice de R10 resolve.

---

## R2 — Reserva de multiplos assentos e o 409 util

**Decisao**: uma transacao com `reservation.create` seguido de
`reservationSeat.createMany` com todos os `seatIds`. Violacao de unicidade
(`P2002`) derruba a transacao inteira — reserva parcial nunca existe. No
`catch`, ja fora da transacao, uma leitura descobre quais assentos estao
tomados e a resposta 409 carrega essa lista para o front destacar no mapa.

**Motivo**: a leitura de diagnostico acontece **depois** da falha e serve so
para a mensagem. A corretude nao depende dela — se um dos assentos for liberado
entre a falha e o diagnostico, o pior caso e uma mensagem levemente
desatualizada, e o cliente tenta de novo.

`Prisma.PrismaClientKnownRequestError` com `code === 'P2002'` foi confirmado no
cliente instalado (7.9.1).

**Descartado — verificar disponibilidade antes de inserir**: entre a leitura e a
escrita cabe outra requisicao. Estar dentro de transacao nao ajuda: sem trava,
duas transacoes leem "livre" simultaneamente sob Read Committed.

**Descartado — `skipDuplicates: true`**: reservaria silenciosamente um
subconjunto do que o cliente pediu. Quem escolheu quatro poltronas juntas nao
quer duas.

---

## R3 — Clique duplo em "pagar" e idempotencia

**Decisao**: nenhuma chave de idempotencia. A transicao de estado ja e o portao.

```
count = reservation.updateMany({
  where: { id, customerId, status: PENDING, expiresAt: { gt: agora } },
  data:  { status: PAID }
})
```

`count === 1` autoriza a emissao dos ingressos, na mesma transacao.
`count === 0` significa que a reserva nao estava pagavel; uma leitura seguinte
diz por que, e a resposta muda conforme o estado: `PAID` devolve os ingressos ja
emitidos (FR-014), `EXPIRED` recusa por expiracao (FR-005), `CANCELLED` recusa.

**Motivo**: e o mesmo padrao da portaria, ja escolhido no projeto. Dois cliques
simultaneos disputam a linha da reserva; exatamente um recebe `count === 1`.
Emitir ingresso duplicado deixa de ser possivel por construcao, sem tabela de
idempotencia, sem cache de requisicao e sem `disabled` no botao como unica
defesa.

Como bonus, cobre gratuitamente a corrida entre pagamento e varredura de R1: as
duas escritas concorrem pela mesma linha.

**Atencao**: isso vale **so para o caminho aprovado**. Recusa nao muda o estado
da reserva (FR-010), entao nao passa por esse portao — apenas registra um
`Payment` com `DECLINED`. Duas recusas simultaneas gravam duas linhas, o que e
correto: foram duas tentativas.

**Descartado — chave de idempotencia no header**: infraestrutura para um
problema que a maquina de estados ja resolve.

**Descartado — `SELECT ... FOR UPDATE`**: mesma garantia, mais codigo, e exige
SQL cru ou transacao interativa mais longa.

---

## R4 — Formato do codigo do ingresso

**Decisao**: 80 bits de `crypto.randomBytes(10)` codificados em **base32
Crockford**, 16 caracteres apresentados em quatro grupos: `A1B2-C3D4-E5F6-G7H8`.
Na entrada, normalizar antes de consultar: caixa alta, remover hifens e espacos,
mapear `I`/`L` para `1` e `O` para `0`.

O `shareToken` continua separado e pode ser `randomBytes(16).toString('base64url')`
— ninguem digita um link a mao.

**Motivo**: o codigo do ingresso tem dois consumidores com necessidades
opostas. O QR nao se importa com o formato; **a portaria digitando a mao se
importa muito**, e a digitacao manual e requisito explicito do enunciado, nao
plano B decorativo. Base32 Crockford existe exatamente para isso: sem caracteres
ambiguos, indiferente a caixa, tolerante aos erros classicos de transcricao.

Efeito colateral bom: maiusculas, digitos e hifen cabem no modo alfanumerico do
QR, que gera um codigo visivelmente menos denso e mais facil de ler com camera
ruim que o modo byte exigido por base64url.

80 bits de entropia sao inadivinhaveis para este cenario — o espaco e de 2^80 e
cada tentativa custa uma requisicao autenticada como portaria.

**Descartado — base64url**: 22 caracteres com caixa mista e `-`/`_`. Um humano
transcrevendo `l1I` de um ingresso amassado erra, e o erro vira um "invalido"
que ninguem entende.

**Descartado — JWT assinado dentro do QR**: permitiria validar sem banco, mas
nao da para revogar, e o QR fica grande. Ja descartado em `docs/decisoes.md`.

**Descartado — UUID do ticket ou id sequencial**: sequencial e adivinhavel; o
UUID vaza em URL e log.

---

## R5 — Sessao selecionada na portaria

**Decisao**: a escolha vive no `localStorage` do dispositivo
(`portaria.sessaoId`). O layout da area de portaria redireciona para a selecao
quando nao ha valor. A API recebe o `eventId` em cada validacao e nao guarda
estado de sessao por operador.

**Motivo**: e preferencia de dispositivo, nao dado de dominio — a mesma conta de
portaria pode estar em duas portas diferentes ao mesmo tempo, e amarrar a sessao
ao usuario no servidor quebraria esse caso real. Sobrevive a recarga (FR-019),
troca em dois toques (FR-020) e nao precisa de tabela nova.

**Descartado — sessao no token JWT**: exigiria novo login a cada troca de porta.

**Descartado — coluna no usuario da portaria**: um registro por operador impede
dois dispositivos simultaneos e cria escrita no banco para uma preferencia de
interface.

---

## R6 — Leitura do QR pela camera

**Decisao**: `@zxing/browser` com `@zxing/library`.

**Motivo**: entrega o fluxo de video e o resultado decodificado, e deixa toda a
interface por conta do autor. O enunciado penaliza explicitamente tela que "sai
pronta da ferramenta"; uma lib que injeta a propria caixa de scanner com botoes e
bordas proprios entrega exatamente essa cara.

**Descartado — `html5-qrcode`**: mais rapido de plugar, mas monta uma UI
completa e opinativa que teria de ser combatida com CSS por cima. Perder tempo
lutando contra o estilo de uma lib e pior que gastar o mesmo tempo escrevendo o
proprio.

**Restricao a documentar no README**: `getUserMedia` so funciona em contexto
seguro — `https` ou `localhost`. Testar pelo IP da maquina na rede local **nao
abre a camera**, e isso e comportamento do navegador, nao defeito da aplicacao. A
tela precisa dizer isso quando a permissao falhar, senao parece bug.

---

## R7 — Geracao do QR na tela do ingresso

**Decisao**: pacote `qrcode`, metodo `toString({ type: 'svg' })`, renderizado em
Server Component. O SVG vai no HTML.

**Motivo**: zero JavaScript no cliente para uma imagem estatica, nitidez em
qualquer zoom (importante: o ingresso vai ser lido de uma tela de celular por uma
camera) e nenhum estado de carregamento para tratar.

**Descartado — `qrcode.react`**: componente cliente para renderizar algo que
nunca muda.

**Descartado — endpoint que devolve PNG**: uma requisicao a mais, cache para
pensar, e um caminho a mais por onde o `code` poderia vazar.

---

## R8 — Contador regressivo e desvio de relogio

**Decisao**: as respostas que carregam `expiresAt` carregam tambem `serverNow`.
O front calcula o desvio uma unica vez (`serverNow - Date.now()`) e aplica em
todos os contadores da sessao.

**Motivo**: relogio de cliente erra, as vezes por minutos. Sem correcao, um
relogio adiantado zera o contador de uma reserva que ainda vale, e o cliente
abandona uma compra viavel. Um atrasado promete tempo que nao existe.

O contador **nao autoriza nada** (FR-005): quem decide se ainda da tempo e a
escrita condicional de R3. O contador e informacao.

**Descartado — devolver segundos restantes em vez de instante absoluto**: o
numero envelhece durante a viagem e a cada reidratacao do componente.

---

## R9 — Nivel de isolamento das transacoes

**Decisao**: Read Committed, o padrao. Nenhuma transacao pede `Serializable`.

**Motivo**: nenhuma das corridas depende de leitura estavel. Todas terminam em
uma escrita condicional cujo `WHERE` o banco re-avalia no momento do commit, ou
em uma restricao de unicidade:

| Corrida | O que a resolve |
|---|---|
| Dois clientes, mesmo assento | `UNIQUE (reservation_seats.seat_id)` |
| Clique duplo em pagar | `UPDATE ... WHERE status = 'PENDING'` (R3) |
| Pagamento vs varredura de vencidas | disputa da linha da reserva (R1 + R3) |
| Duas leitoras, mesmo ingresso | `UPDATE ... WHERE used_at IS NULL` |

`Serializable` traria erros de serializacao para tratar e retentativas para
escrever, resolvendo um problema que nao existe. Confirmado que
`Prisma.TransactionIsolationLevel` esta disponivel em 7.9.1 caso algum caso
futuro precise — nao e o caso aqui.

---

## R10 — Indice para a varredura

**Decisao**: manter `@@index([status, expiresAt])`, que ja existe. Se o perfil de
consulta incomodar, trocar por `@@index([eventId, status, expiresAt])`.

**Motivo**: a varredura filtra por `eventId + status + expiresAt`; o indice atual
cobre dois dos tres e o Postgres filtra o resto. Em escala de avaliacao a
diferenca e imperceptivel. Registrado para nao virar descoberta tardia.

---

## R11 — Como testar expiracao sem esperar 10 minutos

**Decisao**: um `ClockService` injetavel (`now(): Date`) no lugar de `new Date()`
espalhado pelo codigo. Em teste, substituido por um relogio controlado.

**Motivo**: sem isso, testar expiracao exige `sleep` de minutos ou escrever
`expiresAt` no passado por fora do servico — a primeira opcao torna a suite
inutilizavel, a segunda testa o banco em vez do servico. Uma interface de um
metodo e a menor abstracao que resolve, e o `RESERVATION_HOLD_MINUTES` do `.env`
continua sendo a unica fonte do prazo.

**Descartado — `jest.useFakeTimers()`**: nao alcanca o relogio do Postgres nem o
`new Date()` executado dentro de codigo ja compilado do Prisma.
