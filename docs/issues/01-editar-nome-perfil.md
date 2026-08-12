# 01 — Editar nome no perfil (HU-005)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Página de perfil onde o usuário edita o próprio nome, com a alteração refletindo imediatamente em
todas as telas que exibem o nome, sem reautenticar.

## Critérios de aceite

- [ ] Nome é obrigatório e não pode ficar vazio
- [ ] A alteração reflete imediatamente nas telas que exibem o nome
- [ ] Não exige reautenticação
- [ ] Teste: o usuário atualiza o próprio nome e, como a action escopa o UPDATE por `id = userId`, não toca no perfil de outro (`app/profile/actions.int.test.ts`)

## Bloqueada por

- 00
