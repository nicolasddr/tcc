# Plano de implementação — Issue #70: "31 — Rodada grava a fase, e a Fase 3 envia o codebook completo"

Link: https://github.com/nicolasddr/tcc/issues/70
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 1, 2, 3, 4 e 18)
Blocked by: nenhuma. **É a base do épico**: #71 a #78 leem a fase da rodada ou a composição que
nascem aqui.

**A executar em 4 partes, uma por chat.** As seções 1 a 5 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas cinco seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60 a #68.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A composição pura: Fase 2 byte a byte, Fase 3 com o codebook completo | ☑ |
| 2 | A coluna `rounds.phase`: schema, migration, gravação na criação e leitura | ☑ |
| 3 | A geração monta pela fase e pela versão congelada da rodada | ☑ |
| 4 | A tela: fase na lista, a frase do que foi à LLM e a varredura dos ACs | ☐ |

**Nenhuma ADR nova.** A decisão já está escrita na **emenda de 2026-09-22 da ADR 0002** (a forma do
codebook na Fase 3, a fase da rodada e a entrada enviada) e no glossário (`docs/CONTEXT.md`,
verbetes **Rodada**, **Escala** e **Fase**; a alteração ainda não commitada do glossário já descreve
o que esta fatia implementa). Se algo divergir, emenda-se a ADR, não se improvisa no código.

**Com migration.** A coluna nova em `rounds` exige `db push` em prod no deploy (§ 7). Prod já
atrasou duas vezes por schema não empurrado.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Composição da entrada | `pipeline/llm-input.ts` (`composeLlmInput`, `DEFINITIONS_HEADING`, `ITEM_HEADING`) | **muda de assinatura**: recebe fase e codebook (Parte 1) |
| Testes da composição | `pipeline/llm-input.unit.test.ts` | ganham o texto de hoje fixado byte a byte, antes de qualquer mudança (Parte 1) |
| Recorte de critérios | `pipeline/criteria.ts` (`ownCriteria`, `generalCriteria`) | reaproveitado pela composição da Fase 3, sem mudança |
| Leitura do codebook | `pipeline/codebook.ts` (`loadCodebookVersion`, `CodebookDefinition`, `CodebookCriterion`) | já devolve descrição e critérios em ordem; **não muda** |
| Composição da rodada | `pipeline/responses.ts` (`loadRoundComposition`, `RoundComposition`) | passa a devolver fase, definições e critérios, e não só títulos (Parte 3) |
| Criação da rodada | `(tabs)/rounds/actions.ts` (`createRound`) | já lê `projects.phase` com `FOR UPDATE` na transação que congela; passa a gravá-la (Parte 2) |
| Geração | `(tabs)/rounds/actions.ts` (`generateResponses`, `setUpGeneration`) | compõe pela fase da rodada (Parte 3) |
| Teste de prompt | `pipeline/actions.ts` (`testPrompt`) | só se adapta à assinatura nova, **sem mudar de comportamento** (§ 3, D6) |
| Trava do codebook | `pipeline/actions.ts` (`saveCodebook` + `loadOpenRound` + `codebookLockedMessage`) | não muda; ganha teste na Fase 3 (Parte 3) |
| Leituras de rodada | `(tabs)/rounds/rounds.ts` (`Round`, `OpenRound`, `RoundSummary`, `loadOpenRound`, `listRounds`), `(tabs)/rounds/review.ts` (`ReviewRound`, `loadReviewRound`) | passam a trazer `phase` (Parte 2) |
| Lista de rodadas | `(tabs)/rounds/round-list.tsx` (`RoundList`) | mostra a fase ao lado do número (Parte 4) |
| Painel da rodada aberta | `(tabs)/rounds/page.tsx` (seção "Rodada N aberta") | ganha a frase do que vai à LLM (Parte 4) |
| Tela da rodada | `(tabs)/rounds/[roundId]/page.tsx` | ganha a fase e a frase (Parte 4) |
| Constantes de fase | `pipeline/preconditions.ts` (`PHASE_1`, `PHASE_2`, `PHASE_3`) | usadas como estão |
| Rótulos da escala | `(tabs)/evaluate/scale.ts` (`SCALE`, `scaleLabel`) | usados só no teste que prova que a escala não vai à LLM |
| Helpers de integração | `test/helpers.ts` (`addRound`, `addCodebookVersion`, `createProject(..., { phase })`) | `addRound` ganha `phase` opcional (Parte 2) |
| LLM falsa | `(tabs)/rounds/generate-responses.int.test.ts` (`vi.mock('@/lib/ai')`, `llm.inputs`) | já captura a entrada; é o que os testes da Parte 3 leem |

O que **falta** e esta fatia cria: a coluna de fase na rodada, a composição da Fase 3, a geração
decidida pela rodada, e a fase visível para o Administrador.

---

## 2. A fatia por extenso

### A fase é da rodada, não do projeto

A pergunta "o que vai à LLM" passa a ter um dono só: a rodada. Ela grava `phase` na criação, na mesma
transação que já trava a linha do projeto (`FOR UPDATE`) e congela as versões de codebook e prompt.
Como o avanço de fase trava a mesma linha e exige que não haja rodada aberta, não há corrida: uma
rodada nunca atravessa uma troca de fase.

A geração nunca lê `projects.phase`. Ela lê `rounds.phase` e a versão de codebook congelada pela
rodada. Assim, uma rodada da Fase 2 continua compondo como Fase 2 para sempre, mesmo que alguém a
leia depois do avanço.

A fase **nunca muda** depois da criação. A garantia é de camada de aplicação (nenhum `UPDATE` de
`rounds` escreve `phase`; `closeRound` só toca `status` e `closedAt`), no mesmo desenho do resto do
repositório depois da ADR 0007 reescrita: sem trigger de negócio no banco.

### A entrada da Fase 2 não muda nenhum byte

Com `phase < PHASE_3`, `composeLlmInput` produz exatamente o texto de hoje:

```
{prompt}

Definições:
- {título 1}
- {título 2}

Item de entrada:
{item}
```

Isso vale para as Fases 1 e 2. A prova é um teste com a string literal esperada, escrito **antes**
de mexer na função (Parte 1).

### A entrada da Fase 3

Com `phase >= PHASE_3`:

```
{prompt}

Codebook:

Definição: {título 1}
{descrição 1}
Critérios:
- {nome}: {descrição}
- {nome sem descrição}

Definição: {título 2}
Critérios:
- {nome}: {descrição}

Critérios gerais, que valem para todas as definições:
- {nome}: {descrição}

Item de entrada:
{item}
```

Regras:

- **Ordem do codebook.** Definições na ordem de `orderIndex`; critérios de cada definição na ordem em
  que `loadCodebookVersion` já os devolve. `ownCriteria` e `generalCriteria` preservam a ordem.
- **Definição sem descrição** (`description === null`) aparece só com a linha `Definição: {título}`,
  seguida direto de `Critérios:` — nenhuma linha vazia no lugar. A action de salvar já grava `null`
  para descrição em branco (`description || null` depois do `trim()`), então a composição só testa
  `null`.
- **Definição sem critério específico** (coberta só pelos gerais): sem a linha `Critérios:`.
- **Critério sem descrição**: `- {nome}`, sem os dois-pontos.
- **Critérios gerais** vêm uma vez só, depois de todas as definições, sob cabeçalho próprio. Sem
  critério geral, o bloco não aparece (§ 3, D4).
- **Não vão**: o tipo da definição (`type`) e a escala (Alto, Médio, Baixo), em nenhuma fase.
- **Sem normalização**: prompt, descrições e item entram como estão, como já é hoje com prompt e item.

---

## 3. Decisões desta fatia

Decisões que o issue e o PRD deixam abertas. Cada uma tem uma recomendação; **as marcadas com ⚠
pedem confirmação antes da Parte em que entram.**

**D1 ⚠ — CHECK da coluna: `phase >= 2 AND phase <= 4`.** O PRD diz "CHECK para as fases em que
rodada existe". A recusa de abrir rodada na Fase 4 é da #77, não desta fatia. Com um CHECK `2..3`,
abrir rodada num projeto na Fase 4 antes da #77 estouraria `23514` sem mensagem. Com `2..4` o banco
aceita, e a regra de "Fase 4 ainda não existe" fica onde as regras de domínio moram: na action.

**D2 — Coluna obrigatória e sem `DEFAULT`.** `phase integer NOT NULL`, sem default no `schema.ts`,
para que todo insert tenha de dizer a fase (o TypeScript cobra). A migration faz o backfill com
`ADD COLUMN ... NOT NULL DEFAULT 2` seguido de `ALTER COLUMN ... DROP DEFAULT` — editado à mão sobre
o SQL que o `drizzle-kit generate` emitir (Parte 2).

**D3 ⚠ — O formato exato do bloco da Fase 3** é o do § 2. Os cabeçalhos viram constantes exportadas
de `llm-input.ts` (`CODEBOOK_HEADING`, `DEFINITION_PREFIX`, `OWN_CRITERIA_HEADING`,
`GENERAL_CRITERIA_HEADING`), como `DEFINITIONS_HEADING` e `ITEM_HEADING` já são. A partir da #71 esse
texto passa a ser gravado em cada Resposta, então vale acertar a redação agora.

**D4 — Sem critério geral, sem bloco de gerais.** Um cabeçalho seguido de nada é ruído para a LLM. O
AC "aparecem uma vez só, num bloco com cabeçalho próprio" continua valendo quando há gerais.

**D5 — `phase >= PHASE_3` compõe a Fase 3**, como diz o PRD ("com fase 3 ou maior"). Qualquer valor
abaixo de 3 compõe como hoje, o que cobre o teste de prompt nas Fases 1 e 2.

**D6 — O teste de prompt não muda de comportamento nesta fatia.** Montar pela fase atual do projeto
e mostrar a entrada é a #72. Aqui `testPrompt` só passa a chamar a assinatura nova com
`phase: PHASE_2` fixo e o codebook vigente, e continua mandando só os títulos. A #72 troca o
`PHASE_2` por `project.phase`.

**D7 ⚠ — "Prompt travado com rodada aberta" é o comportamento de hoje, sem trava nova.** O codebook
é recusado por `saveCodebook` com rodada aberta. O prompt **não** é recusado: `savePrompt` com a
versão congelada cria a versão seguinte, que a rodada aberta não usa — a versão que a rodada fixou
não muda. A história 18 diz "como hoje" e "nenhuma trava nova", e o teste pedido pelo issue é só o
do codebook. Recomendação: não acrescentar trava ao prompt, e registrar na Parte 4 que o AC foi lido
assim. Se a leitura esperada for "o prompt também recusa salvar com rodada aberta", é trava nova e
merece fatia própria.

**D8 ⚠ — A fase e a frase aparecem só para o Administrador.** O Avaliador também chega à tela da
rodada (revisão de discordâncias) e tem a sua lista (`EvaluatorRounds`). O PRD diz que para o
Avaliador "nada muda" e que a tela dele não diz que a LLM recebeu o codebook. Recomendação: a lista
do Avaliador fica como está, e na tela da rodada a linha de fase e a frase só renderizam com
`access.isAdmin`.

**D9 — A composição continua pura e sem tipos do banco.** `llm-input.ts` declara os tipos mínimos
que lê (`LlmDefinition`, `LlmCriterion`); `CodebookDefinition` e `CodebookCriterion` encaixam por
estrutura. O módulo `lib/ai` não muda: continua recebendo texto.

---

## 4. Fronteira com as fatias vizinhas

- **#71 (entrada enviada)** grava o `input` que esta fatia compõe. Aqui não se cria coluna em
  `responses`. A #71 herda de `generateResponses` a variável `input` já montada pela fase da rodada.
- **#72 (teste de prompt)** troca o `PHASE_2` fixo de `testPrompt` (D6) pela fase do projeto e mostra
  a entrada.
- **#73 e #74 (Qualidade)** decidem se mostram Qualidade lendo `round.phase`, que a Parte 2 põe em
  `RoundSummary` e `ReviewRound`.
- **#75 (leitura entre rodadas)** usa `rounds.phase` para "a fase mudou" e para a série de ICR.
- **#77 (avanço 3 → 4)** conta rodadas fechadas com `phase = 3`. `countClosedRounds` **não** ganha
  filtro aqui: o avanço da Fase 2 continua contando como hoje. A recusa de rodada na Fase 4 também é
  da #77 (D1).
- **#78 (CSV)** lê `rounds.phase`.

---

## 5. Convenções que valem em todas as Partes

- Sem comentários novos no código; a explicação vai no commit.
- Sem `npx prettier` (não há config no repo).
- Regra de domínio vai na action, no servidor, nunca só na tela.
- Antes de `npm test`, a tabela `scores` precisa estar vazia (limpar cena de conferência, se houver).
- Um commit por Parte, com a suíte verde (`npm run lint`, `npm run typecheck`, `npm test`).

---

# Parte 1 — A composição pura

**Objetivo:** `composeLlmInput` decide pela fase. Nenhuma coluna, nenhuma action de rodada. No fim
da Parte, a Fase 2 está provada byte a byte e a Fase 3 está provada em teste unitário.

**Ler antes:** `AGENTS.md`, as seções 1 a 5, `pipeline/llm-input.ts`, o teste dele,
`pipeline/criteria.ts` e o trecho de `testPrompt` em `pipeline/actions.ts`.

### 1.1 Primeiro, fixar o texto de hoje

Antes de tocar em `llm-input.ts`, acrescentar ao teste um caso com a **string literal** esperada para
o `PARTS` atual (prompt, `Definições:`, três títulos, `Item de entrada:`, item). Rodar e ver passar.
Esse teste não pode mudar quando a assinatura mudar — só o jeito de chamar.

### 1.2 `pipeline/llm-input.ts`

```ts
export const DEFINITIONS_HEADING = 'Definições:'
export const ITEM_HEADING = 'Item de entrada:'
export const CODEBOOK_HEADING = 'Codebook:'
export const DEFINITION_PREFIX = 'Definição: '
export const OWN_CRITERIA_HEADING = 'Critérios:'
export const GENERAL_CRITERIA_HEADING = 'Critérios gerais, que valem para todas as definições:'

export type LlmDefinition = { id: string; title: string; description: string | null }

export type LlmCriterion = {
  definitionId: string | null
  name: string
  description: string | null
}

export type LlmInputParts = {
  phase: number
  promptText: string
  definitions: readonly LlmDefinition[]
  criteria: readonly LlmCriterion[]
  itemContent: string
}

export function composeLlmInput(parts: LlmInputParts): string
```

Internamente, duas funções não exportadas: uma que monta o bloco de títulos (o código de hoje) e
outra o bloco do codebook completo. `composeLlmInput` escolhe por `phase >= PHASE_3` e junta
`[prompt, bloco, item]` com `'\n\n'`, como hoje. Dentro do bloco da Fase 3, cada definição é um
parágrafo (linhas unidas por `'\n'`), e os parágrafos se unem por `'\n\n'`.

### 1.3 `pipeline/actions.ts` (`testPrompt`)

Só a chamada muda: `phase: PHASE_2`, `definitions: codebook.definitions`,
`criteria: codebook.criteria`. Comportamento idêntico (D6).

### 1.4 `(tabs)/rounds/actions.ts` (`generateResponses`)

Para manter o typecheck verde nesta Parte, a chamada passa `phase: PHASE_2` e monta `definitions` a
partir dos títulos que `RoundComposition` ainda traz (`{ id: '', title, description: null }`). É
provisório e sai na Parte 3 — anotar em "o que a Parte 2 herda". Alternativa igualmente boa: fazer a
Parte 1 já mudar `RoundComposition` (só leitura, sem coluna), se ficar menor.

### 1.5 Testes da Parte 1

`pipeline/llm-input.unit.test.ts` — os testes antigos passam a chamar com `phase: PHASE_2` e
continuam valendo. Novos:

- [ ] **Fase 2, byte a byte**: a string literal do § 1.1 sai igual com a assinatura nova, mesmo com
      descrições e critérios preenchidos nas partes (eles são ignorados).
- [ ] **Fase 1 compõe como a Fase 2** (o teste de prompt na Fase 1 depende disso).
- [ ] **Fase 3, ordem**: títulos, descrições e critérios específicos na ordem recebida; o bloco de
      gerais depois da última definição; o item por último.
- [ ] **Fase 3, gerais uma vez só**: com duas definições e um geral, o nome do geral aparece
      exatamente uma vez.
- [ ] **Fase 3, sem gerais**: o cabeçalho de gerais não aparece (D4).
- [ ] **Fase 3, definição sem descrição**: a linha `Definição: X` é seguida direto de `Critérios:`,
      e a entrada não contém `'\n\n\n'` nem linha só de espaços.
- [ ] **Fase 3, definição sem critério próprio**: sem `Critérios:` nela.
- [ ] **Fase 3, critério sem descrição**: `- Nome`, sem `:`.
- [ ] **Tipo e escala nunca aparecem**, nas duas fases: passar definições com `type` extra
      (`'quality_dimension'`, `'category'`) e verificar que nem o valor nem o rótulo de
      `definitionTypeLabel` aparecem; verificar que `scaleLabel` de cada valor de `SCALE` não aparece.
      As fixtures não podem conter essas palavras em prompt, título ou item.
- [ ] **Fase 3 com `phase` 4** compõe igual à Fase 3 (D5).
- [ ] **Sem normalização** também na Fase 3: descrição com quebra de linha e recuo entra como está.

### Pronto quando

Lint, typecheck e `npm test` verdes. O teste literal do § 1.1 passou antes e depois da mudança sem
ser editado (a não ser a chamada).

### O que a Parte 2 herda

- **Provisório em `generateResponses`** (§ 1.4, a opção menor): a chamada passa `phase: PHASE_2`,
  `criteria: []` e `definitions` montadas de `composition.definitionTitles` como
  `{ id: '', title, description: null }`, com `PHASE_2` importado de `pipeline/preconditions`. A
  Parte 2 não toca nisso; a Parte 3 troca pelo `composition.phase` e remove `definitionTitles` de
  `RoundComposition` (e do `responses.int.test.ts`, que ainda confere esse campo).
- **`testPrompt`** já passa `codebook.definitions` e `codebook.criteria` com `phase: PHASE_2` fixo
  (D6). Os dois testes de `pipeline/actions.int.test.ts` que chamam `composeLlmInput` direto foram
  só adaptados à assinatura, com `PHASE_2`.
- **O formato da Fase 3 ficou fixado por uma string literal** em `llm-input.unit.test.ts`
  (`PHASE_3_INPUT`), além da literal da Fase 2 (`PHASE_2_INPUT`). Mudar a redação dos cabeçalhos
  (D3) quebra esse teste de propósito.
- `llm-input.ts` importa `PHASE_3` de `preconditions.ts` e `ownCriteria`/`generalCriteria` de
  `criteria.ts`; `CodebookDefinition`/`CodebookCriterion` encaixam por estrutura (D9), o campo
  `type` sobra e é ignorado.
- Nada divergiu do plano.

---

# Parte 2 — A coluna `rounds.phase`

**Objetivo:** a rodada grava a fase na criação, as rodadas antigas ficam na Fase 2, e as leituras de
rodada trazem a fase. A geração ainda não usa.

**Ler antes:** seções 1 a 5, `lib/db/README.md` (fluxo de migration), `lib/db/schema.ts` (tabela
`rounds`), `createRound`, `(tabs)/rounds/rounds.ts`, `(tabs)/rounds/review.ts`, `addRound` em
`test/helpers.ts`.

### 2.1 `lib/db/schema.ts`

Na tabela `rounds`:

```ts
phase: integer().notNull(),
```

e, na lista de constraints:

```ts
check("rd_phase_range", sql`phase >= 2 AND phase <= 4`),
```

### 2.2 Migration

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npx drizzle-kit generate
```

Editar à mão o `supabase/migrations/0015_*.sql` gerado para que fique, nesta ordem:

```sql
ALTER TABLE "rounds" ADD COLUMN "phase" integer DEFAULT 2 NOT NULL;
ALTER TABLE "rounds" ALTER COLUMN "phase" DROP DEFAULT;
ALTER TABLE "rounds" ADD CONSTRAINT "rd_phase_range" CHECK (phase >= 2 AND phase <= 4);
```

Conferir que o `generate` não emitiu nada além disso (ruído de `pg_net` inclusive). O snapshot em
`meta/` fica sem default, que é o que o `schema.ts` diz.

**Conferir o backfill à mão**, uma vez: com rodadas no banco local (as de uma cena de conferência
servem), aplicar só a migration nova (`supabase migration up`) em vez de `db reset`, e
`select round_number, phase from rounds` mostra 2 em todas. Depois, `npm run db:reset`.

### 2.3 `(tabs)/rounds/actions.ts` (`createRound`)

O insert passa `phase: project.phase`. Nada mais muda: a leitura já é `FOR UPDATE` na mesma
transação que congela as versões.

### 2.4 Leituras

- `(tabs)/rounds/rounds.ts`: `Round` ganha `phase: number`; `loadOpenRound` e `listRounds` selecionam
  `rounds.phase`. `EvaluatedRound` não muda (D8).
- `(tabs)/rounds/review.ts`: `ReviewRound` ganha `phase`; `loadReviewRound` seleciona.

### 2.5 `test/helpers.ts`

`addRound` ganha `opts.phase?: number`, com `2` quando omitido — os 70 e poucos usos atuais continuam
iguais.

### 2.6 Testes da Parte 2

`(tabs)/rounds/actions.int.test.ts`, no `describe` de criar e fechar:

- [ ] **Criar rodada na Fase 2 grava `phase = 2`**.
- [ ] **Criar rodada na Fase 3 grava `phase = 3`** (projeto com `createProject(..., { phase: 3 })`).
- [ ] **A fase não muda depois**: rodada criada na Fase 2, fechada, projeto avançado para a Fase 3
      por `advancePhase` — a rodada continua com `phase = 2`.
- [ ] **O banco recusa fase fora da faixa**: insert direto com `phase: 1` falha com `23514`.
- [ ] **A lista traz a fase**: o teste existente de `listRounds` ("a lista traz número, estado,
      versões usadas e datas") passa a conferir `phase`.

### Pronto quando

Lint, typecheck e `npm test` verdes; migration conferida (§ 2.2); nenhuma tela mudou ainda.

### O que a Parte 3 herda

- **A migration é `supabase/migrations/0015_mushy_loki.sql`**, com as três instruções do § 2.2 nessa
  ordem. O `generate` não emitiu nada além da coluna e do CHECK (sem ruído de `pg_net`). O backfill
  foi conferido à mão: três rodadas inseridas antes, `supabase migration up`, todas com `phase = 2`
  e a coluna sem default; depois, `db reset`.
- **`rounds.phase` é `integer NOT NULL` sem default** no `schema.ts`, então todo insert de `rounds`
  precisa dizer a fase. Só há dois: `createRound` (grava `project.phase`) e `addRound` em
  `test/helpers.ts` (`opts.phase`, `2` quando omitido).
- **`Round` ganhou `phase`**, e com ele `OpenRound` e `RoundSummary`; `loadOpenRound` e `listRounds`
  selecionam a coluna. `ReviewRound`/`loadReviewRound` também. `EvaluatedRound` e `ReviewableRound`
  não mudaram (D8). A fixture `round()` de `agreement-series.unit.test.ts` passou a declarar
  `phase: 2` por causa do tipo.
- **Testes novos** em `(tabs)/rounds/actions.int.test.ts`: grava 2, grava 3, a fase não muda depois
  de fechar e avançar por `advancePhase`, e o CHECK recusa `phase: 1` com `23514`. O teste da lista
  agora usa um projeto na Fase 3 com uma rodada de cada fase e confere `phase`. O helper `roundsOf`
  do arquivo seleciona `phase`.
- **O provisório da Parte 1 em `generateResponses` continua** (`phase: PHASE_2`, títulos só): é a
  Parte 3 que o troca por `composition.phase`.
- Nada divergiu do plano.

---

# Parte 3 — A geração monta pela rodada

**Objetivo:** `generateResponses` compõe pela fase e pela versão de codebook congelada da rodada. É a
Parte que fecha o buraco descrito no issue.

**Ler antes:** seções 1 a 5, `pipeline/responses.ts` (`loadRoundComposition`), `setUpGeneration` e
`generateResponses`, e o `describe` de `generate-responses.int.test.ts` (a LLM falsa e o
`llm.inputs`).

### 3.1 `pipeline/responses.ts`

```ts
export type RoundComposition = {
  phase: number
  promptVersionId: string
  codebookVersionId: string
  promptText: string
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
}
```

`loadRoundComposition` seleciona `rounds.phase` junto com as versões e devolve `definitions` e
`criteria` de `loadCodebookVersion(projectId, round.codebookVersionId, db)` — a versão da rodada,
nunca `loadCodebook` (a vigente). `definitionTitles` sai.

### 3.2 `(tabs)/rounds/actions.ts` (`generateResponses`)

```ts
const input = composeLlmInput({
  phase: composition.phase,
  promptText: composition.promptText,
  definitions: composition.definitions,
  criteria: composition.criteria,
  itemContent: contents.get(itemId)!,
})
```

Sai o provisório da Parte 1 (§ 1.4). Nenhuma leitura de `projects.phase` entra aqui.

### 3.3 Testes da Parte 3

`(tabs)/rounds/generate-responses.int.test.ts`:

- [ ] **Rodada da Fase 2 manda só os títulos**: codebook com descrições e critérios; a entrada
      capturada em `llm.inputs` é igual a `composeLlmInput({ phase: 2, ... })` e não contém nenhuma
      descrição nem nome de critério.
- [ ] **Rodada da Fase 3 manda o codebook completo da versão congelada**: rodada criada sobre a v1;
      depois, uma v2 com descrição e critério diferentes é inserida direto com `addCodebookVersion`
      (com rodada aberta a action recusa salvar, então é o único jeito de existir versão mais nova).
      A entrada contém as descrições e critérios da v1 e nenhum texto da v2.
- [ ] **Uma rodada da Fase 2 lida com o projeto já na Fase 3 continua mandando só os títulos**:
      rodada com `addRound(..., { phase: 2 })` num projeto `phase: 3`. É a prova de que a geração lê
      a rodada, não o projeto.

`(tabs)/rounds/actions.int.test.ts`, espelhando os dois testes que já existem para a Fase 2 ("com
rodada aberta, salvar o codebook é recusado e nada muda" e "fechar destrava o codebook, e o
salvamento seguinte cria a versão seguinte"):

- [ ] **Na Fase 3, salvar codebook com rodada aberta é recusado** com `codebookLockedMessage` e nada
      muda no banco.
- [ ] **Na Fase 3, depois de fechar, salvar cria a versão seguinte**, e a rodada fechada continua
      apontando para a versão anterior.

Se os testes existentes aceitarem parametrização limpa por fase (`it.each([PHASE_2, PHASE_3])`),
preferir isso a duplicar.

### Pronto quando

Lint, typecheck e `npm test` verdes. `grep -rn definitionTitles app` não devolve nada.

### O que a Parte 4 herda

- **`RoundComposition`** agora é `{ phase, promptVersionId, codebookVersionId, promptText,
  definitions, criteria }`; `definitionTitles` saiu. `loadRoundComposition` lê `rounds.phase` e a
  versão congelada por `loadCodebookVersion`. `generateResponses` passa `composition.phase`,
  `definitions` e `criteria` direto a `composeLlmInput`; o provisório da Parte 1 e o import de
  `PHASE_2` em `(tabs)/rounds/actions.ts` saíram. Nenhuma leitura de `projects.phase` na geração.
- **Testes novos em `generate-responses.int.test.ts`**: `openRound` ganhou `projectPhase` e
  `roundPhase` (os dois `PHASE_2` por padrão) e o codebook da fixture ganhou um critério geral
  (`GENERAL_CRITERIA`). Os três testes do § 3.3 comparam `llm.inputs` com `composeLlmInput` sobre
  `loadCodebookVersion` da versão da rodada; o da Fase 3 insere a v2 com `addCodebookVersion` e
  confere que nenhum texto dela aparece. O teste antigo "o envio é prompt mais títulos mais item"
  passou a usar o helper `expectOnlyTitles`.
- **Trava na Fase 3**: os dois testes de trava do codebook em `(tabs)/rounds/actions.int.test.ts`
  viraram `it.each([PHASE_2, PHASE_3])`. O de recusa confere `codebookLockedMessage(1)` exato; o de
  destravar confere que a rodada fechada mantém `phase` e a `codebookVersionId` anterior. O helper
  local `definitionTitlesOf` foi renomeado para `titlesOfVersion`, para que
  `grep -rn definitionTitles app` volte vazio.
- **`responses.int.test.ts`**: `seedRound` aceita `phase`; os testes conferem `phase`,
  `definitions` e `criteria` no lugar de `definitionTitles`, e há um teste de que a fase lida é a
  gravada na rodada. A ordem global de `criteria` entre definições não é garantida (cada critério
  tem `orderIndex` próprio da definição), então o teste compara os nomes ordenados; a composição
  agrupa por definição e não depende disso.
- Nada divergiu do plano.

---

# Parte 4 — A tela

**Objetivo:** o Administrador vê a fase de cada rodada e lê, em uma frase, o que foi à LLM. Depois,
a varredura dos ACs.

**Ler antes:** seções 1 a 5, `round-list.tsx`, a seção "Rodada N aberta" em `(tabs)/rounds/page.tsx`,
`(tabs)/rounds/[roundId]/page.tsx`, e `app/components/ui/badge.tsx`.

### 4.1 `(tabs)/rounds/preconditions.ts`

```ts
export function roundInputSummary(phase: number): string
```

- `phase < PHASE_3`: "Rodada da Fase 2: a LLM recebe o prompt, os títulos das definições e o item de
  entrada."
- `phase >= PHASE_3`: "Rodada da Fase 3: a LLM recebe o prompt, o codebook completo — título,
  descrição e critérios de cada definição, e os critérios gerais — e o item de entrada."

Presente do indicativo de propósito: a mesma frase serve para a rodada aberta (que ainda vai gerar) e
para a fechada. A redação pode mudar; o que ela precisa dizer é o conteúdo do que foi, e nunca a
escala. Usar `PHASE_2`/`PHASE_3` nas strings, como o resto do arquivo.

### 4.2 `round-list.tsx`

Ao lado de "Rodada {n}", antes do badge de estado: `<Badge tone="neutral">Fase {round.phase}</Badge>`
(ou texto "· Fase N", o que ficar melhor com o badge aberta/fechada — conferir no navegador).

### 4.3 Painel da rodada aberta (`(tabs)/rounds/page.tsx`)

Na seção "Rodada N aberta", uma linha com `roundInputSummary(openRound.phase)`. É o lugar onde o
Administrador gera, e onde a frase mais serve.

### 4.4 Tela da rodada (`(tabs)/rounds/[roundId]/page.tsx`)

Com `access.isAdmin` (D8), uma linha sob o `BackLink`, antes da `Section`: a fase e
`roundInputSummary(round.phase)`. `access` precisa sair do `transaction` junto com o resto do
`ReviewView` (hoje só `round` sai).

### 4.5 Testes da Parte 4

- [ ] `(tabs)/rounds/preconditions.unit.test.ts`: a frase da Fase 2 fala em títulos e não em
      descrição nem critério; a da Fase 3 fala em codebook completo, descrição e critérios; nenhuma
      das duas contém "Alto", "Médio" ou "Baixo".
- [ ] `(tabs)/rounds/page.int.test.ts` (se a página já é testada assim): o Administrador vê a fase na
      lista; o Avaliador não recebe a fase nem a frase.
- [ ] `(tabs)/rounds/[roundId]/page.int.test.ts`: o Administrador vê a frase da fase da rodada; o
      Avaliador na mesma rodada não vê (D8).

### 4.6 Conferência no navegador

Com o Supabase local e `npm run dev:local`: um projeto com uma rodada da Fase 2 fechada, avanço para
a Fase 3, uma rodada nova aberta. Conferir a lista (duas fases diferentes), o painel da rodada aberta,
a tela da rodada fechada como Administrador e como Avaliador, e gerar uma resposta para ver que a LLM
real aceita a entrada da Fase 3. Ver a nota de memória sobre a faixa preta do preview se a captura
sair cortada.

### 4.7 Varredura dos ACs

| AC do issue | Onde está provado |
|---|---|
| Rodada grava a fase na criação, na mesma transação, e nunca muda | § 2.3; testes § 2.6 (grava 2, grava 3, não muda depois do avanço) |
| Migration preenche as existentes com Fase 2 | § 2.2 (conferência manual do backfill) |
| Fase 2: entrada idêntica à de hoje | § 1.1 (literal) + § 3.3 (LLM falsa) |
| Fase 3: prompt, codebook completo e item | § 1.5 + § 3.3 |
| Título, descrição quando existe, critérios (nome e descrição), na ordem | § 1.5 (ordem) |
| Definição sem descrição sem linha vazia | § 1.5 |
| Gerais uma vez só, com cabeçalho próprio | § 1.5 |
| Tipo e escala não aparecem | § 1.5 |
| Geração usa a versão congelada, não a vigente | § 3.3 (v2 inserida com rodada aberta) |
| Lista e tela da rodada mostram a fase | § 4.2, § 4.4, § 4.5 |
| Tela da rodada diz o que foi à LLM | § 4.1, § 4.4 |
| Fase 3: codebook e prompt travados com rodada aberta; versão seguinte depois | § 3.3 (codebook); prompt conforme D7 |

### Pronto quando

Lint, typecheck e `npm test` verdes, conferência no navegador feita, tabela acima sem linha em
aberto, checkboxes do issue marcados.

### O que esta Parte fechou

_(preencher ao terminar a Parte)_

---

## 6. Fica para depois (registrar, não construir)

- **Entrada enviada gravada na Resposta** — #71.
- **Teste de prompt pela fase atual, mostrando a entrada** — #72 (troca o `PHASE_2` fixo de D6).
- **Contagem de rodadas fechadas por fase e recusa de rodada na Fase 4** — #77.
- **Fase na série de ICR e "o que mudou" entre rodadas** — #75.
- **Trava do prompt com rodada aberta**, se a leitura de D7 for a outra — fatia própria.

## 7. Deploy

Esta fatia **tem migration**. Ordem no deploy:

1. `supabase db push` para prod **antes** do deploy do código (o código novo insere `phase` e
   seleciona `rounds.phase`; sem a coluna, criar e listar rodadas quebra).
2. Conferir em prod que as rodadas existentes ficaram com `phase = 2`.
3. Deploy do código.

Antes do passo 1, conferir o diff de schema de prod contra o local: se houver atraso de fatias
anteriores, empurrar tudo junto e ignorar o ruído do `pg_net`.
