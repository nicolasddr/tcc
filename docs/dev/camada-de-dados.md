# Camada de dados: Drizzle-only e as armadilhas que recorrem


Não há RLS, policies, triggers de negócio nem RPCs no banco, que guarda só o schema
(tabelas, constraints e FKs). A autorização e as regras de negócio vivem na camada de
aplicação, em TypeScript. O padrão de toda Server Action tem três passos:

1. `getClaims()` ([`lib/supabase/server.ts`](../../lib/supabase/server.ts)), para saber
   quem é o usuário (`claims.sub`). Sem sessão, `redirect('/login')`.
2. Um predicado de [`lib/authz.ts`](../../lib/authz.ts), para responder se este usuário
   pode fazer isto (`isProjectAdmin`, `canCreateProjects`, `canViewResponse` e os
   demais). O `userId` é sempre um argumento explícito.
3. `transaction(run)` ou uma query Drizzle, que é a escrita ou leitura em si, já com o
   escopo explícito no `WHERE` (`id = userId`, `project_id = …`).


O `transaction()` ([`lib/db/index.ts`](../../lib/db/index.ts)) é só um wrapper de
transação, sobre uma única conexão (`ownerDb`, papel `postgres`, dono das tabelas). Ele
não troca de papel nem seta claims: isso era o antigo `withUser`, que não existe mais.

Um predicado de `lib/authz` como o `isProjectAdmin` roda sob `ownerDb` de propósito. Para
responder se fulano é admin ele precisa enxergar todas as linhas, independentemente de
quem pergunta. A segurança não está no predicado ver pouco: está em quem chama passar o
`userId` certo e agir conforme a resposta. Todos aceitam um `db: DbExecutor` opcional
para reaproveitar uma transação já aberta, ou para rodar sob rollback nos testes.

Ao convidar por e-mail, o `findInviteeByEmail(callerId, email)` só resolve o perfil se
quem convida tem `can_create_projects`. Sem permissão ele devolve `null`, indistinguível
de "e-mail não cadastrado", de modo que quem não pode convidar não consegue sondar se um
e-mail existe. A comparação é case-insensitive (`lower(email)`). Essa guarda era uma RPC
`security definer` no banco e hoje é essa checagem explícita; preserve-a se mexer no
fluxo de convite.

### Ler dados de quem você ainda não compartilha projeto

Como não existe RLS em `profiles`, um `join` traz o nome de qualquer perfil. O cuidado
agora é de escopo, e não de permissão de leitura: consultas como
`listMyPendingInvitations(userId)` guardam o filtro `invitee_id = userId` no `WHERE`,
então o `left join` que traz o nome de quem convidou não vaza convites de terceiros, só o
próprio inbox. Sempre ancore a query no `userId` de quem está vendo.

### Imutabilidade e append-only agora são lógica ou schema, não ausência de grant

O truque antigo de tornar `onboarding_responses` imutável negando o grant de UPDATE não
existe mais, já que não há um papel `authenticated` separado. Se algo deve ser
append-only, isso é garantido por não haver action que o atualize e, quando fizer
sentido, por um constraint no `schema.ts`. Ao escrever uma nova action, é você quem decide
o que ela permite.

## Armadilhas de driver (`postgres-js` com Drizzle)

### `pgErrorCode(err)`: o SQLSTATE vem embrulhado

O driver `postgres` lança `PostgresError` com o SQLSTATE em `.code`, mas o Drizzle o
embrulha num `DrizzleQueryError` com o original em `.cause`. Ou seja, `err.code` direto é
`undefined`, e uma action que cheque o código erraria, degradando a mensagem específica
para a genérica. Use sempre o helper `pgErrorCode(err)` de
[`lib/db`](../../lib/db/index.ts), que desembrulha `.code` para `.cause.code`. O código
mais recorrente é o `23505` (unique_violation), por exemplo num convite pendente
duplicado em `inviteEvaluator`.

### `redirect()` e `revalidatePath()` ficam fora do `transaction`

O `redirect()` do `next/navigation` lança uma exceção de control-flow; se for chamado
dentro do callback de `transaction`, aborta a transação. Faça o INSERT
(`.returning({ id })`) dentro do `transaction` e deixe o `redirect` e o `revalidatePath`
para depois, fora dele. O `createProject`, em
[`app/projects/actions.ts`](../../app/projects/actions.ts), serve de padrão.

### `onConflict` para idempotência

Sem RLS, o `WITH CHECK` não roda mais antes do `ON CONFLICT`, então o `onConflict…` volta
a idempotentizar de forma direta. O `createProject` materializa o criador como admin com
`onConflictDoNothing`, e o `provisionUserOnFirstLogin` sincroniza o perfil com
`onConflictDoUpdate`. Use-os à vontade para tornar escritas repetíveis.

## Verificação: o preview remoto não serve para a camada de dados

A verificação primária é o Vitest de integração (`npm test`, que roda `vitest run`). Os
testes `*.int.test.ts` ficam ao lado de cada action e rodam contra o Supabase local, o
que exige um `supabase start` com o Docker de pé. O preview e o login rodam contra o
Supabase remoto, que não valida as queries do Drizzle local.

Os testes provam tanto o fluxo de controle da action (quem pode e o que grava) quanto o
query-builder (colunas camelCase, jsonb de ida e volta, `leftJoin`). Pontos de entrada
úteis: [`lib/authz.int.test.ts`](../../lib/authz.int.test.ts), que é a especificação
executável da autorização, e [`test/helpers.ts`](../../test/helpers.ts), com
`createUser`, `cleanup`, `inRollbackTx` e as demais fixtures. A config está em
[`vitest.config.ts`](../../vitest.config.ts) (padrão `*.int.test.ts`, rodando em série).
