# Feature Specification: Decisoes em aberto do fluxo de compra

**Feature Branch**: `main`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "resolva as decisões em aberto."

## Contexto

Quatro decisoes de comportamento ficaram pendentes em `docs/decisoes.md` e no
contrato da API. Todas bloqueiam implementacao porque definem o que o usuario
ve e o que o sistema garante:

1. O que acontece com um assento segurado por uma reserva que nunca foi paga.
2. Como o cliente provoca uma aprovacao e como provoca uma recusa no pagamento
   simulado.
3. Sobre qual sessao a portaria esta validando ingressos.
4. Se uma compra concluida pode ser desfeita, devolvendo o assento ao estoque.

Esta especificacao resolve as quatro. Nao introduz telas novas: ajusta e
completa o comportamento das telas ja previstas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assento preso por reserva abandonada volta ao mapa (Priority: P1)

Bruno escolhe a poltrona F7, chega na tela de pagamento e desiste — fecha o
navegador sem pagar. Carla, que queria a mesma poltrona, esta olhando o mapa e
ve F7 ocupada. Passado o tempo de reserva, F7 volta a aparecer livre para Carla
e ela consegue compra-la normalmente. Se Bruno voltar depois e tentar pagar, ele
e avisado de que a reserva expirou e volta ao mapa para escolher de novo.

**Why this priority**: sem isso, todo carrinho abandonado tira uma poltrona de
circulacao permanentemente. Em uma demonstracao com poucos assentos, o mapa
fica inutilizavel depois de alguns testes. E o unico dos quatro itens que
degrada o sistema com o uso.

**Independent Test**: criar uma reserva, nao pagar, esperar o prazo, recarregar
o mapa em outra conta e comprar o mesmo assento com sucesso.

**Acceptance Scenarios**:

1. **Given** uma reserva nao paga cujo prazo ainda corre, **When** outro
   cliente abre o mapa da sessao, **Then** o assento aparece indisponivel.
2. **Given** uma reserva nao paga cujo prazo ja venceu, **When** outro cliente
   abre o mapa da sessao, **Then** o assento aparece disponivel e pode ser
   reservado com sucesso na sequencia.
3. **Given** uma reserva nao paga cujo prazo ja venceu, **When** o dono tenta
   pagar, **Then** o pagamento e negado com a informacao de que a reserva
   expirou e nenhuma cobranca e registrada.
4. **Given** uma reserva nao paga em andamento, **When** o cliente esta na tela
   de pagamento, **Then** ele ve quanto tempo ainda tem para concluir.
5. **Given** uma reserva expirada, **When** o cliente consulta o historico do
   pedido, **Then** o pedido aparece como expirado, e nao como cancelado por
   ele.

---

### User Story 2 - Cliente enfrenta uma recusa e tenta de novo (Priority: P1)

Carla chega ao pagamento e quer ver o que acontece quando o cartao e recusado.
A propria tela lista os cartoes de teste e o resultado de cada um. Ela usa o
cartao de saldo insuficiente, recebe uma recusa com o motivo explicito, e o
sistema mantem as poltronas dela seguras. Ela troca para o cartao aprovado e
conclui a compra sem voltar ao mapa nem escolher os lugares de novo.

**Why this priority**: o enunciado pede explicitamente que o pagamento
contemple a recusa. Uma recusa que perde a selecao de assentos transforma o
caminho de erro em um beco sem saida.

**Independent Test**: reservar, pagar com o cartao de recusa, conferir a
mensagem e a reserva ainda ativa, pagar com o cartao de aprovacao e receber os
ingressos.

**Acceptance Scenarios**:

1. **Given** uma reserva ativa, **When** o cliente paga com o cartao de teste
   aprovado, **Then** a compra e confirmada e um ingresso e emitido para cada
   assento.
2. **Given** uma reserva ativa, **When** o cliente paga com um cartao de teste
   de recusa, **Then** ele ve o motivo da recusa, a reserva continua ativa e os
   assentos continuam reservados para ele.
3. **Given** uma recusa recem-recebida, **When** o cliente tenta de novo com o
   cartao aprovado dentro do prazo, **Then** a compra e confirmada.
4. **Given** a tela de pagamento aberta, **When** o cliente a le, **Then** os
   cartoes de teste e o resultado de cada um estao visiveis sem precisar sair
   da tela.
5. **Given** uma compra ja confirmada, **When** o cliente tenta pagar o mesmo
   pedido de novo, **Then** a operacao e recusada e ele e levado aos ingressos
   ja emitidos.
6. **Given** uma tentativa de pagamento em andamento, **When** o cliente clica
   em pagar repetidamente, **Then** apenas uma cobranca e registrada.

---

### User Story 3 - Portaria opera uma sessao especifica (Priority: P2)

O operador da portaria comeca o turno escolhendo a sessao da porta em que esta.
A sessao escolhida fica visivel na tela o tempo todo. A partir dai, todo
ingresso lido e conferido contra aquela sessao: um ingresso de outra sala e
recusado como sessao errada, em vez de ser aceito por engano. Ao trocar de
porta, o operador troca a sessao em dois toques.

**Why this priority**: sem escolher a sessao, o resultado "evento errado"
exigido pelo enunciado nao tem como existir. E o item que torna um dos quatro
retornos obrigatorios testavel.

**Independent Test**: selecionar a sessao A, ler um ingresso valido da sessao B
e obter o retorno de sessao errada; trocar para a sessao B e obter valido.

**Acceptance Scenarios**:

1. **Given** a portaria recem-aberta sem sessao escolhida, **When** o operador
   acessa a tela, **Then** ele e obrigado a escolher uma sessao antes de
   conseguir validar qualquer ingresso.
2. **Given** uma sessao selecionada, **When** o operador le um ingresso valido
   daquela sessao, **Then** o retorno e valido, com filme, horario, poltrona e
   nome do titular.
3. **Given** uma sessao selecionada, **When** o operador le um ingresso de
   outra sessao, **Then** o retorno e sessao errada e informa a que sessao
   aquele ingresso pertence.
4. **Given** uma sessao selecionada, **When** o operador recarrega a pagina,
   **Then** a sessao continua selecionada.
5. **Given** a lista de sessoes, **When** o operador a abre, **Then** as
   sessoes do dia aparecem primeiro, ordenadas por horario.
6. **Given** um codigo inexistente ou adulterado, **When** o operador o le ou
   digita, **Then** o retorno e invalido, sem revelar se o codigo chegou perto
   de existir.

---

### User Story 4 - Compra confirmada e definitiva (Priority: P3)

Bruno comprou e quer desistir. Ele nao encontra botao de cancelar no ingresso:
depois de confirmada, a compra e definitiva nesta versao, e a tela diz isso com
todas as letras em vez de deixar o cliente procurando. Do outro lado, a
organizadora tenta cancelar uma sessao que ja tem ingressos vendidos e o
sistema bloqueia, explicando que existem compras confirmadas.

**Why this priority**: e uma decisao de escopo, nao uma funcionalidade. Precisa
estar escrita para que a ausencia de estorno seja lida como escolha e nao como
esquecimento, e para impedir o unico caminho que deixaria um cliente com
ingresso de uma sessao que nao existe mais.

**Independent Test**: comprar um ingresso e verificar que nao ha caminho de
cancelamento; como organizadora, tentar cancelar a sessao e receber o bloqueio.

**Acceptance Scenarios**:

1. **Given** um ingresso emitido, **When** o cliente abre o ingresso, **Then**
   nao existe acao de cancelar ou estornar, e a condicao de compra definitiva
   esta declarada.
2. **Given** uma reserva ainda nao paga, **When** o cliente a cancela, **Then**
   os assentos voltam imediatamente ao mapa.
3. **Given** uma sessao com ao menos um ingresso emitido, **When** a
   organizadora tenta cancela-la, **Then** a operacao e bloqueada com o numero
   de ingressos ja vendidos.
4. **Given** uma sessao sem nenhum ingresso emitido, **When** a organizadora a
   cancela, **Then** a sessao sai da listagem publica e nao aceita novas
   reservas.

---

### Edge Cases

- **Prazo vence entre abrir a tela de pagamento e clicar em pagar**: a compra e
  negada e o cliente volta ao mapa. O contador na tela nao autoriza nada
  sozinho; quem decide e a verificacao no momento do pagamento.
- **Dois clientes disputam um assento recem-liberado**: apenas um conclui a
  reserva; o outro recebe aviso de assento indisponivel com o lugar destacado no
  mapa, sem perder os demais assentos que havia selecionado.
- **Cliente recebe recusa e deixa a tela aberta ate o prazo vencer**: a proxima
  tentativa e negada por expiracao, nao por cartao.
- **Ingresso lido duas vezes na portaria**: a primeira leitura vale; a segunda
  informa que ja foi utilizado e ha quanto tempo.
- **Duas leitoras apontadas para o mesmo ingresso ao mesmo tempo**: exatamente
  uma recebe valido; a outra recebe ja utilizado.
- **Camera indisponivel ou sem permissao na portaria**: a digitacao manual do
  codigo continua funcionando e a tela explica por que a camera nao abriu.
- **Sessao ja comecou ou terminou**: a portaria continua validando; nao ha
  bloqueio por horario nesta versao.
- **Mapa com muitas reservas vencidas acumuladas**: a primeira consulta apos o
  vencimento ja mostra os assentos livres, sem exigir acao de ninguem.
- **Cartao com formato invalido**: e recusado como erro de preenchimento, sem
  registrar tentativa de cobranca.

## Requirements *(mandatory)*

### Functional Requirements

#### Expiracao e devolucao de assentos

- **FR-001**: Toda reserva nao paga MUST ter um prazo de 10 minutos contados da
  criacao, apos o qual perde a validade.
- **FR-002**: O sistema MUST liberar os assentos de reservas vencidas de forma
  que qualquer assento exibido como disponivel possa efetivamente ser
  reservado, sem depender de acao manual ou de rotina agendada.
- **FR-003**: A liberacao MUST ocorrer antes de qualquer consulta ao mapa de
  assentos de uma sessao e antes de qualquer tentativa de reserva nessa sessao.
- **FR-004**: Uma reserva vencida MUST ser distinguivel de uma reserva
  cancelada pelo proprio cliente no historico do pedido.
- **FR-005**: O sistema MUST recusar pagamento de reserva vencida, informando o
  motivo, sem registrar cobranca.
- **FR-006**: A tela de pagamento MUST exibir o tempo restante da reserva.
- **FR-007**: O cliente MUST poder cancelar uma reserva ainda nao paga,
  devolvendo os assentos ao mapa imediatamente.

#### Pagamento simulado

- **FR-008**: O resultado do pagamento MUST ser determinado pelo numero do
  cartao informado, segundo esta tabela fixa:

  | Cartao | Resultado | Motivo exibido |
  |---|---|---|
  | 4242 4242 4242 4242 | Aprovado | — |
  | 4000 0000 0000 0002 | Recusado | Saldo insuficiente |
  | 4000 0000 0000 0069 | Recusado | Cartao expirado |
  | qualquer outro | Recusado | Cartao nao reconhecido pela simulacao |

- **FR-009**: A tela de pagamento MUST listar os cartoes de teste e o resultado
  de cada um, visiveis sem sair da tela.
- **FR-010**: Uma recusa MUST manter a reserva ativa e os assentos seguros ate
  o fim do prazo original, permitindo nova tentativa.
- **FR-011**: O prazo da reserva MUST NOT ser estendido por tentativas de
  pagamento.
- **FR-012**: Cada tentativa de pagamento MUST ser registrada com seu resultado
  e motivo, aprovada ou recusada.
- **FR-013**: Uma aprovacao MUST emitir exatamente um ingresso por assento da
  reserva, tudo ou nada.
- **FR-014**: O sistema MUST recusar pagamento de reserva ja paga e direcionar
  o cliente aos ingressos emitidos.
- **FR-015**: O sistema MUST garantir que cliques repetidos em pagar produzam
  no maximo uma cobranca aprovada.
- **FR-016**: O sistema MUST NOT armazenar o numero do cartao informado.

#### Portaria

- **FR-017**: O operador da portaria MUST escolher uma sessao antes de validar
  qualquer ingresso.
- **FR-018**: O sistema MUST oferecer ao operador a lista de sessoes
  publicadas, com as do dia corrente em primeiro lugar, ordenadas por horario.
- **FR-019**: A sessao selecionada MUST permanecer visivel durante toda a
  operacao e sobreviver a recarga da pagina.
- **FR-020**: O operador MUST poder trocar de sessao a qualquer momento.
- **FR-021**: A validacao MUST retornar exatamente um entre quatro resultados:
  valido, invalido, ja utilizado, sessao errada.
- **FR-022**: Em sessao errada, o retorno MUST identificar a sessao correta do
  ingresso.
- **FR-023**: Em ja utilizado, o retorno MUST informar o momento da validacao
  anterior.
- **FR-024**: Em valido, o retorno MUST exibir filme, horario, poltrona e nome
  do titular.
- **FR-025**: Um mesmo ingresso MUST ser validado com sucesso no maximo uma
  vez, inclusive sob leituras simultaneas.
- **FR-026**: Codigos inexistentes MUST retornar invalido sem revelar
  informacao sobre proximidade ou formato de codigos validos.

#### Definitividade da compra

- **FR-027**: Ingressos emitidos MUST NOT ser cancelaveis, estornaveis ou
  transferiveis nesta versao.
- **FR-028**: A tela do ingresso MUST declarar que a compra e definitiva.
- **FR-029**: Um assento MUST NOT gerar mais de um ingresso ao longo da vida da
  sessao.
- **FR-030**: O cancelamento de uma sessao com ingressos emitidos MUST ser
  bloqueado, informando quantos ingressos ja foram vendidos.
- **FR-031**: Uma sessao cancelada MUST sair da listagem publica e MUST NOT
  aceitar novas reservas.

### Key Entities

- **Reserva**: pedido de um cliente sobre um ou mais assentos de uma sessao.
  Tem prazo, valor total e um estado entre em aberto, paga, cancelada pelo
  cliente e expirada. Ganha nesta especificacao a regra de vencimento e de
  devolucao dos assentos.
- **Tentativa de pagamento**: registro de uma cobranca simulada sobre uma
  reserva, com resultado e, quando recusada, motivo. Uma reserva pode ter
  varias; no maximo uma aprovada.
- **Ingresso**: direito de entrada de uma pessoa em um assento de uma sessao.
  Nasce apenas de uma tentativa aprovada, e definitivo e carrega o momento em
  que foi usado na portaria, se ja tiver sido.
- **Sessao de portaria**: a sessao escolhida pelo operador, que delimita quais
  ingressos sao aceitos naquela porta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos assentos exibidos como disponiveis no mapa podem ser
  efetivamente reservados, salvo disputa simultanea com outro cliente.
- **SC-002**: Um assento preso por reserva abandonada volta a ser vendavel em
  no maximo 10 minutos, sem intervencao de ninguem.
- **SC-003**: Um avaliador consegue provocar uma recusa de pagamento e depois
  concluir a compra sem reescolher assentos, em menos de 1 minuto e sem
  consultar documentacao fora da tela.
- **SC-004**: Os quatro retornos da portaria sao demonstraveis com os dados
  semeados, sem preparar nada a mais.
- **SC-005**: Sob duas tentativas simultaneas para o mesmo assento, exatamente
  uma reserva e criada, em 100% das execucoes do teste.
- **SC-006**: Sob duas validacoes simultaneas do mesmo ingresso, exatamente uma
  retorna valido, em 100% das execucoes do teste.
- **SC-007**: Nenhum caminho da interface leva a um assento vendido duas vezes
  ou a um ingresso aceito duas vezes.
- **SC-008**: Cada um dos quatro retornos da portaria e identificavel a
  distancia, sem leitura do texto secundario.

## Assumptions

- O prazo de 10 minutos vem de `RESERVATION_HOLD_MINUTES`, ja presente na
  configuracao do projeto. E o padrao do mercado para reserva de poltrona e
  serve tanto para uso real quanto para avaliacao sem espera longa.
- A liberacao sob demanda foi escolhida no lugar de rotina agendada porque
  entrega o mesmo resultado observavel sem exigir infraestrutura de
  agendamento no ambiente de avaliacao. O custo aceito e um pequeno trabalho
  extra na primeira consulta apos vencimentos.
- Os numeros de cartao seguem a convencao de ambientes de teste de provedores
  reais, o que torna a regra reconhecivel para quem avalia.
- Cartoes desconhecidos sao recusados em vez de aprovados: em uma simulacao,
  aprovar qualquer numero esconde justamente o caminho de erro que o enunciado
  pede para demonstrar.
- Nao ha estorno, revenda nem envio por e-mail — o enunciado dispensa
  explicitamente esses itens.
- A portaria opera conectada. Validacao offline esta fora de escopo.
- Nao ha janela de horario para validar ingresso: a portaria aceita leitura
  antes, durante e depois da sessao, porque restringir horario criaria falha em
  demonstracao fora do horario do filme.
- Os papeis de organizador, cliente e portaria ja existem no seed e sao a base
  para percorrer estes fluxos.
- Valores em reais, uma unica moeda.
