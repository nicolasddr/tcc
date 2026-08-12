# 10 — Remover avaliador e sair voluntariamente (HU-021/022)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

O Administrador remove um avaliador, com confirmação: o status vira `inactive`, as avaliações são
preservadas, os convites pendentes dele para o projeto são cancelados e não há notificação ao
removido. O Avaliador pode sair voluntariamente, também com confirmação: o status vira `inactive` e
as avaliações são preservadas.

## Critérios de aceite

- [x] Remoção e saída setam `status = 'inactive'` preservando as avaliações
- [x] A remoção cancela os convites pendentes do membro para o projeto
- [x] Há confirmação antes de cada ação
- [x] Testes: remoção e saída levando a inactive; cancelamento dos pendentes; e, com a fatia 05, o removido não consegue se reativar

## Bloqueada por

- 04

> Relacionada à fatia 05, cuja correção do item 7 garante que a remoção e a saída não sejam desfeitas
> pelo próprio membro.
