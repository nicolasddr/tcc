# 08 — Permissão de plataforma (HU-007/008/009/011)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Fluxo completo de permissão para criar projetos. O usuário solicita, sem poder reenviar se já tem
permissão ou solicitação pendente; o Super-admin vê a fila de pendentes, com nome, e-mail e data, e
aprova ou rejeita. A aprovação liga `can_create_projects` e emite a notificação de resultado
(HU-011). Como será construída depois do flip Drizzle-only, tudo é app-layer: uma Server Action que
checa `isSuperAdmin(userId)` (`lib/authz`) antes de ligar a flag e emitir a notificação, de modo que
só o super-admin resolve.

## Critérios de aceite

- [ ] Usuário solicita, com reenvio bloqueado por pendente ou permissão existente (unique index)
- [ ] Super-admin lista só os pendentes; aprovar liga a flag; aprovar ou rejeitar notifica o solicitante
- [ ] Apenas o Super-admin resolve, com a action validando `isSuperAdmin`
- [ ] Testes: resolução só por super-admin; aprovação ligando flag e notificando; unicidade do pendente

## Bloqueada por

- 00

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): a flag
> `can_create_projects` só muda por uma Server Action que valida `isSuperAdmin(userId)`
> (`lib/authz`), já que não há RLS nem RPC no banco. A action liga a flag e emite a notificação de
> resultado em TypeScript, dentro de uma transação, reaproveitando `lib/notifications/*` no padrão da
> fatia 03.
