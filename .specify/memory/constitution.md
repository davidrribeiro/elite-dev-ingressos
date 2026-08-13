<!--
SYNC IMPACT REPORT
==================
Version change: (template nao preenchido) -> 1.0.0
Bump rationale: MINOR/PATCH nao se aplicam. Esta e a primeira ratificacao real;
  o arquivo anterior continha apenas placeholders e nao definia governanca alguma.

Principios adicionados (nenhum renomeado ou removido — nao havia versao anterior):
  - I.   Garantias criticas moram no banco
  - II.  A API e a unica autoridade
  - III. Toda escolha relevante fica registrada
  - IV.  A interface e decisao do autor
  - V.   Simplicidade tem que se pagar

Secoes adicionadas:
  - Restricoes Tecnicas (era [SECTION_2_NAME])
  - Fluxo de Desenvolvimento (era [SECTION_3_NAME])
  - Governance (preenchida)

Origem dos principios: invariantes ja praticadas e escritas em AGENTS.md e
docs/decisoes.md, promovidas a governanca. Nenhum principio novo foi inventado
neste momento — o arquivo formaliza o que o projeto ja seguia.

Templates e artefatos verificados:
  ✅ .specify/templates/plan-template.md — "Constitution Check" referencia o
     arquivo dinamicamente; nenhuma alteracao necessaria
  ✅ .specify/templates/spec-template.md — sem secao obrigatoria afetada
  ✅ .specify/templates/tasks-template.md — categorias de tarefa compativeis com
     os principios I e V; nenhuma alteracao necessaria
  ✅ .claude/skills/speckit-* — sem referencia a nome de agente especifico
     (CLAUDE.md, GEMINI.md); nenhuma alteracao necessaria
  ✅ specs/001-decisoes-em-aberto/plan.md — tabela de Constitution Check
     atualizada para citar os principios ratificados no lugar de AGENTS.md
  ⚠ README.md — ainda nao menciona a constituicao. Nao e obrigatorio; avaliar ao
     escrever o README final

Follow-up TODOs: nenhum. Nenhum placeholder foi deixado em aberto.
-->

# Elite Events Constitution

## Core Principles

### I. Garantias criticas moram no banco

Toda invariante que duas requisicoes simultaneas podem violar MUST ser imposta
por restricao do banco ou por escrita condicional de uma unica instrucao,
decidida pelo numero de linhas afetadas. Ler o estado, decidir em `if` e depois
escrever e **proibido** nesses casos.

Toda invariante desse tipo MUST ter um teste automatizado que dispara as
operacoes concorrentes em laco (minimo 10 repeticoes) e exige o resultado exato.

**Rationale**: entre a leitura e a escrita cabe outra requisicao. Codigo assim
passa em todo teste manual e falha em producao — e as tres garantias centrais
deste produto (assento nao vendido duas vezes, ingresso nao validado duas vezes,
compra nao cobrada duas vezes) sao exatamente desse tipo. Corrida que passou uma
vez nao passou.

### II. A API e a unica autoridade

O front-end MUST NOT acessar o banco. Nenhuma regra que decide dinheiro, estoque
ou acesso pode existir apenas no cliente.

Contador regressivo, validacao de formulario e botao desabilitado sao
conveniencia de interface, nunca autorizacao: a decisao MUST ser refeita no
servidor no momento da operacao, e o servidor MUST recusar o pedido invalido
mesmo que a interface jamais o permitisse.

**Rationale**: o cliente e territorio do usuario. Uma trava que so existe na tela
e uma trava que nao existe.

### III. Toda escolha relevante fica registrada

Toda decisao com alternativa viavel descartada MUST ser registrada em
`docs/decisoes.md`, contendo: o que foi escolhido, por que, e o que foi
descartado com o motivo.

O uso de IA MUST ser declarado: quais ferramentas, em que partes, e o que foi
feito sem elas. Artefatos de processo (specs, planos, arquivos de contexto)
MUST ser versionados junto do codigo.

**Rationale**: este projeto e avaliado tanto pelo raciocinio quanto pelo
resultado. Uma decisao sem contexto e lida como descuido, e a mesma escolha
explicada vira evidencia de criterio. O registro tambem impede que a proxima
pessoa — inclusive o autor daqui a duas semanas — refaca um debate ja encerrado.

### IV. A interface e decisao do autor

Nenhuma tela pode ser gerada por ferramenta sem escolha explicita de layout,
hierarquia visual e componentes. Telas novas MUST reusar os primitivos ja
existentes em `apps/web/components/ui/`; criar variante paralela de um primitivo
existente exige justificativa.

Quando houver alternativa, uma biblioteca que injeta interface propria MUST ser
preterida em favor de uma headless que devolva apenas o comportamento.

**Rationale**: o enunciado do desafio penaliza explicitamente a interface
generica que "sai pronta da ferramenta". O problema nunca foi a ferramenta ter
ajudado — foi ninguem ter escolhido nada.

### V. Simplicidade tem que se pagar

Cada dependencia nova, abstracao nova ou componente de infraestrutura novo MUST
vir acompanhado da alternativa mais simples que foi considerada e do motivo de
ela nao servir. Empate resolve pelo mais simples.

Especificamente: nenhum agendador, fila, cache distribuido ou servico adicional
entra sem que a versao sem ele tenha sido tentada e tenha falhado por um motivo
nomeado.

**Rationale**: prazo curto e escopo pequeno de proposito. Complexidade nao
justificada custa duas vezes — na hora de escrever e na hora de explicar.

## Restricoes Tecnicas

- **Stack**: React no front (com ou sem framework) e Node, Python ou Java no
  back. O projeto adotou Next.js + NestJS + PostgreSQL + Prisma; trocar
  qualquer um deles e amendment, nao decisao de implementacao.
- **Banco**: as instrucoes de configuracao e execucao MUST estar no README, e o
  projeto MUST subir do zero com os comandos ali descritos.
- **Segredos**: chaves de API e segredo de JWT MUST vir de variavel de ambiente,
  com `.env.example` versionado e `.env` fora do repositorio.
- **Dados sensiveis**: numero de cartao MUST NOT ser persistido nem registrado
  em log. Cobranca e simulada; nenhuma transacao financeira real acontece.
- **Codigo do ingresso**: o conteudo do QR MUST ser aleatorio e opaco, e MUST
  NOT trafegar por rota publica de compartilhamento. A projecao de cada rota
  MUST ser garantida por selecao explicita de campos, nunca por remocao de
  campo depois da consulta.
- **Dados de teste**: o seed MUST deixar o sistema em estado que permita
  percorrer o fluxo inteiro sem preparacao manual — um organizador, dois
  clientes, um usuario de portaria e ao menos uma sessao publicada com
  ingressos disponiveis.

## Fluxo de Desenvolvimento

- **Ponta a ponta antes de profundidade**: o fluxo completo e simples tem
  prioridade sobre o pedaco sofisticado com telas pela metade. Nenhuma
  funcionalidade opcional comeca antes de o caminho obrigatorio fechar.
- **Spec Kit**: mudancas de comportamento passam por `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks`. Correcao de defeito e ajuste de texto nao
  precisam do ciclo.
- **Commits**: um por fatia logica, mensagem descrevendo a decisao e nao o
  arquivo. O historico faz parte da entrega.
- **Validacao**: antes de declarar uma feature pronta, o roteiro do
  `quickstart.md` correspondente MUST ser percorrido com o banco recem-semeado,
  do zero.
- **Limitacoes conhecidas**: o que nao funciona como esperado MUST estar escrito
  no README. Omitir custa mais caro que a propria limitacao.

## Governance

Esta constituicao prevalece sobre qualquer outra pratica do projeto. Onde
`AGENTS.md` e ela discordarem, ela vence, e `AGENTS.md` MUST ser corrigido.

**Amendment**: alterar, adicionar ou remover principio exige (a) a mudanca
escrita neste arquivo, (b) entrada correspondente em `docs/decisoes.md`
explicando o que mudou e por que, e (c) verificacao dos artefatos dependentes
listados no Sync Impact Report.

**Versionamento** (semantico):

- **MAJOR**: remocao ou redefinicao incompativel de principio ou de regra de
  governanca.
- **MINOR**: principio ou secao nova, ou ampliacao material de orientacao
  existente.
- **PATCH**: correcao de texto, esclarecimento, ajuste sem efeito semantico.

**Conformidade**: `/speckit-plan` MUST avaliar cada principio antes do Phase 0 e
de novo apos o Phase 1, registrando o resultado na tabela de Constitution Check.
Violacao sem justificativa registrada na tabela de Complexity Tracking bloqueia a
implementacao. Justificar nao e diluir: um principio so cede quando a alternativa
que o respeita foi tentada e falhou por um motivo nomeado.

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
