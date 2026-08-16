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

**Escolha:** nem preguicoso puro, nem job periodico — liberacao sob demanda,
em escrita, disparada pela propria requisicao que precisa da resposta
correta (`GET /events/:id`, `POST /reservations`, `POST .../payment`). Antes
de responder, a rota roda duas escritas em transacao: `UPDATE reservation SET
status = 'EXPIRED' WHERE status = 'PENDING' AND expiresAt < agora`, e so
depois `DELETE reservation_seats` das reservas que acabaram de virar
`EXPIRED`.

**A ordem das duas escritas nao e estilo, e a razao de funcionar.** A trava do
assento e a existencia da linha em `ReservationSeat`; apagar essa linha e o
unico jeito de devolver o lugar ao mapa. Se o `DELETE` viesse antes do
`UPDATE`, existiria uma janela real: o assento some da trava um instante
antes da reserva ser marcada como vencida, e um pagamento em curso naquele
instante poderia confirmar a compra depois do lugar ja ter voltado ao
estoque — ingresso emitido para poltrona ja revendida. Na ordem escolhida,
pagamento e varredura disputam a mesma linha da reserva sob o mesmo padrao
de escrita condicional usado em todo o projeto: um dos dois vence, o outro
reavalia o `WHERE` depois do commit e nao encontra nada para mudar.

**Por que nao preguicoso puro (so na leitura, sem escrever):** nao funciona
neste schema. A trava e a *existencia* da linha; filtrar na leitura mostraria
o assento livre e o `INSERT` seguinte bateria na unicidade para sempre — o
assento pareceria livre e seria impossivel de comprar.

**Por que nao job periodico:** infraestrutura de agendamento (`@nestjs/schedule`,
`pg_cron`, worker separado) para um resultado que a liberacao sob demanda
entrega sem processo a mais rodando. A janela de um job tambem nunca fecha
de verdade — sempre existe o intervalo entre o vencimento e a proxima
execucao em que o mapa mente; a liberacao sob demanda nao tem essa janela,
porque quem le o mapa ja le depois da limpeza.

**Custo aceito:** duas escritas extras em cada leitura de mapa. Irrelevante na
escala deste projeto; se um dia incomodar, o indice
`@@index([eventId, status, expiresAt])` (hoje so `[status, expiresAt]`)
resolve sem mudar a logica.

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

**Formato do codigo:** base32 Crockford (alfabeto sem `I`, `L`, `O`, `U`), 16
caracteres a partir de 80 bits de `randomBytes(10)`, exibido em quatro grupos
de quatro (`A1B2-C3D4-E5F6-G7H8`).

**Descartado:** base64url, que e o formato mais obvio para um token aleatorio.
O codigo tem dois consumidores com necessidades opostas — o QR nao liga para
o formato, mas a digitacao manual na portaria e requisito explicito do
enunciado, nao alternativa decorativa. Base64url usa 22 caracteres com caixa
mista e `-`/`_`; alguem transcrevendo `l1I` de um ingresso amassado erra sem
perceber. Crockford resolve isso descartando de proposito os quatro simbolos
mais confundiveis visualmente, e a normalizacao de entrada (`I`/`L` -> `1`,
`O` -> `0`) fecha o ciclo aceitando o que a pessoa provavelmente quis dizer.

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

## Partido visual: "Bilheteria"

**Escolha:** interface clara, neutra e densa. Base de 14px, radius pequeno,
azul funcional para acao, tres cores de estado bem separadas.

**Por que:** a referencia nao e vitrine de streaming, e guiche. As duas telas
que mais importam neste sistema sao operadas por repeticao — a portaria valida
dezenas de ingressos seguidos, o organizador administra varias sessoes. Nesse
uso, densidade e legibilidade valem mais que impacto visual, e cor forte deve
significar alguma coisa em vez de decorar.

Os tres tons de estado (`ok`, `warn`, `danger`) existem por causa de um
requisito especifico: a portaria precisa distinguir VALIDO, JA UTILIZADO e
INVALIDO a alguns passos da tela.

**Descartado — "sala escura":** fundo escuro com um acento quente, jogando toda
a atencao no mapa de assentos. Era a opcao mais bonita e a que melhor destaca a
tela principal do cliente. Perdeu porque penaliza justamente as telas de
operacao: tela escura em portaria com luz ambiente forte, que e o caso real de
uma entrada de cinema, fica dificil de ler.

**Descartado — "papel de ingresso":** claro e quente, serifa nos titulos,
picotes evocando o ingresso fisico. Mais memoravel e o mais distante do visual
generico de ferramenta. Perdeu por custo: o mapa de assentos e a portaria
precisariam de tratamento proprio para a textura nao virar ruido, e o prazo nao
comporta duas linguagens visuais.

**Consequencia assumida:** e o partido menos chamativo dos tres. A aposta e que
consistencia e clareza sob repeticao contem mais que primeira impressao — mas e
uma aposta, e vale dizer que foi consciente.

**Numeros tabulares em toda a interface:** preco, contador regressivo, poltrona
e codigo de ingresso mudam com a tela parada. Com largura variavel, o texto ao
redor treme a cada segundo do contador.

---

## Pagamento sem chave de idempotencia

**Escolha:** clique duplo em "pagar" nao usa chave de idempotencia nem trava
no botao como unica defesa. A propria transicao de estado e o portao:
`UPDATE reservations SET status = 'PAID' WHERE id = ? AND status = 'PENDING'
AND expires_at > agora`, decidida pelo numero de linhas afetadas.

**Por que:** duas requisicoes simultaneas de pagamento disputam a mesma
linha da reserva. Exatamente uma consegue `count === 1` e emite os
ingressos; a outra recebe `count === 0`, verifica que a reserva ja esta
`PAID` e responde apontando para os ingressos que a vencedora acabou de
criar — do ponto de vista de quem clicou duas vezes, o desfecho e o
correto, sem cobranca duplicada. E o mesmo padrao usado na trava do assento
e na validacao da portaria: nunca ler, decidir em `if` e so depois escrever.

**Descartado:** chave de idempotencia enviada pelo cliente, ou
`SELECT ... FOR UPDATE` explicito. As duas resolveriam o mesmo problema com
mais infraestrutura (tabela de chaves usadas, ou SQL cru fora do Prisma) para
um resultado que a maquina de estados ja entrega de graca.

Bonus dessa escolha: ela tambem cobre a corrida entre um pagamento em curso
e a varredura de reservas vencidas (secao "Reserva expira" acima) — as duas
disputam a mesma linha, pelo mesmo mecanismo.

---

## Leitura do QR na portaria

**Escolha:** `@zxing/browser`, que devolve o texto decodificado por callback
e deixa a interface — camera, moldura, mensagens de estado — inteiramente
por conta de quem escreve a tela.

**Descartado:** `html5-qrcode`, mais rapido de plugar, mas que monta a
propria UI de scanner com botoes e bordas prontos. O enunciado penaliza
explicitamente interface que "sai pronta da ferramenta"; uma lib que impoe
sua propria caixa de video teria que ser combatida com CSS por cima depois
— mais trabalho que escrever o proprio componente de video desde o inicio.

**Limitacao aceita e documentada:** `getUserMedia` (a API de camera do
navegador) so funciona em contexto seguro — `https` ou `localhost`. Testar
pelo IP da maquina na rede local (celular na mesma rede, por exemplo) faz o
navegador recusar a camera silenciosamente; **isso e comportamento do
navegador, nao defeito da aplicacao**. A tela de validar explica isso quando
a permissao falha, e a digitacao manual continua funcionando — ela nao e
alternativa de segunda classe, e o caminho que garante a portaria operar
mesmo sem camera.

---

## Estrutura de pastas do front

O plano original previa tres areas separadas — `app/(cliente)/`,
`app/(organizador)/`, `app/portaria/`. Na implementacao, cliente e
organizador foram unificados num unico grupo `app/(app)/`, com a portaria
por baixo do mesmo grupo (`app/(app)/portaria/`).

**Por que:** as tres areas compartilham o mesmo cabecalho (`SiteHeader`), que
ja muda de conteudo conforme o papel logado — manter tres layouts quase
identicos so para variar o menu seria duplicacao sem beneficio. O grupo de
rotas do Next nao aparece na URL, entao `(app)/organizador/page.tsx` continua
respondendo em `/organizador` normalmente.

O grupo `(auth)/` (telas de entrar e cadastrar) e `app/i/` (link publico do
ingresso) continuam separados: essas duas telas nao tem cabecalho nenhum, por
nao pressuporem sessao.

---

## Tratamento de erro

**Escolha:** toda falha da API sai no mesmo formato,
`{ error: { code, message, details? } }`, produzido por um filtro global
unico (`AppExceptionFilter`). O front decide pelo `code`, que e estavel;
`message` e texto para humano e pode mudar sem quebrar nada do outro lado.

**Por que agora e nao depois:** essa decisao foi tomada antes de qualquer
tela existir, de proposito. Retrofitar o formato de erro depois de seis
telas prontas significaria reabrir cada uma para trocar o tratamento.

**Numero de cartao nunca atravessa essa fronteira:** o filtro de excecao so
registra `message` e `stack` do erro nao previsto, nunca o corpo da
requisicao; `PaymentsService` nao loga nada; nao existe coluna de cartao no
banco (`docs/decisoes.md`, secao de pagamento). Testado explicitamente —
`apps/api/test/payments.e2e-spec.ts`, "numero de cartao nunca aparece no log
de erro nem na resposta".

---

## Indice da varredura de reservas vencidas

**Escolha:** manter `@@index([status, expiresAt])`, sem acrescentar `eventId`
ao indice.

**Por que:** a varredura (secao "Reserva expira") filtra por
`eventId + status + expiresAt`. O indice atual cobre dois dos tres campos; o
Postgres filtra o terceiro (`eventId`) sobre um resultado ja pequeno, porque
`status = 'PENDING' AND expiresAt < agora` ja reduz bastante as linhas
candidatas antes do filtro por evento entrar. Na escala deste projeto —
avaliacao, nao producao com milhares de sessoes simultaneas — a diferenca e
imperceptivel.

**Descartado:** `@@index([eventId, status, expiresAt])`. Resolveria uma
questao de desempenho que ainda nao existe, as custas de uma migration e de
um indice a mais para o Postgres manter em toda escrita de `Reservation`.
Trocar so faria sentido com um numero de sessoes concorrentes que este
desafio nao tem como demonstrar — decisao registrada para nao virar duvida
recorrente, nao para ser revertida sem motivo novo.

---

## Uso de IA

 Foi utilizado neste projeto SPECS, com uso da ferramenta Spec Kit (`speckit-specify` -> `speckit-plan` ->
`speckit-tasks` -> `speckit-implement`), com os artefatos de processo
versionados em `specs/001-decisoes-em-aberto/` e a constituicao do projeto em
`.specify/memory/constitution.md`.

**O que a IA fez:** pegando a partir das especificações (`spec.md`, `research.md`,
`data-model.md`, os contratos),foi desenvolvido os schemas no prisma — , algumas partes do backend, testes automatizados e este documento.

As decisoes tecnicas registradas neste arquivo (ordem das escritas na
expiracao, formato do codigo do ingresso, ausencia de chave de idempotencia,
escolha da lib de camera) foram propostas, justificadas e implementadas pela
IA.

**O que foi decisao do autor, nao da ferramenta:** a utilização de SPECS (`spec.md`, `research.md`,
`data-model.md`, os contratos), o desenho tecnico o partido visual da
interface ("Bilheteria" — claro, neutro, denso — contra duas alternativas
descartadas, "sala escura" e "papel de ingresso") foi uma escolha explicita
apresentada e decidida por mim, nao inferida pela IA; e a constituicao do
projeto (principio IV) proibe telas geradas sem essa escolha. A priorizacao
de qual fatia implementar em cada sessao, o momento de parar para revisar, e
os bugs encontrados testando a aplicacao ao vivo no navegador — build de
producao corrompendo o dev server, resultado de portaria testado com codigo
errado, logout nao propagando em tela protegida — vieram de uso manual real
da aplicacao por mim, no navegador.

