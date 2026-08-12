# 07 — Convite por e-mail pendente até o primeiro login (ADR 0006)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Permitir convidar um e-mail que ainda não tem perfil. O convite fica pendente referenciando o
e-mail, e no primeiro login com Google daquele e-mail o provisionamento na app-layer
(`provisionUserOnFirstLogin`, chamado pelo `app/auth/callback/route.ts`) resolve os convites
pendentes: cria o perfil, vincula o `invitee_id` e emite a notificação. Cai a validação "usuário já
cadastrado" da fatia 03. O Administrador compartilha o link por fora e, ao logar, o convite aparece
sozinho.

No schema: `project_invitations` ganha `invitee_email` e `invitee_id` passa a NULLABLE, preenchido
na resolução. A resolução vive em `lib/auth/provision.ts`, idempotente e dentro de uma transação.

A decisão está na [ADR 0006](../adr/0006-convite-por-email-pendente-ate-primeiro-login.md).

## Critérios de aceite

- [x] Convidar e-mail sem perfil cria convite pendente, por e-mail
- [x] O primeiro login daquele e-mail resolve o convite (vinculando `invitee_id`) e dispara a notificação
- [x] O convite aparece nos pendentes do novo usuário
- [x] Testes: convite por e-mail, login, resolução e notificação (`lib/auth/provision.int.test.ts`)

Foi entregue no schema (`lib/db/schema.ts`, com `invitee_email` e `invitee_id` nullable), na
resolução em `lib/auth/provision.ts` (`provisionUserOnFirstLogin`, chamada pelo
`app/auth/callback/route.ts`) e na action `inviteEvaluator` (`app/projects/actions.ts`).

> Nota histórica: originalmente foi entregue na migration `0009_invitation_by_email.sql`, com o
> trigger `handle_new_user` resolvendo o convite no banco. O flip Drizzle-only (issue #22) moveu a
> resolução para `lib/auth/provision.ts` e o baseline passou a ser gerado pelo Drizzle.

## Bloqueada por

- 03

> A ADR 0006 ainda está `proposed`: ratificar com a Profª. Maria Istela antes de mergear, já que ela
> revisa schema já entregue.

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): a resolução
> do primeiro login é o `provisionUserOnFirstLogin` (`lib/auth/provision.ts`), chamado pelo
> `app/auth/callback/route.ts` dentro de uma transação, logo após o `exchangeCodeForSession`. Ele
> cria o perfil (`onConflictDoUpdate`), vincula os convites por e-mail pendentes (com match
> case-insensitive) e emite a notificação via `lib/notifications/invitation.ts`. É idempotente, então
> em logins seguintes é no-op. Substituiu o antigo trigger `handle_new_user`.
