# 05 — Correção do item 7: travar `inactive → active` pelo próprio membro

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Fechar o buraco de segurança confirmado: um membro removido ou que saiu (`inactive`) não pode
reativar a própria linha (`inactive → active`), o que desfaria a remoção (HU-021) e a saída
(HU-022).

Garantir que as transições de `status` são controladas por ator, na camada de aplicação. O próprio
membro só faz `pending_onboarding → active`, ao concluir o onboarding, e `active → inactive`, ao
sair; as transições administrativas são do Administrador. O caminho `inactive → active` pelo membro
fica fechado por não existir action que o ofereça: `removeMember` e `leaveProject` só escrevem
`active → inactive` (com `where status = 'active'`) e não há Server Action que reative a própria
linha.

Escrever primeiro o teste que reproduz o furo, com um membro inativo tentando se reativar, e provar
que nenhum caminho da app o permite.

## Critérios de aceite

- [ ] Teste de regressão reproduz a intenção do furo (membro inativo tentando se reativar)
- [ ] Não há caminho de app que permita `inactive → active` pelo próprio membro
- [ ] Concluir onboarding (`pending_onboarding → active`) e sair (`active → inactive`) seguem funcionando
- [ ] As transições administrativas, como a remoção, seguem funcionando

## Bloqueada por

- 04

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): esta é uma
> guarda de segurança *load-bearing*, porque impede restaurar privilégio. Sem RLS e sem triggers no
> banco, depois do flip da issue #22, ela é garantida na app-layer: `removeMember` e `leaveProject`
> só emitem `active → inactive` (com `where status = 'active'`) e não existe Server Action que
> reative a própria linha. O teste de integração fixa isso, provando que nenhuma action expõe o
> caminho.
