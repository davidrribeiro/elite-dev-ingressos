# Elite Events — AI Agent Instructions

## Projeto

Plataforma de eventos e ingressos desenvolvida
como desafio técnico Elite Dev.

## Stack

- Next.js
- React
- TypeScript
- NestJS
- PostgreSQL
- Prisma

## Arquitetura

Frontend e backend são aplicações independentes
dentro do mesmo monorepo.

## Frontend

Localização: apps/web

Responsabilidades:
- interface
- navegação
- formulários
- experiência do usuário
- consumo da API

## Backend

Localização: apps/api

Responsabilidades:
- regras de negócio
- autenticação
- autorização
- reservas
- pagamentos
- tickets
- validação
- integração com API externa

## Banco

PostgreSQL + Prisma. Schema em apps/api/prisma/schema.prisma.
Modelo de lugar: assentos numerados (mapa), nao pista.
Catalogo externo: TMDb.

## Invariantes

Duas garantias moram no banco, nunca em if de aplicacao:

- Um assento nao e vendido duas vezes: UNIQUE em ReservationSeat.seatId.
  Conflito vira 409, nunca "consultar e depois inserir".
- Um ingresso nao e validado duas vezes: UPDATE condicional em Ticket.usedAt
  (WHERE usedAt IS NULL), decidindo pelo numero de linhas afetadas.

O code do QR e opaco e aleatorio. O shareToken do link publico e um campo
separado e nunca expoe o code.

## Interface

O enunciado penaliza explicitamente interface generica de ferramenta de IA.
Nao gerar telas prontas por conta propria: layout, hierarquia visual e
componentes sao decisao do autor. Ao mexer no front, seguir o que ja existe.

## Regras

- Não acessar o banco diretamente pelo frontend.
- Não colocar regras de negócio importantes no frontend.
- Toda operação sensível deve ser validada no backend.
- Não utilizar soluções complexas sem justificativa.
- Priorizar simplicidade e legibilidade.
- Antes de implementar uma funcionalidade, analisar a arquitetura existente e reutilizar componentes/serviços existentes. Não criar abstrações desnecessárias.