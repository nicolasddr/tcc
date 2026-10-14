# Plano 1 — Fundação: o tipo do critério no banco e no domínio

Série "Critério por Resposta", plano 1 de 4. Spec: `~/Desktop/spec-criterio-por-resposta-v2.md`
(fora do repo; seções 1 a 5 e 10 são o contexto comum, a 6.1 é a origem deste plano). Escrito em
2026-10-13 contra o `main` em `907184d`.

**Objetivo:** o tipo do critério existe no banco, o banco garante a coerência nota ↔ tipo (R15), e o
código passa a decidir "geral" pelo tipo, e não por `definition_id` nulo. **Nenhuma mudança visível**:
nenhuma tela cria critério por resposta, e todo dado existente continua com o significado de hoje.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Migration (tipo, nota sem definição, R15), gravação do tipo, fixtures, testes das restrições, ADR e glossário | `feat(banco): tipo do critério e nota sem definição` | |
| 2 | O domínio lê o tipo: `criteria.ts`, loader, `cellExists`, editor e os que montam `CriterionScope` | `refactor(codebook): critério geral lido pelo tipo` | |

**Duas decisões ⚠** (D1 e D2), as duas antes da Parte 1. Perguntar as duas de uma vez antes de
editar código, mesmo que o pedido seja só "implemente a Parte 1".

Sem issue no GitHub: os commits não levam `Refs`/`Closes`.

---

## 1. Ponto de partida

| Peça | Onde | Nesta série |
|---|---|---|
| Tabelas | `lib/db/schema.ts`: `codebookCriteria` (~273), `scores` (~472), `consensusNotes` (~538) | Parte 1 |
| Migrations | `supabase/migrations/0000`–`0016`; `drizzle.config.ts` (fluxo: `schema.ts` → `drizzle-kit generate` → conferir SQL → `supabase db reset`) | Parte 1 gera a `0017` |
| Gravação de critérios | `pipeline/actions.ts`: `parseCriteria` (~108, valor de formulário `general` ou índice da definição), `saveCodebook` (~218; `insert(codebookCriteria)` ~349) | Parte 1 grava o tipo; o formulário não muda |
| Domínio | `pipeline/criteria.ts`: `CriterionScope = { definitionId }`, `isGeneral` = `definitionId === null` | Parte 2 |
| Loader | `pipeline/codebook.ts`: `CodebookCriterion`, `loadCriteria` | Parte 2 seleciona o tipo |
| Fixtures | `test/helpers.ts`: `addCodebookVersion` (já aceita `generalCriteria`), `CellFixture`, `addScore`, `addConsensusNote` (`definitionId: string`) | Parte 1 |
| Testes de schema | `lib/db/evaluations.int.test.ts` (modelo: `scenario`, `pgErrorCode`) | modelo do arquivo novo |

Caminhos curtos são relativos a `app/projects/[id]/`.

---

## 2. O que a revisão da spec achou (vale para a série)

Achados desta revisão contra o código, além dos da seção 4 da spec. Os marcados com **→ Plano N**
mudam o trabalho de outro plano e estão repetidos no handoff (§ 6.6) e na spec (seção 4, itens 9,
11 e 13 a 20).

1. **Fixtures (item 11 da spec) já criam critério geral.** `addCodebookVersion` tem
   `generalCriteria` desde a #60. O que falta é o critério por resposta, o `scope` em todo insert e
   a definição nula em `CellFixture`/`addScore`/`addConsensusNote`.
2. **R14 muda o tipo inferido pelo Drizzle em cinco leitores.** Com `scores.definition_id` e
   `consensus_notes.definition_id` anuláveis, `select({ definitionId: scores.definitionId })` passa a
   ser `string | null`, e o `typecheck` quebra já na Parte 1 em: `(tabs)/evaluate/evaluation.ts`
   (`loadEvaluationOf`), `(tabs)/rounds/agreement.ts` (`loadRoundObservations`,
   `loadProjectObservations`), `(tabs)/rounds/review.ts` (`loadResponseNotes`) e
   `(tabs)/rounds/consensus.ts` (`NOTE_COLUMNS`). Decisão D3. **→ Planos 2 e 3** removem cada filtro
   ao tratar a célula por resposta.
3. **O `drizzle-kit generate` produz uma migration que não aplica com dados**, por dois motivos:
   `ADD COLUMN "scope" text NOT NULL` sem preenchimento (falha com *contains null values*) e a FK
   composta antes do `UNIQUE` que ela exige (o 42830 da #66). Os dois foram reproduzidos; o SQL
   corrigido está em § 5.1 e foi aplicado com sucesso sobre `0000`–`0016` com dados antigos.
4. **O editor lê "geral" por `definitionId === null` direto** (`codebook-editor.tsx` ~438, o estado
   inicial dos gerais), fora de `isGeneral`; a busca por `isGeneral` não o acha. Entra na Parte 2.
5. **`notesPerResponseFormula` conta "específico" como `criteria.length - general`**: um critério por
   resposta viraria "específico" na fórmula. Parte 2 conta pelo tipo (D5); **→ Plano 2** acrescenta o
   termo "por resposta" (R3).
6. **`cellExists` (`consensus-actions.ts`) seleciona só `definitionId` do critério.** Para
   `isGeneral` ler o tipo, a consulta precisa trazer `scope`: entra na Parte 2, com teste (é a prova
   de integração de que o domínio deixou de tratar o critério por resposta como geral).
7. **Upsert da anotação com definição nula funciona** (item 9 da spec): `ON CONFLICT (response_id,
   definition_id, criterion_id, project_member_id) DO UPDATE` com `UNIQUE NULLS NOT DISTINCT`
   atualiza a linha existente. Conferido num Postgres 18 descartável (o comportamento é o mesmo desde
   o 15). **→ Plano 3** só precisa do teste.
8. **Até o Plano 4, salvar o codebook descarta um critério por resposta montado à mão**: o editor não
   o carrega em nenhum bloco, e `saveCodebook` regrava os critérios a partir do formulário. **→
   Planos 2 e 3**: na cena de conferência, não salvar o codebook.
9. **Um teste antigo escreve critério sem tipo**: `pipeline/actions.int.test.ts` › "o banco recusa o
   nome de critério acima do limite, mesmo por escrita direta" (~2933) daria 23502 em vez de 23514.
   Recebe `scope: 'general'` na Parte 1.

---

## 3. Decisões

**D1 ⚠ (spec 7.2). Como o banco distingue os tipos.** Coluna `scope text NOT NULL` em
`codebook_criteria`, com:

- `cc_scope_check`: `scope = ANY (ARRAY['specific', 'general', 'per_response'])`;
- `cc_scope_definition`: `(scope = 'specific') = (definition_id IS NOT NULL)`;
- preenchida pela migration: `definition_id` nulo → `general`, preenchido → `specific` (R13).

O nome `scope` casa com o campo de formulário `criterion_scope`, que já existe, e não colide com
`codebook_definitions.type` (categoria, dimensão, diretriz). Recomendação: aceitar.

**D2 ⚠ (spec 7.3). Como o banco garante R15.** Três opções:

- **(a) da spec, cópia do tipo**: `scores` e `consensus_notes` ganham uma coluna com o tipo do
  critério, FK composta `(criterion_id, tipo)` e CHECK `(definition_id IS NULL) = (tipo =
  'per_response')`. Todo escritor passa a mandar a cópia: `submitEvaluation`, `saveConsensusNote`,
  `addScore`, `addEvaluation`, `addConsensusNote` e os inserts diretos dos testes.
- **(a′) recomendada, coluna gerada**: o mesmo desenho, mas o banco deriva a coluna sozinho.
  - `codebook_criteria.per_response boolean GENERATED ALWAYS AS (scope = 'per_response') STORED` e
    `UNIQUE (id, per_response)` (`cc_unique_id_per_response`);
  - `scores.per_response` e `consensus_notes.per_response`, `GENERATED ALWAYS AS (definition_id IS
    NULL) STORED`;
  - a FK `(criterion_id, per_response) → codebook_criteria (id, per_response)` **substitui** a FK
    simples de `criterion_id` nas duas tabelas (`scores_criterion_scope_fkey`,
    `consensus_notes_criterion_scope_fkey`, `ON DELETE restrict`, como as de hoje).

  Nota sem definição só casa com critério por resposta; nota com definição só casa com específico ou
  geral. **Nenhum escritor muda**: o Drizzle não manda coluna gerada no insert, e o Postgres recusa
  quem tentar (`cannot insert a non-DEFAULT value`). Conferido num Postgres descartável: as quatro
  recusas de R15 dão 23503, a duplicata com definição nula dá 23505, e mudar o tipo de um critério
  que já tem nota é barrado pela FK.
- **(b) só na action**: deixa o banco aceitar nota sem definição em critério geral. Contraria a ADR
  0010 ("não pode entrar errado nem por caminho de teste").

Recomendação: **(a′)**. Mesma garantia de (a), sem dado duplicado nem mudança nos escritores.

**D3. Leitores de nota até os Planos 2 e 3: ignoram a linha sem definição.** Consequência obrigatória
de R14 (achado 2). Duas saídas: alargar os tipos para `string | null` agora (é o trabalho dos Planos
2 e 3, com chaves de célula e `unitId`), ou descartar a linha sem definição em cada leitor, com o tipo
estreitado. Escolhida a segunda: até o Plano 2 nenhuma nota assim existe, então o comportamento não
muda; e o `.flatMap` com guarda é o idioma que esses leitores já usam (`isScaleValue`,
`isConsensusVisibility`). Cada leitor fica com um descarte explícito, que o plano dele remove.

**D4. Nomes no domínio** (`pipeline/criteria.ts`, Parte 2):

```ts
export type Scope = 'specific' | 'general' | 'per_response'

export type CriterionScope = { definitionId: string | null; scope: Scope }

export function isScope(value: string): value is Scope
export function isGeneral(criterion: CriterionScope): boolean
export function isPerResponse(criterion: CriterionScope): boolean
export function perResponseCriteria<C extends CriterionScope>(criteria: readonly C[]): C[]
```

`scope` obrigatório em `CriterionScope`, de propósito: é o `tsc` que aponta todo lugar que monta
critério sem dizer o tipo (é assim que o achado 4 apareceria se não tivesse sido achado lendo).
`ownCriteria` continua comparando `definitionId` (com o CHECK de D1, só específico tem definição).

**D5. R4 (spec 7.4): critério por resposta não cobre definição.** `definitionsWithoutCriteria` e
`isCodebookComplete` só contam específico e geral; `missingCriteriaMessage` não muda. E
`notesPerResponseFormula` passa a contar específico pelo tipo, para o critério por resposta não
entrar como "específico" (achado 5). `notesPerResponse` continua sendo `resolveCells(...).length` e,
como `resolveCells` ainda não gera a célula por resposta, não conta o critério por resposta até o
Plano 2.

**D6. Migration.** `npx drizzle-kit generate` (nome aleatório, como as anteriores) e **duas edições à
mão** no SQL gerado (§ 5.1). O snapshot em `supabase/migrations/meta` fica como o gerador o escreveu.

---

## 4. Gotchas

- **Docker Desktop antes de tudo** (`supabase start`/`db reset` dependem dele).
- **`scores` inteira vazia antes do `npm test`** (`evaluate/actions.int.test.ts` afirma isso).
- **TDD**: ler a **mensagem** de cada vermelho. Nesta Parte 1 muitos vermelhos saem pelo código de
  erro errado (23502 ou "não lançou" em vez de 23503); isso vale como vermelho de asserção se a
  mensagem for essa. Asserções depois da primeira falha não rodaram: `it` separados por recusa.
- **Sem comentários novos no código; sem `npx prettier`.**
- **`npm run typecheck` depois da última edição de teste** (o Vitest não confere tipos).
- **`db push` em produção é do usuário** (o modo automático bloqueia `db push --linked`).
- **Desfazer mutação por `cp`/`sed` inverso, nunca `git checkout`.**

---

## 5. Parte 1 — Banco e gravação do tipo

**Antes de começar:** perguntar D1 e D2. Este texto assume D1 como está e D2 = (a′); com (a), os
passos 1.3 e 1.5 ganham a cópia do tipo em cada escritor e os testes de 1.2 mandam o tipo.

**Ler antes:** `lib/db/schema.ts` (as três tabelas), `lib/db/evaluations.int.test.ts` até o
`describe`, `test/helpers.ts` (`addCodebookVersion` a `addConsensusNote`), `pipeline/actions.ts`
(`parseCriteria` e `saveCodebook`), a memória do 42830 (`drizzle-migration-ordem-das-instrucoes`).

### 5.1 O SQL da migration

O gerado sai nesta ordem: `DROP` das duas `UNIQUE` e das duas FKs simples, `DROP NOT NULL`, os
`ADD COLUMN`, as FKs compostas, **depois** o `UNIQUE (id, per_response)`, as `UNIQUE NULLS NOT
DISTINCT` e as CHECK. Duas edições:

1. **Preenchimento**: trocar `ADD COLUMN "scope" text NOT NULL` por três instruções:

   ```sql
   ALTER TABLE "codebook_criteria" ADD COLUMN "scope" text;
   UPDATE "codebook_criteria" SET "scope" = CASE WHEN "definition_id" IS NULL THEN 'general' ELSE 'specific' END;
   ALTER TABLE "codebook_criteria" ALTER COLUMN "scope" SET NOT NULL;
   ```

2. **Ordem**: mover o `ADD COLUMN "per_response"` de `codebook_criteria` e o `ADD CONSTRAINT
   "cc_unique_id_per_response" UNIQUE("id","per_response")` para logo depois do preenchimento,
   **antes** de qualquer FK composta.

Manter os `--> statement-breakpoint` entre as instruções. Conferir também que o gerado não traz
`ALTER` em tabela que ninguém pediu.

### 5.2 Fixtures — `test/helpers.ts`

- `addCodebookVersion`: opção `perResponseCriteria?: CriterionFixture[]`; todo critério inserido leva
  `scope` (`specific` nos das definições, `general` nos gerais, `per_response` nos novos, com
  `definitionId: null`).
- `CellFixture.definitionId`, `addScore(…, definitionId, …)` e `addConsensusNote({ definitionId })`
  aceitam `string | null`.

### 5.3 Testes das restrições (TDD, integração) — `lib/db/criterion-scope.int.test.ts` (novo)

Cenário no molde de `evaluations.int.test.ts`: duas definições, um específico na primeira, um geral,
um por resposta; rodada, resposta, avaliação e vínculo. Um `it` por caso:

- [ ] **Tipo dos critérios**: os três inseridos pelo helper voltam com `scope` `specific`, `general`
      e `per_response`.
- [ ] `cc_scope_definition`: critério `general` com definição → 23514; `specific` sem definição →
      23514; `per_response` com definição → 23514.
- [ ] `cc_scope_check`: `scope` fora dos três → 23514.
- [ ] **Nota por resposta aceita**: definição nula + critério por resposta grava.
- [ ] **R15 em `scores`**: definição nula + critério geral → 23503; definição nula + específico →
      23503; com definição + critério por resposta → 23503.
- [ ] **R14 em `scores`**: segunda nota com definição nula no mesmo critério e avaliação → 23505.
- [ ] **R16 em `consensus_notes`**: as três recusas de R15 (23503) e a duplicata com definição nula
      do mesmo autor (23505).
- [ ] **Tipo preso à nota**: `update codebook_criteria set scope = 'general', definition_id = null`
      num critério por resposta que já tem nota → 23503.

Rodar antes da migration e ler as mensagens: sem a coluna, os inserts com `scope` devem passar (o
Drizzle monta o insert pelas colunas da tabela; confirmar na primeira corrida) e as recusas saem como "não lançou" ou 23502. Anotar quais
asserções rodaram.

### 5.4 Schema e migration

- `lib/db/schema.ts`: D1 e D2 nas três tabelas; `scores.definitionId` e
  `consensusNotes.definitionId` sem `.notNull()`; `unique(...).nullsNotDistinct()` em
  `sc_unique_cell` e `cn_unique_cell_author`; as FKs compostas no lugar das simples de
  `criterion_id`; as colunas geradas com `boolean("per_response").generatedAlwaysAs(sql\`…\`).notNull()`.
- `npx drizzle-kit generate`, as edições de § 5.1, `npx supabase db reset`.

### 5.5 Gravação do tipo — `pipeline/actions.ts` (TDD, integração)

- [ ] Em `pipeline/actions.int.test.ts`: salvar um codebook com um critério próprio e um geral grava
      `scope` `specific` e `general` (ler `codebookCriteria.scope` direto).

Depois: o `insert(codebookCriteria)` de `saveCodebook` manda `scope` a partir de `definitionIndex`.
`parseCriteria` não muda (o novo valor de formulário é do Plano 4).

E o teste antigo do achado 9 ganha `scope: 'general'`.

### 5.6 Leitores (D3)

Nos cinco leitores do achado 2, descartar a linha com `definitionId === null` no `.flatMap`/filtro
que já existe (ou num novo, no mesmo idioma), estreitando o tipo para `string`. Sem teste novo: não há
como criar a linha pela ferramenta, e o Plano 2/3 de cada leitor troca o descarte pelo tratamento.
Listar no handoff qual leitor ficou com descarte.

### 5.7 Docs (não entram no commit, exceto o glossário)

- **ADR nova `docs/adr/0013-criterio-por-resposta.md`** (gitignored): o caso do PoC (spec § 2), as
  alternativas A, C1 e C2 e por que não, a escolha C3; a garantia no banco (D1, D2 com o motivo da
  ADR 0010); R4; que o tipo é conteúdo da versão. Usar a skill `domain-modeling`.
- **`docs/CONTEXT.md`, verbete Critério** (tracked, entra no commit): trocar as duas últimas frases
  pelo texto da spec § 3. A frase atual "e não uma vez por resposta" sai.

### 5.8 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -n "statement-breakpoint" supabase/migrations/0017_*.sql | head` mostra o `UNIQUE (id,
  per_response)` antes das FKs compostas.
- Testes antigos editados: só o do achado 9 (e os que o `typecheck` apontar pela definição nula;
  listar no handoff).

### 5.9 Depois do commit: produção

O usuário roda `npx supabase db push --linked --yes`. Depois, conferir prod **pela estrutura**, não
por `migration list` (script node com o `DATABASE_URL` do `.env.local`, só leitura):

- `select scope, definition_id is null, count(*) from codebook_criteria group by 1, 2` → só
  `(specific, false)` e `(general, true)`;
- `pg_constraint` tem `cc_scope_check`, `cc_scope_definition`, `cc_unique_id_per_response`,
  `scores_criterion_scope_fkey`, `consensus_notes_criterion_scope_fkey`, e `sc_unique_cell`/
  `cn_unique_cell_author` com `NULLS NOT DISTINCT` (`pg_get_constraintdef`).

### 5.10 O que a Parte 2 herda

Feita em 2026-10-13, sem commit no momento da escrita.

- **D1 e D2 confirmadas** pelo usuário antes do código: D1 como está, D2 = (a′).
- **Migration**: `supabase/migrations/0017_lively_giant_man.sql`, com as duas edições de § 5.1. O
  gerado bateu com a ordem descrita (o `UNIQUE (id, per_response)` saía na linha 15, depois das FKs);
  o original está fora do repo. Antes do `db reset`, aplicada numa transação com rollback sobre a
  `0016` com um específico e um geral sintéticos: voltaram `specific` e `general`. Snapshot do
  gerador intocado.
- **Nomes finais**: colunas `codebook_criteria.scope`, `codebook_criteria.per_response`,
  `scores.per_response`, `consensus_notes.per_response` (Drizzle: `scope`, `perResponse`);
  constraints `cc_scope_check`, `cc_scope_definition`, `cc_unique_id_per_response`,
  `scores_criterion_scope_fkey`, `consensus_notes_criterion_scope_fkey`, e `sc_unique_cell` /
  `cn_unique_cell_author` com `NULLS NOT DISTINCT`. As FKs simples `scores_criterion_id_fkey` e
  `consensus_notes_criterion_id_fkey` saíram.
- **Gravação**: `saveCodebook` deriva `scope` de `definitionIndex` no `insert` (literal `'general'` /
  `'specific'`, não o `GENERAL_SCOPE`, que é o valor do formulário). O `definitionsWithoutCriteria`
  da mesma action ainda monta o critério sem tipo: é o 6.4.
- **Leitores com descarte (D3)**: `evaluate/evaluation.ts` (`loadEvaluationOf`, novo `.flatMap` no
  retorno), `rounds/agreement.ts` (**um** descarte só, em `toObservation`, que serve aos dois
  loaders; `ScoreRow.definitionId` ficou `string | null`), `rounds/review.ts` (`loadResponseNotes`,
  no `.flatMap` existente) e `rounds/consensus.ts` (`asNotes`, que serve aos dois loaders; o tipo do
  parâmetro aceita `definitionId: string | null`).
- **Testes antigos editados**: só o do achado 9. O `typecheck` não apontou nenhum outro.
- **Testes novos**: `lib/db/criterion-scope.int.test.ts` (15 `it`) e, em
  `pipeline/actions.int.test.ts`, "grava o tipo do critério: específico e geral".
- **Divergências do plano**:
  - Vermelhos antes da migration: 11 asserções rodaram e falharam pela mensagem prevista (“não
    lançou” ou 23502); 4 casos pararam no preparo (o do helper, R14, a duplicata de R16 e o "tipo
    preso"). Provados por mutação depois do verde: helper gravando `general` no por resposta,
    `UNIQUE` sem `NULLS NOT DISTINCT`, e sem `scores_criterion_scope_fkey`. Banco restaurado e
    conferido por `pg_get_constraintdef`.
  - O teste da gravação do tipo só fica vermelho se a gravação falhar (foi o vermelho visto: 23502
    no insert). Gravar o tipo trocado não é mutação possível: `cc_scope_definition` recusa.
  - `db reset` terminou com `LegacyHealthCheckTimeoutError` do contêiner de storage (a pilha
    estava subida só com o banco); a migration aplicou e o contêiner ficou healthy em seguida.

---

## 6. Parte 2 — O domínio lê o tipo

**Ler antes:** `pipeline/criteria.ts` e `criteria.unit.test.ts`, `pipeline/codebook.ts`
(`loadCriteria`), `consensus-actions.ts` (`cellExists`) e o teste "a célula tem que existir de
verdade" (~338 de `consensus-actions.int.test.ts`), `codebook-editor.tsx` (~360–480).

### 6.1 Regras (TDD, unitário) — `pipeline/criteria.unit.test.ts`

As fábricas `criterion(id, definitionId)` ganham o tipo (derivado de `definitionId` nos casos antigos;
parâmetro explícito para o por resposta). `describe` novo, "o critério por resposta":

- [ ] não está em `generalCriteria`, nem em `ownCriteria(d)`, nem em `criteriaOfDefinition(d)` de
      nenhuma definição; está em `perResponseCriteria`;
- [ ] `isGeneral` falso e `isPerResponse` verdadeiro;
- [ ] `resolveCells` não gera célula para ele (até o Plano 2);
- [ ] **R4**: só por resposta → `definitionsWithoutCriteria` devolve todas as definições e
      `isCodebookComplete` é falso; com um geral a mais → completo;
- [ ] **D5**: `notesPerResponseFormula` com 2 definições, 1 geral e 1 por resposta não diz
      "específico";
- [ ] `isScope` aceita os três e recusa `''` e `'geral'`.

Vermelho esperado: o critério por resposta, com `definitionId: null`, cai em `generalCriteria`. Os
casos antigos verdes provam que a troca não mudou o resto.

Depois: D4 e D5 em `criteria.ts`.

### 6.2 Loader (TDD, integração)

- [ ] `loadCodebook` devolve `scope` em cada critério (um de cada tipo, pelo helper). Lugar: perto dos
      testes de `loadCodebook` em `pipeline/actions.int.test.ts`, ou `codebook/page.int.test.ts` se
      for lá que o loader é exercitado; decidir lendo.

Depois: `CodebookCriterion.scope: Scope`; `loadCriteria` seleciona `scope` e descarta com `isScope`
no idioma de `isConsensusVisibility`.

### 6.3 `cellExists` (TDD, integração) — `(tabs)/rounds/consensus-actions.int.test.ts`

- [ ] Anotação numa célula com definição apontando para um critério por resposta → `cell_missing`, e
      nada gravado.

Vermelho esperado: hoje `isGeneral` aceita o critério (definição nula), o insert bate na FK composta
da Parte 1 e a action **lança** 23503 em vez de devolver `cell_missing`. Depois: a consulta seleciona
`scope`.

### 6.4 Quem mais monta `CriterionScope`

O `tsc` aponta; os conhecidos:

- `pipeline/actions.ts` (~266): o `definitionsWithoutCriteria` de `saveCodebook` monta o tipo a partir
  de `definitionIndex`;
- `codebook-editor.tsx`: `definitionScopes` (~360), o `uncovered` (~474) e o estado inicial dos
  gerais (~438) passa a `generalCriteria(criteria)` (achado 4);
- `pipeline/llm-input.ts`: `LlmCriterion` ganha `scope` (os chamadores passam `CodebookCriterion`);
- `(tabs)/rounds/agreement-matrix.ts`: `CriterionKey` herda de `CriterionScope`, sem edição;
- testes com critério literal: `criteria.unit`, `llm-input.unit`, `evaluate/completeness.unit`,
  `evaluate/waiting.unit`, `rounds/agreement-matrix.unit`, `rounds/quality-matrix.unit`,
  `rounds/review-groups.unit`, `rounds/preconditions.unit`. Só acrescentar o tipo; nenhuma asserção
  muda.

### 6.5 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -rn "definitionId === null\|definitionId == null" app --include='*.ts' --include='*.tsx' | grep -v test`
  não acha leitura de "geral" (sobram só os descartes de D3, que são de nota, não de critério).
- Nenhuma tela mudou: `codebook`, `evaluate` e `rounds` iguais (os testes de página verdes bastam;
  sem conferência no navegador, porque não há o que ver).
- Testes antigos editados: só os de 6.4, sem asserção alterada.

### 6.6 O que o Plano 2 herda

(preencher ao fim da Parte 2; incluir pelo menos:)

- Nomes finais de D4 e onde `GENERAL_SCOPE` de `actions.ts` ficou.
- **Descartes de D3 a remover**: `evaluation.ts` no Plano 2; `agreement.ts` (dois), `review.ts` e
  `consensus.ts` no Plano 3.
- `perResponseCriteria` pronto para `resolveCells` (R9) e para a fórmula (R3).
- Fixtures prontas: `perResponseCriteria` em `addCodebookVersion`; `definitionId: null` em
  `CellFixture`, `addScore` e `addConsensusNote`.
- Upsert com definição nula já conferido (achado 7); o Plano 3 só testa.
- Cena de conferência: não salvar o codebook (achado 8); limpar antes do `npm test`.

---

## 7. Fora deste plano

- Célula por resposta, formulário, completude e envio (Plano 2).
- ICR, matrizes, revisão, consenso (Plano 3).
- Editor, leitura do codebook, entrada da LLM, `parseCriteria` com o valor novo (Plano 4).
- Coerência no banco entre a definição da nota e a definição do critério específico (spec § 4,
  item 10: continua na action).
