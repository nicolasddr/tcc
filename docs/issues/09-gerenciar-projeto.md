# 09 — Gerenciar projeto: editar, concluir, arquivar e reativar (HU-014/015/016/017)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Ciclo de vida do projeto pelo Administrador. Editar nome e descrição, bloqueado em `completed` e
`archived`, porque o UPDATE roda com `where status = 'active'`. Concluir, o que torna o projeto
somente leitura, a critério do Administrador, sem o gate de Fase 4, que foi removido (o gate "após a
Fase 3" volta quando o conceito de fase existir, a partir do Épico 1). Arquivar, o que tira o
projeto da lista padrão mas o mantém visível com filtro. E reativar, voltando a `active` e editável.
Cada status tem sua indicação visual.

## Critérios de aceite

- [x] Edição só pelo Administrador e só em projeto `active`
- [x] Concluir e arquivar tornam o projeto somente leitura, com confirmação
- [x] Reativar volta o projeto a editável
- [x] Testes: enforcement de somente leitura em `completed` e `archived`; transições de status

## Bloqueada por

- 02

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): a Server
> Action edita, conclui, arquiva e reativa via Drizzle (`transaction`), checando
> `isProjectAdmin(userId, projectId)` (`lib/authz`) antes. A trava de somente leitura é a própria
> action, porque o UPDATE de edição carrega `where status = 'active'` e não há rede de proteção no
> banco, sem RLS nem trigger. O teste de integração prova que projeto `completed` ou `archived`
> rejeita a edição.
