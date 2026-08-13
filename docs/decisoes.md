# Decisoes tecnicas

Registro das escolhas e do que foi descartado. Alimenta o README final.

---

## Mapa de assentos em vez de pista

O enunciado permite os dois; escolhi assentos numerados.

**Por que:** o catalogo e de filmes (TMDb), e sessao de cinema tem lugar
marcado. Pista com contador seria mais rapido, mas o mapa e onde o problema
de concorrencia fica visivel e onde a interface tem algo real para resolver.

**Custo aceito:** mais trabalho de front e um schema maior.

---

## Como impedir que o mesmo lugar seja vendido duas vezes

**Escolha:** a garantia mora no banco. `ReservationSeat.seatId` e `UNIQUE`, entao
a existencia da linha e a trava do assento. Duas requisicoes simultaneas para o
mesmo lugar: uma insere, a outra recebe violacao de unicidade e vira **409**.

**Descartado:** consultar se o assento esta livre e depois inserir. Entre a
leitura e a escrita cabe outra requisicao — funciona nos testes manuais e falha
em producao. Nao adianta ser dentro de transacao: sem trava, duas transacoes leem
"livre" ao mesmo tempo.

**Consequencia:** cancelar ou expirar apaga as linhas de `ReservationSeat`,
devolvendo o assento ao estoque. Perde-se o historico de quem tentou reservar.
A alternativa seria manter as linhas e usar indice unico parcial
(`UNIQUE (seat_id) WHERE status IN ('PENDING','PAID')`), que preserva historico
mas exige SQL cru na migration, fora do schema do Prisma.

---

## Reserva expira

`PENDING` nasce com `expiresAt`. Sem isso, um carrinho abandonado prende o
assento para sempre.

**A decidir:** expirar preguicosamente (ao ler o mapa, tratar reservas vencidas
como livres) ou com job periodico. O modo preguicoso evita infraestrutura de
agendamento; o job mantem o banco limpo. Escrever aqui qual foi e por que.

---

## QR que nao pode ser forjado

**Escolha:** `Ticket.code` e um valor aleatorio opaco, com entropia suficiente
para nao ser adivinhavel, validado por consulta ao banco.

**Descartado:** JWT assinado dentro do QR. Permitiria validar sem banco (util se
a portaria ficar sem rede), mas nao da para revogar um ingresso cancelado e o
QR fica grande. Como a portaria aqui esta online, a consulta e mais simples e
mais segura.

**Nao usar:** id sequencial ou o UUID do ticket. Sequencial e adivinhavel; o
UUID vaza em URLs e logs.

---

## Link de compartilhamento separado do codigo do QR

`shareToken` e um campo diferente de `code`.

**Por que:** se o link publico expusesse o `code`, quem recebesse o link
entraria no evento no lugar do dono. A pagina compartilhada mostra filme,
sessao, local e lugar — sem o conteudo do QR.

---

## Validacao unica na portaria

**Escolha:** `UPDATE tickets SET used_at = now() WHERE id = ? AND used_at IS NULL`.
Zero linhas afetadas significa que outro leitor chegou primeiro: resposta
`ALREADY_USED`.

**Descartado:** ler o ticket, checar `usedAt` no codigo e salvar. Dois leitores
de QR apontados para o mesmo ingresso passariam os dois.

---

## _(seguir preenchendo)_

Autenticacao, estrutura de pastas do front, tratamento de erro, o que foi feito
com IA e o que foi feito na mao.
