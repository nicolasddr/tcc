# D04 — Logout global (HU-004)

> Status: implementado em 22/06; falta validar em e2e multi-dispositivo com login real.

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Server Action `signOut({ scope: 'global' })` ligada ao botão Sair, que encerra a sessão em todos os
dispositivos e redireciona para o login.

## Critérios de aceite

- [x] Logout encerra o acesso em todos os dispositivos e sessões
- [x] Redireciona para a tela de login
- [ ] Validado em e2e, em ambiente com login real e multi-dispositivo

## Bloqueada por

- D03
