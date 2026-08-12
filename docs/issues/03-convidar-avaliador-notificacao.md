# 03 — Convidar avaliador cadastrado, notificação e listar/recusar (HU-018 parcial, HU-010, HU-019)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

O Administrador convida um usuário já cadastrado informando o e-mail (o `findInviteeByEmail` de
`lib/authz` acha só `id` e `name`, sem permitir enumerar e-mails). O convite gera uma notificação
in-platform para o convidado, emitida pela própria action. O convidado vê seus convites pendentes,
com nome do projeto, quem convidou e data, e pode recusar. Entra também o inbox de notificações,
com sino, lista e marcar como lida.

A variante de convidar quem ainda não tem conta é a fatia 07 (ADR 0006).

## Critérios de aceite

- [ ] Convite por e-mail de usuário existente gera notificação ao convidado
- [ ] Não é possível convidar membro ativo nem duplicar convite pendente (unique index)
- [ ] Convidado lista os pendentes e consegue recusar (status vira `declined`)
- [ ] Notificações podem ser marcadas como lidas
- [ ] Testes: convite gerando notificação; unicidade do pendente; recusa; escopo (só o convidado e o admin veem o convite)

## Bloqueada por

- 00, 02

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): o
> `findInviteeByEmail(callerId, email)` (`lib/authz`) preserva a anti-enumeração de e-mails, porque
> só resolve o perfil se quem convida tem `can_create_projects`; sem isso devolve `null`,
> indistinguível de "não cadastrado". A action `inviteEvaluator` valida admin (`isProjectAdmin`),
> faz o pré-check de membro ativo, insere o convite (o unique index trata o pendente duplicado, com
> `23505`) e emite a notificação via `lib/notifications/invitation.ts`, tudo em TypeScript. O antigo
> trigger `notify_on_invitation` deixou de existir.
