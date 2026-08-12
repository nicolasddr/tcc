# D02 — Schema do Épico 0

> Status: já implementado, em 15/06. Registro retroativo. Ver a nota do flip no rodapé.

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Toda a camada de dados do Épico 0, ou seja, as tabelas do domínio (`profiles`, `super_admins`,
`platform_permission_requests`, `projects`, `project_members`, `project_invitations`,
`notifications`, `onboarding_questions` e `onboarding_responses`) com suas constraints (checks de
status e role, unique indexes anti-duplicidade) e FKs, incluindo o `ON DELETE CASCADE` do
onboarding. Hoje o Drizzle é o dono do schema: o `lib/db/schema.ts` é a fonte da verdade e o baseline
SQL é gerado por `drizzle-kit generate`. A autorização que antes vivia no banco está em `lib/authz`,
em predicados que espelham as antigas policies e funções. O bootstrap do super-admin é manual, por um
insert em `super_admins`, fora do versionamento.

## Critérios de aceite

- [x] Todas as tabelas, constraints e FKs aplicadas no Supabase local (baseline do Drizzle)
- [x] Autorização coberta na app-layer (`lib/authz`) e verificada por testes de integração em Vitest
- [x] Bootstrap do super-admin documentado (manual, fora do versionamento)

## Bloqueada por

- D01

> Nota histórica sobre o flip Drizzle-only ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md),
> issue #22): este schema nasceu SQL-first, nas migrations `0001` e `0002`, com RLS em todas as
> tabelas, funções `security definer` (`is_super_admin`, `is_member_of`, `is_project_admin`,
> `shares_project_with`, `has_pending_invitation` e outras), triggers (`handle_new_user`,
> `auto_add_creator_as_admin`, `notify_on_invitation`, `enforce_project_readonly`,
> `check_invitation_target` e outros) e RPCs (`find_invitee_by_email`, `resolve_permission_request`,
> `set_member_evaluations`). O flip removeu todos esses objetos: o banco guarda só o schema, com
> tabelas, constraints e FKs, o Drizzle virou o dono e toda a lógica de autorização e de negócio
> migrou para TypeScript, em `lib/authz`, `lib/auth/provision.ts` e `lib/notifications/`.
