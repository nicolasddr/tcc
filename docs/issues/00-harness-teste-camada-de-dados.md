# 00 — (Prefactor) Harness de teste da camada de dados

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Estabelecer o seam único de teste do Épico 0: testes de integração em Vitest, contra o Supabase
local (`supabase start`), que exercem as Server Actions e os predicados de `lib/authz` com um
`userId` explícito e afirmam comportamento externo, ou seja, o que o usuário consegue ver e fazer e
os efeitos colaterais de suas ações (notificação criada, membro materializado, flag ligada). Sem
mockar app e com schema real. Os testes `*.int.test.ts` ficam ao lado de cada action, com fixtures
em `test/helpers.ts`, e há um comando único de teste no projeto (`npm test`).

> Nota histórica: originalmente o harness era pgTAP, que personificava um usuário via
> `request.jwt.claims` e `role authenticated` e testava a RLS no banco. Com o flip Drizzle-only
> (issue #22) a autorização foi para a app-layer, então o pgTAP foi aposentado e a verificação
> passou a ser o Vitest de integração.

## Critérios de aceite

- [x] `supabase start` e schema aplicado no fluxo de teste
- [x] Fixtures para criar usuários e projetos e trocar o `userId` entre asserções (`test/helpers.ts`)
- [x] Pelo menos um teste verde de referência (por exemplo, não-membro não vê um projeto e membro ativo vê)
- [x] Um comando único roda a suíte (`npm test`, que chama `vitest run`) e serve de base para as demais fatias

## Bloqueada por

- D02
