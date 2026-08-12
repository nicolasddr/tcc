# D03 — Login com Google (HU-002)

> Status: já implementado, em 10/06. Registro retroativo.

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Página de login com o botão "Entrar com Google" (`signInWithOAuth`); route handler de callback
(`exchangeCodeForSession`); criação automática do perfil no primeiro login, com nome e e-mail do
Google; e proteção de rotas, mandando o não-autenticado para o login.

## Critérios de aceite

- [x] Entrar com qualquer conta Google, sem restrição de domínio
- [x] Perfil criado no primeiro login, com nome e e-mail verificado
- [x] Não-autenticado é redirecionado para o login

## Bloqueada por

- D01, D02
