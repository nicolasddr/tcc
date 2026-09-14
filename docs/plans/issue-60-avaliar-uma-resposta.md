# Plano de implementação — Issue #60: "24 — Avaliar uma resposta: notas, justificativa e envio imutável"

Link: https://github.com/nicolasddr/tcc/issues/60
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 27, 28, 29, 30, 31, 36)
Blocked by: #58 (fechada) — "Geração de respostas com proveniência"

**Executado em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com o que a
seguinte herda — anote ali o que divergiu, como foi feito no plano do redesenho de telas.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Fundação de dados: limite, duas tabelas, helper de autorização, fixtures e a guarda do vínculo | ☑ |
| 2 | Servidor da avaliação: módulos puros, loaders e a action de envio, com os testes de integração | ☐ |
| 3 | Tela do avaliador e navegação: rota, formulário, leitura pós-envio e a aba | ☐ |

Decisões de domínio já registradas, nenhuma ADR nova é necessária: ADR 0009 (imutabilidade, vínculo
de membro e a emenda da chave por definição), ADR 0010 (escala fixa), ADR 0008 (Administrador-avaliador).

---

## 1. Ponto de partida

Esta é a primeira fatia do Épico 2 que escreve **dado do avaliador**. Diferente da #59, aqui quase
nada existe: não há tabela de avaliação, não há action de envio e não há tela do avaliador. O que já
está pronto e vai ser reaproveitado:

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Rodada aberta, com versões congeladas | `(tabs)/rounds/rounds.ts` (`loadOpenRound`, `isOpen`) | resolve a rodada e prova que ela aceita avaliação |
| Respostas da rodada | `pipeline/responses.ts` (`listRoundResponses`) | a fila de respostas a avaliar |
| Codebook de uma versão | `pipeline/codebook.ts` (`loadCodebookVersion`) | definições e critérios **da versão que a rodada congelou** |
| Herança de critérios gerais | `pipeline/criteria.ts` (`resolveCells`, `criteriaOfDefinition`) | já produz exatamente a lista de células (definição × critério) que a tela pede — e já é testada em `criteria.unit.test.ts` |
| Padrão de action com validação antes da escrita | `app/onboarding/actions.ts` (`completeOnboarding`) | prior art mais próximo: deriva o `project_member_id` no servidor, valida tudo antes de gravar |
| Padrão de form por chave nomeada | `projects/[id]/onboarding/consent-form.tsx` (`q_${id}`) | prior art do encoding de campos por entidade |

### Fronteira com a #61 (importante para não inchar esta issue)

A #61 é dona de: painel retrátil com prompt e item, os quatro estados de espera, indicador de
progresso, controles de anterior/próxima, avanço automático após o envio e a ordem embaralhada por
avaliador com rótulo fixo.

A #60 constrói a **rota mínima** que hospeda o formulário: resolve a rodada aberta, escolhe uma
resposta, renderiza o formulário e, depois do envio, renderiza a mesma resposta em leitura. Sem
embaralhamento, sem progresso, sem painel de contexto.

---

## 2. Modelagem — duas tabelas

Seguindo o spec (§ "Avaliação") e a emenda da ADR 0009.

### `evaluations` — a unidade de submissão e de imutabilidade

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid pk | |
| `round_id` | uuid not null | redundante com `response.round_id`, e deliberado: o spec pede a rodada na avaliação, e é o que torna a consulta de progresso e a exportação diretas. Um teste prova que as duas fontes concordam (mesmo padrão das colunas de versão de `responses`) |
| `response_id` | uuid not null | |
| `project_member_id` | uuid not null | **vínculo**, nunca o usuário (ADR 0009 / história 36) |
| `submitted_at` | timestamptz not null default now() | coluna obrigatória: "avaliada" é fato datado, não contagem de notas |

- `unique (response_id, project_member_id)` → `ev_unique_response_member`. Recusa o segundo envio
  mesmo numa corrida.
- `index (round_id, project_member_id)` → `ev_round_member`, para o progresso da #61 e o cálculo da #62.
- FKs: `round_id → rounds`, `response_id → responses` e `project_member_id → project_members`, os
  três com **restrict** (a ADR 0009 exige o do vínculo: gerir equipe não apaga dado de pesquisa).

### `scores` — a nota

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid pk | |
| `evaluation_id` | uuid not null | |
| `definition_id` | uuid not null | entra na chave porque critério geral é avaliado uma vez por definição |
| `criterion_id` | uuid not null | |
| `value` | text not null | CHECK `value in ('high','medium','low')` |
| `justification` | text | opcional, CHECK de tamanho ≤ 2000 |

- `unique (evaluation_id, definition_id, criterion_id)` → `sc_unique_cell`. É a chave da emenda da
  ADR 0009, e é o que deixa as duas notas de um critério geral coexistirem sem violar unicidade.
- `index (evaluation_id)` → `sc_evaluation`.
- FKs: `evaluation_id → evaluations` com **cascade** (a nota pertence à avaliação, não tem vida
  própria); `definition_id → codebook_definitions` e `criterion_id → codebook_criteria` com
  **restrict** (apagar a definição apagaria o significado da nota).

### Valores da escala: inglês no banco, português na tela

O schema já guarda enums em inglês (`administrator`, `evaluator`, `open`, `closed`, `generated`) e
traduz em `labels.ts`. A escala segue o padrão: `high` / `medium` / `low` no banco, "Alto" / "Médio"
/ "Baixo" na tela. A ADR 0010 exige o CHECK no banco, e não só na aplicação — "é o tipo de valor que
não pode entrar errado nem por caminho de teste".

---

## 3. Fronteiras que a action recusa

Todas na camada de aplicação, com o ator vindo da sessão:

1. Sem sessão → `requireUserId()` redireciona (padrão do repo).
2. Sem **vínculo de avaliador ativo** naquele projeto → recusa. Administrador sem o segundo vínculo
   é recusado como qualquer outro (AC explícito, história 36).
3. Vínculo de avaliador de **outro projeto** → recusa. Como o `project_member_id` é derivado no
   servidor a partir de `(userId, projectId, role='evaluator', status='active')`, e nunca vem do
   cliente, essa recusa é estrutural.
4. Resposta que não pertence à rodada aberta daquele projeto → recusa.
5. **Rodada fechada** → recusa. O AC da #57 ("depois de fechada, a rodada não aceita resposta nova
   nem avaliação nova") só tinha como ser testado na metade de "resposta"; esta issue fecha a outra.
6. Envio **incompleto** → recusa nomeando as definições incompletas, sem gravar nada.
7. **Segundo envio** da mesma resposta pelo mesmo vínculo → recusa por checagem explícita, com o
   unique como backstop da corrida (`pgErrorCode(err) === '23505'`, padrão de `rounds/actions.ts`).
8. Justificativa acima de `JUSTIFICATION_MAX` → recusa.
9. Nota com valor fora da escala → recusa (CHECK no banco como backstop).

**As células nunca vêm do cliente.** A action recarrega definições e critérios da versão de codebook
que *a rodada congelou* e monta a lista com `resolveCells`. O formulário só fornece valores; a lista
do que precisa ser preenchido é do servidor. Mesmo desenho de `completeOnboarding`, e é o que impede
que um cliente adulterado envie menos células do que o codebook exige.

---

## 4. Encoding do formulário (contrato entre a Parte 2 e a Parte 3)

Prior art: o `q_${id}` do onboarding.

- ocultos: `project_id`, `response_id`
- por célula: `score_<definitionId>_<criterionId>` (radio, valor `high|medium|low`) e
  `justification_<definitionId>_<criterionId>` (textarea, `maxLength={JUSTIFICATION_MAX}`)

Justificativa vazia grava `null`. A Parte 2 implementa a leitura desse contrato e a Parte 3 o
produz — se uma das duas divergir, a outra quebra, então mudar isso exige atualizar as duas.

---

# Parte 1 — Fundação de dados e a guarda do vínculo

**Objetivo:** deixar o banco, a autorização e as fixtures prontos, sem nenhuma tela nem action nova.
Nada do que esta Parte entrega é visível ao usuário; ela existe para que a Parte 2 só escreva regra.

**Ler antes:** `AGENTS.md`, as seções 1 a 3 deste plano, `lib/db/schema.ts` (cabeçalho e as tabelas
`rounds`/`responses`), `test/helpers.ts` e `drizzle.config.ts`.

### 1.1 `lib/limits.ts`

```ts
export const JUSTIFICATION_MAX = 2000
```

Os demais limites do Épico 2 já existem. Anotação de consenso e justificativa de outlier ficam para
#66 e #65.

### 1.2 `lib/db/schema.ts` + migration

Acrescentar `evaluations` e `scores` conforme a § 2, com os CHECKs:

- `sc_value_check`: `value = ANY (ARRAY['high'::text,'medium'::text,'low'::text])`
- `sc_justification_len`: `justification IS NULL OR char_length(justification) <= 2000`
  (literal congelado, como manda o comentário no topo do arquivo)

Fluxo: `npx drizzle-kit generate` → conferir o SQL gerado em `supabase/migrations/` → `npm run
db:reset`. Não usar `supabase gen`.

### 1.3 `lib/authz.ts`

```ts
/** Id do vínculo de AVALIADOR ativo no projeto, ou null. */
export async function evaluatorMembershipId(
  userId: string, projectId: string, db: DbExecutor = ownerDb,
): Promise<string | null>

/** Tem vínculo de avaliador ativo? (usa a de cima) */
export function isProjectEvaluator(...): Promise<boolean>
```

Devolver o **id do vínculo**, e não um booleano, é o que faz a avaliação apontar para o vínculo sem
que o cliente participe disso.

### 1.4 `test/helpers.ts`

- `addEvaluation(tx, roundId, responseId, projectMemberId, opts?)` → id, aceitando opcionalmente uma
  lista de células para já gravar notas;
- `addScore(tx, evaluationId, definitionId, criterionId, opts?)`;
- `cleanup`: apagar `evaluations` das rodadas dos projetos em limpeza **antes** de `projects`. O
  helper já faz isso com `responses` pelo mesmo motivo (FK restrict). Sem isso, o cascade de
  `projects → project_members` esbarra no restrict de `evaluations.project_member_id` e toda a suíte
  de integração quebra na limpeza. `scores` some por cascade.

### 1.5 Tirar o zero grampeado do vínculo de avaliador

`app/projects/evaluator-link.ts:18` declara `SUBMITTED_EVALUATIONS_UNTIL_EPICO_2 = 0`, usado como
default de `evaluatorLinkOf`. `revokeEvaluatorRefusal` depende dele para recusar a revogação de quem
já enviou avaliação (ADR 0008: "a ação é reversível enquanto não houver avaliação submetida"). Hoje é
inofensivo, porque não existe avaliação. **A partir da tabela criada nesta Parte vira bug**:
`revokeEvaluatorRole` (`app/projects/actions.ts:400`) faz `DELETE` na linha de `project_members`, e o
FK restrict transformaria isso num erro de banco cru em vez da recusa explicada.

- remover a constante e o default do parâmetro;
- `app/projects/actions.ts` (`evaluatorRoleView`): contar as avaliações do vínculo de avaliador
  daquele usuário naquele projeto e passar para `evaluatorLinkOf`;
- `app/projects/[id]/members/page.tsx`: mesma contagem (é a tela que decide se oferece o botão);
- `app/projects/evaluator-link.unit.test.ts`: ajustar as chamadas que usavam o default.

### Testes da Parte 1

- [ ] `lib/authz.int.test.ts`: `evaluatorMembershipId` devolve o vínculo de avaliador ativo; devolve
      `null` para admin sem o segundo vínculo, para vínculo inativo, para `pending_onboarding` e para
      projeto alheio; para quem tem os dois papéis devolve o **de avaliador**.
- [ ] Integração de schema (pode morar no teste de authz ou num arquivo próprio): o unique
      `(response_id, project_member_id)` recusa a segunda avaliação; o unique
      `(evaluation_id, definition_id, criterion_id)` recusa a nota duplicada e **aceita** a mesma
      dupla critério+resposta em definições diferentes; o CHECK recusa valor fora da escala;
      desativar o vínculo do avaliador não apaga a avaliação.
- [ ] `evaluator-link.unit.test.ts` verde depois do ajuste, cobrindo a recusa de revogação com
      avaliação enviada.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com a migration commitada junto do
`schema.ts`. Nenhuma tela mudou.

### O que a Parte 2 herda

**Nada divergiu da § 2.** Colunas, uniques (`ev_unique_response_member`, `sc_unique_cell`),
índices (`ev_round_member`, `sc_evaluation`), CHECKs (`sc_value_check`, `sc_justification_len`) e
as políticas de FK (restrict nos três de `evaluations`; cascade em `scores.evaluation_id`, restrict
em `definition_id`/`criterion_id`) saíram como planejado. Migration: `supabase/migrations/
0012_narrow_gressill.sql`, gerada por `npx drizzle-kit generate` e aplicada com `npm run db:reset`
sem surpresas. Exports do Drizzle: `evaluations` e `scores` (via `@/lib/db`).

Assinaturas reais:

```ts
// lib/limits.ts
export const JUSTIFICATION_MAX = 2000

// lib/authz.ts
export function evaluatorMembershipId(
  userId: string, projectId: string, db: DbExecutor = ownerDb,
): Promise<string | null>            // só role='evaluator' E status='active'
export function isProjectEvaluator(
  userId: string, projectId: string, db: DbExecutor = ownerDb,
): Promise<boolean>
export function countSubmittedEvaluations(
  userId: string, projectId: string, db: DbExecutor = ownerDb,
): Promise<number>                   // conta em QUALQUER status do vínculo (ver abaixo)

// test/helpers.ts
export type CellFixture = {
  definitionId: string; criterionId: string
  value?: 'high' | 'medium' | 'low'; justification?: string | null
}
export function addEvaluation(
  tx: DbExecutor, roundId: string, responseId: string, projectMemberId: string,
  opts?: { submittedAt?: string; cells?: CellFixture[] },
): Promise<string>
export function addScore(
  tx: DbExecutor, evaluationId: string, definitionId: string, criterionId: string,
  opts?: { value?: 'high' | 'medium' | 'low'; justification?: string | null },
): Promise<string>
```

**Uma peça a mais do que o plano previa:** o § 1.5 pedia "contar as avaliações do vínculo" em dois
call sites (`evaluatorRoleView` e `members/page.tsx`). Em vez de duplicar a query, ela virou
`countSubmittedEvaluations` em `lib/authz.ts`. Ela **não** filtra por `status='active'`: a recusa de
revogação da ADR 0008 tem que enxergar avaliação enviada por vínculo já inativo, e `evaluatorLinkOf`
casa o vínculo de avaliador em qualquer status. `evaluatorMembershipId`, ao contrário, exige ativo —
é ela que a Parte 2 usa para derivar o `project_member_id` do envio.

`evaluatorLinkOf(memberships, submittedEvaluations)` agora **exige** o segundo parâmetro: a constante
`SUBMITTED_EVALUATIONS_UNTIL_EPICO_2` foi removida junto do default.

**`cleanup` (test/helpers.ts)** apaga `evaluations` das rodadas dos projetos **antes** de `responses`
(a FK `evaluations.response_id` é restrict) e antes de `projects`. `scores` some por cascade.

Testes da Parte 1: `lib/authz.int.test.ts` (+3 casos) e o arquivo novo
`lib/db/evaluations.int.test.ts` (8 casos de schema). `npm run lint`, `npm run typecheck` e
`npm test` (530 testes) verdes.

---

# Parte 2 — Servidor da avaliação

**Objetivo:** toda a regra e toda a autorização, testadas por action, sem nenhuma tela. É o coração
da issue: os AC de recusa, imutabilidade e chave por definição vivem aqui.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, o "o que a Parte 2 herda" da Parte 1,
`app/onboarding/actions.ts` (prior art da action), `app/projects/[id]/pipeline/criteria.ts` e
`(tabs)/rounds/actions.int.test.ts` (molde do teste).

Arquivos novos, todos em `app/projects/[id]/(tabs)/evaluate/`.

### 2.1 `scale.ts` — módulo puro da escala

```ts
export const SCALE = ['high', 'medium', 'low'] as const
export type ScaleValue = (typeof SCALE)[number]
export function isScaleValue(v: unknown): v is ScaleValue
export function scaleLabel(v: ScaleValue): string   // Alto / Médio / Baixo
export function scaleTone(v: ScaleValue): 'success' | 'warning' | 'danger'
```

Os três tons já existem como tokens em `app/globals.css`, então "cor distinta para cada um" sai sem
CSS novo. A ordem do array é a ordem ordinal, e o módulo de cálculo da #62 vai consumir daqui — por
isso ele nasce separado da tela.

### 2.2 `completeness.ts` — funções puras

```ts
export type CellKey = { definitionId: string; criterionId: string }
export type Answer = { definitionId: string; criterionId: string; value: string; justification: string }

/** Definições que ainda têm alguma célula sem nota, na ordem do codebook. */
export function definitionsIncomplete<D extends { id: string; title: string }>(cells, answers): D[]
export function isComplete(cells, answers): boolean
export function incompleteMessage(titles: readonly string[]): string
```

O mesmo par serve à interface (desabilitar o botão e apontar o que falta) e ao servidor (recusar com
a mesma mensagem). Escrever a regra duas vezes com resultados diferentes é o que o spec proíbe. A
redação segue `missingCriteriaMessage` de `pipeline/criteria.ts`.

### 2.3 `access.ts` — `requireEvaluator(projectId, userId)`

Espelha `pipeline/access.ts`:

- projeto inexistente → `notFound()`
- vínculo de avaliador em `pending_onboarding` → `redirect('/projects/:id/onboarding')`
- sem vínculo de avaliador ativo → `notFound()` (inclusive para o Administrador sem o segundo
  vínculo — é o AC "quem não tem vínculo de avaliador no projeto é recusado")

### 2.4 `evaluation.ts` — loaders

- `loadEvaluationOf(responseId, memberId, db?)` → avaliação + notas, ou `null`;
- `loadEvaluatedResponseIds(roundId, memberId, db?)` → ids já avaliados por aquele vínculo (a Parte 3
  usa para escolher a resposta corrente; a #61 usa para o progresso).

### 2.5 `actions.ts` — `submitEvaluation`

Estado `{ error } | { ok: true; nonce: number } | null` (padrão `useActionState` do repo).

```
userId ← requireUserId()
projectId, responseId ← formData
memberId ← evaluatorMembershipId(userId, projectId)        // null → recusa
transaction:
  response ← join responses/rounds  where response.id = ? and round.project_id = ?
    ausente        → recusa
    rodada fechada → recusa
  já existe evaluation (response_id, member_id) → recusa (segundo envio)
  codebook ← loadCodebookVersion(projectId, round.codebookVersionId, tx)
  cells ← resolveCells(codebook.definitions, codebook.criteria)
  para cada cell: lê score_/justification_ do formData, valida escala e tamanho
  incompleto → recusa com incompleteMessage(...)
  insert evaluation (round_id, response_id, project_member_id)
  insert scores (todas as células, de uma vez)
catch 23505 → recusa de segundo envio (corrida)
revalidatePath('/projects/:id/evaluate')
```

Nada é gravado antes de todas as células passarem — envio incompleto não deixa rastro, do mesmo jeito
que onboarding incompleto não grava resposta.

### Testes da Parte 2

`evaluate/actions.int.test.ts`, molde `(tabs)/rounds/actions.int.test.ts` (sessão por
`supabaseServerMock`, fixtures por `ownerDb`, `cleanup` no fim):

- [ ] envio incompleto é recusado, a mensagem nomeia a definição incompleta, e **nada** é gravado;
- [ ] envio completo grava a avaliação com rodada, resposta, vínculo e data, e uma nota por célula,
      com a chave `(avaliação, definição, critério)`;
- [ ] **critério geral gera uma nota em cada definição**, e as duas coexistem sem violar unicidade —
      o teste que a emenda da ADR 0009 existe para justificar;
- [ ] segundo envio da mesma resposta pelo mesmo vínculo é recusado, e o primeiro continua intacto;
- [ ] vínculo de avaliador de **outro projeto** é recusado;
- [ ] Administrador **sem** vínculo de avaliador é recusado;
- [ ] Administrador **com** vínculo de avaliador grava apontando para o vínculo de avaliador, e não
      para o de administrador (verificar o `role` da linha apontada) — história 36;
- [ ] avaliação em rodada **fechada** é recusada;
- [ ] justificativa acima de `JUSTIFICATION_MAX` é recusada; justificativa vazia grava `null`;
- [ ] valor fora da escala é recusado;
- [ ] o `round_id` gravado na avaliação bate com o `round_id` da resposta.

Unitários: `completeness.unit.test.ts` (completa/incompleta, ordem das definições, mensagem no
singular e no plural) e `scale.unit.test.ts` (`isScaleValue` recusa lixo, rótulos, tons, ordem
ordinal).

### Pronto quando

Os três gates verdes e todos os AC de regra da issue provados por teste, ainda sem tela.

### O que a Parte 3 herda

**O contrato de encoding da § 4 não mudou**, e agora tem um dono: `cellKey` monta a chave
(`<definitionId>_<criterionId>`) que o servidor lê e que o formulário tem que produzir — usar a
função nos dois lados, em vez de repetir o template. Os campos continuam `score_<chave>` e
`justification_<chave>`, mais os ocultos `project_id` e `response_id`. Justificativa é `.trim()`ada:
só espaço grava `null`.

Assinaturas reais (tudo em `app/projects/[id]/(tabs)/evaluate/`):

```ts
// scale.ts
export const SCALE = ['high', 'medium', 'low'] as const
export type ScaleValue = (typeof SCALE)[number]
export type ScaleTone = 'success' | 'warning' | 'danger'
export function isScaleValue(value: unknown): value is ScaleValue
export function scaleLabel(value: ScaleValue): string        // Alto / Médio / Baixo
export function scaleTone(value: ScaleValue): ScaleTone      // success / warning / danger

// completeness.ts
export type CellKey = { definitionId: string; criterionId: string }
export type Cell<D> = { definition: D; criterion: { id: string } }
export type Answer = {
  definitionId: string; criterionId: string; value: string; justification: string
}
export function cellKey(cell: CellKey): string
export function definitionsIncomplete<D extends { id: string; title: string }>(
  cells: readonly Cell<D>[], answers: readonly Answer[],
): D[]
export function isComplete<D extends { id: string }>(
  cells: readonly Cell<D>[], answers: readonly Answer[],
): boolean
export function incompleteMessage(titles: readonly string[]): string

// access.ts
export type EvaluatorProject = { id: string; name: string; phase: number; taskType: string | null }
export type EvaluatorAccess = { project: EvaluatorProject; memberId: string }
export function requireEvaluator(
  projectId: string, userId: string, db: DbExecutor = ownerDb,
): Promise<EvaluatorAccess>

// evaluation.ts
export type EvaluationScore = {
  definitionId: string; criterionId: string; value: string; justification: string | null
}
export type SubmittedEvaluation = {
  id: string; roundId: string; responseId: string; submittedAt: string
  scores: EvaluationScore[]
}
export function loadEvaluationOf(
  responseId: string, memberId: string, db?: DbExecutor,
): Promise<SubmittedEvaluation | null>
export function loadEvaluatedResponseIds(
  roundId: string, memberId: string, db?: DbExecutor,
): Promise<string[]>

// actions.ts
export type EvaluationState = { error: string } | { ok: true; nonce: number } | null
export function submitEvaluation(
  _prev: EvaluationState, formData: FormData,
): Promise<EvaluationState>
```

**Três coisas que divergiram do plano, todas para menos acoplamento:**

1. `Cell<D>` em vez de consumir `CodebookCell` direto. O tipo pede só `{ definition, criterion: { id } }`,
   então a saída de `resolveCells` entra sem cast e as funções puras não dependem do codebook.
2. `cellKey` não estava na lista da § 2.2, mas é o que impede a Parte 3 de divergir do servidor.
3. `requireEvaluator` devolve `{ project, memberId }`, e não só o projeto: a página precisa do vínculo
   para `loadEvaluationOf`/`loadEvaluatedResponseIds`, e derivá-lo duas vezes seria a mesma query repetida.

`definitionsIncomplete` só conta como nota dada um valor que passa por `isScaleValue` — justificativa
preenchida sem nota continua incompleta, e lixo no campo de nota não "completa" a definição.

**Ordem de recusa dentro da action** (a primeira que bate ganha): sessão → vínculo de avaliador ativo
→ resposta existe e é da rodada daquele projeto → rodada aberta → já enviada → codebook legível →
justificativa longa / valor fora da escala (por célula, na ordem do codebook) → incompleto. Nada é
gravado antes de todas as células passarem.

Texto exato das recusas:

| Situação | Mensagem |
|---|---|
| `project_id`/`response_id` ausente ou não-uuid | `Avaliação inválida.` |
| sem vínculo de avaliador ativo (inclui o Administrador sem o segundo vínculo e o avaliador de outro projeto) | `Não foi possível enviar a avaliação. Apenas quem tem vínculo de avaliador ativo neste projeto pode avaliar.` |
| resposta inexistente ou de outro projeto | `Esta resposta não existe mais nesta rodada. Recarregue a página para ver a lista atual.` |
| rodada fechada | `A rodada N já foi fechada, e rodada fechada não recebe mais avaliação. Aguarde a próxima rodada para avaliar.` |
| segundo envio (checagem explícita **e** backstop do `23505`) | `Você já enviou a avaliação desta resposta, e o envio é definitivo. Recarregue a página para vê-la.` |
| versão de codebook ilegível | `Não foi possível ler a versão de codebook que esta rodada fixou. Recarregue a página.` |
| valor fora da escala | `Uma das notas está fora da escala. Recarregue a página e dê as notas de novo.` |
| justificativa longa | `Uma das justificativas passa do limite de 2000 caracteres.` |
| incompleto | `incompleteMessage(...)` — singular: `A definição “X” ainda tem critério sem nota. Dê uma nota em cada critério dela para enviar a avaliação.`; plural: `As definições “X”, “Y” e “Z” ainda têm critério sem nota. ... delas ...` |

No sucesso: `revalidatePath('/projects/:id/evaluate')` e `{ ok: true, nonce }` — é desse `nonce` que a
Parte 3 tem que **derivar** a volta para o modo leitura (o eslint proíbe `setState` em `useEffect`).

Testes da Parte 2: `scale.unit.test.ts` (5), `completeness.unit.test.ts` (10),
`actions.int.test.ts` (15) e `access.int.test.ts` (7 — não previsto no plano, mas `requireEvaluator`
é entrega desta Parte e ficaria sem cobertura até a Parte 3). `npm run lint`, `npm run typecheck` e
`npm test` (567 testes) verdes. Nenhuma tela mudou, nenhuma migration nova.

---

# Parte 3 — Tela do avaliador e navegação

**Objetivo:** o Avaliador consegue abrir, preencher, enviar e ver travado. É a Parte de interface, e
a única que o usuário enxerga.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, o "o que a Parte 3 herda" da Parte 2,
`(tabs)/rounds/generate-responses.tsx` e `close-round.tsx` (padrão de client component com
`useActionState`), `(tabs)/rounds/page.int.test.ts` (molde do teste de página) e os componentes de
`app/components/ui/` (`Disclosure`, `InfoTooltip`, `Section`, `EmptyState`, `Button`, `Field`).

### 3.1 `evaluate/page.tsx`

1. `requireEvaluator(...)`;
2. resolve a rodada aberta (`loadOpenRound`);
3. carrega as respostas da rodada (`listRoundResponses`) e os ids já avaliados por aquele vínculo;
4. escolhe a resposta corrente: `?response=<id>` se válida e da rodada, senão a primeira não
   avaliada, senão a primeira;
5. carrega o codebook **da versão que a rodada congelou** (`loadCodebookVersion` com
   `round.codebookVersionId`) e monta as células com `resolveCells`;
6. se já existe avaliação daquele vínculo para aquela resposta, renderiza em leitura; senão,
   o formulário.

Os estados de espera ganham um `EmptyState` genérico — os quatro textos específicos são da #61.

### 3.2 `evaluate/evaluation-form.tsx` (cliente)

- agrupa por definição, na ordem do codebook, com os gerais **dentro** de cada definição, junto dos
  específicos — vem de graça de `criteriaOfDefinition`, que já ordena "próprios, depois gerais";
- `<InfoTooltip>` ao lado do título da definição e do nome do critério quando há descrição;
- três botões por critério (`success` / `warning` / `danger`), estado em `useState`, trocável até o
  envio;
- textarea opcional por critério, respeitando `JUSTIFICATION_MAX`;
- botão de enviar desabilitado enquanto `isComplete` for falso, **com** a lista das definições que
  ainda têm célula sem nota ao lado — o NFR é explícito: "todo bloqueio informa o que falta, em vez
  de apenas desabilitar o controle";
- depois do envio, os botões somem e os textos viram leitura. Sem ação de editar e sem ação de apagar
  em lugar nenhum da tela.

A definição pode expandir e recolher com o `<Disclosure>` existente.

⚠️ Herança da Parte 2 do redesenho de telas: o eslint do repo (`react-hooks/set-state-in-effect`)
proíbe `setState` dentro de `useEffect`. A volta para o modo leitura depois do envio precisa ser
**derivada** do `{ ok, nonce }` da action, como em `CodebookEditor`, e não escrita por efeito.

### 3.3 Navegação: a aba do avaliador

Hoje `project-tabs.tsx` mostra "Rodadas" desabilitada com o hint "Ainda não implementado" para quem
não é administrador.

- `(tabs)/layout.tsx`: calcular `isEvaluator` (vínculo de avaliador **ativo**) junto de `isAdmin` e
  passar para `<ProjectTabs>`;
- `project-tabs.tsx`: quando `isEvaluator`, aba "Avaliar" apontando para `/projects/:id/evaluate`. O
  Administrador-avaliador vê as duas abas, Rodadas e Avaliar, que é o desenho da história 36;
- `activeTab` ganha o caso `evaluate`, e `project-tabs.unit.test.ts` o caso correspondente.

### Testes da Parte 3

`evaluate/page.int.test.ts`, molde `(tabs)/rounds/page.int.test.ts`:

- [ ] avaliador ativo vê o formulário com as células agrupadas por definição, com os gerais dentro de
      cada uma;
- [ ] Administrador sem vínculo de avaliador leva `notFound`;
- [ ] quem não é membro leva `notFound`;
- [ ] avaliador em `pending_onboarding` é redirecionado para o onboarding;
- [ ] resposta já avaliada aparece em leitura, sem botões de nota e sem ação de editar ou apagar;
- [ ] nenhuma tela do avaliador exibe coeficiente (vale já, e vira regressão para a #62).

⚠️ Herança da Parte 3 do redesenho: `collectText` do teste de página só anda pelos **children** —
texto que vira prop (o `text` do `InfoTooltip`, por exemplo) some das asserções; ler a prop via
`findElement`. Para afirmar "zero campos" existe o caminho do `renderToStaticMarkup`.

### Pronto quando

Os três gates verdes, os AC da issue marcados e a tela conferida no app real. Para conferir logado,
usar o preview/navegador real: o Playwright headless não hidrata.

---

## 5. Riscos e pontas soltas

**O `restrict` do vínculo é a decisão de maior alcance.** Ele protege dado de pesquisa, e em troca
qualquer caminho que apague `project_members` passa a poder falhar. Hoje só existe um,
`revokeEvaluatorRole`, coberto na Parte 1. `removeMember` já desativa em vez de apagar, que é o que a
ADR 0009 pede.

**Uma decisão em aberto, de produto.** A rota mínima precisa escolher *qual* resposta mostrar, e a
regra definitiva (ordem embaralhada, avanço automático) é da #61. A proposta é `?response=<id>`
validado contra a rodada, com fallback na primeira não avaliada. **Recomendo essa versão, com uma
resposta por vez**, porque é a forma final e evita construir uma tela que a fatia seguinte joga fora.

**Adjacente, recomendado mas não obrigatório:** `listEvaluatorsNotFinished`
(`(tabs)/rounds/rounds.ts`) hoje devolve *todos* os avaliadores ativos, porque não havia como saber
quem terminou. Com as duas tabelas no lugar, pode passar a excluir quem já avaliou tudo da rodada,
cumprindo de verdade o AC da #57. Se entrar, entra na Parte 3; se não, vira issue própria.

**Documentação de domínio:** nada a escrever. O glossário já tem Avaliação, Nota, Escala, Rodada
aberta e Rodada fechada; a ADR 0009 já tem a emenda da chave por definição e a ADR 0010 já registra a
escala fixa. Continua valendo a pendência geral de que `docs/adr/` está no gitignore.

**Deploy:** a migration da Parte 1 precisa de `db push` em prod junto do deploy, senão o schema de
produção fica para trás — já aconteceu duas vezes neste projeto.
