# Plano de implementação — Issue #72: "33 — Teste de prompt monta pela fase atual e mostra a entrada"

Link: https://github.com/nicolasddr/tcc/issues/72
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 7 e 8)
Blocked by: #70 (**fechada**). `composeLlmInput` já recebe a fase, e a geração da rodada já monta a
entrada por ela. A #71 (também fechada) deixou pronto o bloco recolhido `SentInput`.

**A executar em 3 partes, uma por chat.** As seções 1 a 5 são o contexto comum. Quem pegar qualquer
Parte lê `AGENTS.md`, estas cinco seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A action monta a entrada pela fase atual do projeto | ✅ |
| 2 | A action devolve a entrada com a saída, com prova de que é a mesma de uma rodada | ⬜ |
| 3 | A tela mostra a entrada recolhida acima da saída; varredura dos ACs | ⬜ |

**Sem migration, sem ADR nova.** A decisão já está na emenda de 2026-09-22 da ADR 0002 e no
glossário (`docs/CONTEXT.md`, verbete **Teste de prompt**), que **já descreve o comportamento
final**: "chama a LLM com a mesma entrada que uma rodada da fase atual enviaria [...] mostra essa
entrada e a saída na tela, e não grava nada". Nenhum documento de domínio muda nesta fatia.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Action do teste | `pipeline/actions.ts` (`testPrompt`, `PromptTestState`) | hoje chama `composeLlmInput({ phase: PHASE_2, ... })` **fixo**. Passa a ler a fase do projeto (Parte 1) e a devolver `input` (Parte 2) |
| Composição | `pipeline/llm-input.ts` (`composeLlmInput`) | **não muda**. Com `phase >= PHASE_3` já monta o codebook completo; abaixo disso, só os títulos |
| Codebook vigente | `pipeline/codebook.ts` (`loadCodebook`) | já devolve `definitions` com `description` e `criteria` com `definitionId`, `name`, `description`, da versão vigente. O teste já os passa para `composeLlmInput`; só a fase estava errada |
| Criação de rodada | `(tabs)/rounds/actions.ts` (`createRound`) | congela a versão **vigente** (`loadCodebook`, `loadPrompt`) e grava `phase: project.phase`. É o que torna "a mesma entrada que uma rodada enviaria" verdadeiro: rodada e teste leem a mesma versão e a mesma fase |
| Geração | `(tabs)/rounds/actions.ts` (`generateResponses`) + `pipeline/responses.ts` (`loadRoundComposition`) | a referência da Parte 2: a `sent_input` gravada é o que uma rodada enviou |
| Tela do teste | `pipeline/prompt-test.tsx` (`PromptTest`, client) | mostra a saída num `Card`. Ganha a entrada acima (Parte 3). A dica do campo diz "títulos das definições" fixo e fica errada na Fase 3 |
| Página do prompt | `(tabs)/prompt/page.tsx` | já tem `access.project` (com `phase`, via `loadPipelineAccess`). Passa a fase ao `PromptTest` (Parte 3) |
| Bloco recolhido | `(tabs)/rounds/sent-input.tsx` (`SentInput`, `SENT_INPUT_SUMMARY`) | `Disclosure` fechado + `<pre>` monoespaçado. A #71 deixou anotado que a #72 pode reaproveitá-lo (D4) |
| LLM falsa do teste | `pipeline/prompt-test.int.test.ts` (`llm.inputs`, `rowCounts`, `readyProject`) | já captura cada entrada e já prova "nada gravado" contando linhas de todas as tabelas. É onde entram os testes das Partes 1 e 2 |
| Helpers | `test/helpers.ts` | `createProject(..., { phase })`, `addCodebookVersion(..., { definitions, generalCriteria })` com descrição e critérios, `addRound(..., { phase })`. Nada novo precisa nascer |
| Referência de teste da Fase 3 | `(tabs)/rounds/generate-responses.int.test.ts` (`DEFINITIONS` com descrição e critérios, `expectedInput`, `expectOnlyTitles`) | desenho a copiar para as fixtures da Fase 3 |

O que **falta** e esta fatia cria: a leitura da fase no teste, o campo `input` no retorno e o bloco
na tela.

---

## 2. A fatia por extenso

### A fase é lida junto com o resto

`testPrompt` já abre uma `transaction` para ler item, codebook e prompt. A fase do projeto entra na
**mesma** leitura, para que fase, versão de codebook e versão de prompt sejam um retrato só. Sem
`for update`: o teste não escreve nada, e não há o que proteger.

### A composição é a mesma função, com os mesmos dados

A garantia de "a entrada mostrada é a mesma que uma rodada daquela fase enviaria" é estrutural:

- mesma função (`composeLlmInput`);
- mesma fase (a do projeto, que é a que `createRound` gravaria);
- mesma versão de codebook e de prompt (a vigente, que é a que `createRound` congelaria);
- mesmo conteúdo do item (`inputItems.content`, lido do mesmo jeito que `setUpGeneration` lê).

A Parte 2 prova isso ponta a ponta: testa, abre a rodada, gera para o mesmo item e compara a
`sent_input` gravada com a `input` devolvida pelo teste, byte a byte.

### A entrada devolvida é a variável enviada

Como na #71: `input` no retorno é **a mesma variável** passada a `askLlm`. Nada de recompor, de
`trim()` ou de normalizar quebra de linha.

### Nada muda no que o teste não grava nem no teto

O teste continua sem `insert`, sem `update` de `usedAt`, sem rodada. O teto continua em
`hasProjectResponsesLeft` / `countProjectResponse`, na mesma ordem. As Partes 1 e 2 só **repetem as
provas** de "nada gravado" e de teto na Fase 3.

---

## 3. Decisões desta fatia

Decisões que o issue e o PRD deixam abertas. Cada uma tem uma recomendação. Nenhuma pede
confirmação antes de começar: todas seguem precedente do código ou do glossário.

**D1 — A fase vem de `projects.phase`, passada crua a `composeLlmInput`.** Fase 1 e 2 caem nos
títulos; 3 (e 4, quando existir) no codebook completo, pela regra `phase >= PHASE_3` que já está na
função. Nada de mapear a fase no teste: o limiar mora num lugar só.

**D2 — A condição de liberar o teste não muda.** Continua `canAdvanceFromPhase1` (definição, texto
do prompt, item). Na Fase 3 **não** se exige descrição nem critério para testar: definição sem
descrição já sai só com o título (garantia da #70), e o teste existe justamente para o
Administrador ver o que falta antes de abrir rodada. Quem barra rodada incompleta é `roundBlockers`,
e isso não muda.

**D3 — `input` só no retorno de sucesso.** `PromptTestState` vira
`{ ok: true; nonce; model; output; input }`. Nos erros não vai nada: os erros anteriores à chamada
(permissão, item, insumos, teto) não enviaram nada, e o AC fala da entrada "junto com a saída".
Mostrar a entrada também quando a LLM falha (útil no `too_large`) fica registrado em § 6.

**D4 — Reaproveitar `SentInput` importando direto de `(tabs)/rounds/sent-input.tsx`.** Já há
precedente de `pipeline/` importar de `(tabs)/rounds/` (`actions.ts`, `codebook-editor.tsx`,
`phase-2-checklist.tsx`), então não vale mover o arquivo e mexer nos imports da #71. O arquivo não
tem hook nem import de servidor (só `import type`), então serve dentro de um client component. O
ramo `sentInput === null` ("gerada antes de a ferramenta gravar...") nunca dispara no teste, porque
ele sempre passa texto.

**D5 — Posição e rótulo.** O bloco fica **acima** do título "Resposta da LLM (modelo)", dentro do
mesmo contêiner que já escurece (`opacity-60`) durante uma nova chamada, para que entrada e saída
antigas escureçam juntas. Rótulo: o mesmo `SENT_INPUT_SUMMARY` ("Entrada enviada à LLM"), fechado por
padrão.

**D6 — A dica do campo passa a depender da fase.** Hoje: "Vão à LLM o texto do prompt vigente, os
títulos das definições da versão vigente e o conteúdo deste item." Na Fase 3 isso é falso. Sugestão:

- Fases 1 e 2: o texto atual, sem mudança;
- Fase 3 em diante: "Vão à LLM o texto do prompt vigente, o codebook completo da versão vigente
  (títulos, descrições e critérios) e o conteúdo deste item, como numa rodada desta fase."

`PromptTest` ganha a prop `phase: number`, que a página passa de `project.phase`. A escolha do texto
é uma função pura exportada (`promptTestHint(phase)`), para o teste não depender de renderizar o
client component. O tooltip do painel ("A verificação que fecha a Fase 1...") continua verdadeiro e
não muda.

**D7 — O resultado vira um componente sem hook, para poder ser testado.** Os testes de tela do
projeto renderizam árvores de servidor (`findElement`, `renderToStaticMarkup`). `PromptTest` usa
`useActionState` e, renderizado estático, nunca tem resposta. Extrair a parte de baixo para
`PromptTestResult({ answer, pending })`, no mesmo arquivo, e testá-la com `createElement` +
`renderToStaticMarkup`. É a menor mudança que torna "entrada recolhida, acima da saída" verificável
sem navegador.

---

## 4. Fronteira com as fatias vizinhas

- **#70 / #71** (fechadas): nada delas muda. O `SentInput` da #71 só ganha um segundo uso (D4).
- **#78 (CSV)**: não toca no teste, que não grava resposta.
- **Fase 4**: quando o épico existir, o teste monta como a Fase 3 (D1), a menos que a Fase 4 mude a
  composição. Nesse caso, a mudança é em `composeLlmInput`, e o teste acompanha sozinho.

---

## 5. Convenções que valem em todas as Partes

- Sem comentários novos no código; a explicação vai no commit.
- Sem `npx prettier` (não há config no repo).
- A regra (qual fase, o que vai à LLM) fica na action, no servidor. A tela só mostra o que a action
  devolve.
- Antes de `npm test`, a tabela `scores` precisa estar vazia (limpar cena de conferência, se houver).
- Um commit por Parte, com a suíte verde (`npm run lint`, `npm run typecheck`, `npm test`).

---

# Parte 1 — A action monta a entrada pela fase atual

**Objetivo:** na Fase 3 a LLM recebe o codebook completo da versão vigente; nas Fases 1 e 2 nada
muda. O retorno e a tela ficam iguais.

**Ler antes:** seções 1 a 5, `pipeline/actions.ts` (`testPrompt`), `pipeline/llm-input.ts`,
`pipeline/prompt-test.int.test.ts`, e em `(tabs)/rounds/generate-responses.int.test.ts` as fixtures
`DEFINITIONS` / `GENERAL_CRITERIA`, `expectedInput` e `expectOnlyTitles`.

### 1.1 `pipeline/actions.ts`

Na `transaction` de `testPrompt`, ler também a fase:

```ts
const [project] = await tx
  .select({ phase: projects.phase })
  .from(projects)
  .where(eq(projects.id, projectId))
  .limit(1)
```

Devolver `phase: project?.phase` junto com `codebook`, `prompt` e `item`. Projeto inexistente já é
barrado antes por `isProjectAdmin`; se mesmo assim vier vazio, tratar como `TEST_DENIED` (não
inventar mensagem nova).

Trocar `phase: PHASE_2` por `phase` (D1). Se `PHASE_2` deixar de ser usado no arquivo, remover o
import.

### 1.2 Testes em `pipeline/prompt-test.int.test.ts`

Ampliar `readyProject` com `phase?: number` (repassado a `seedProject`) e aceitar definições com
`description` e `criteria`, e `generalCriteria` (repassados a `addCodebookVersion`). Copiar de
`generate-responses.int.test.ts` um conjunto de fixtures com descrição, critério específico e
critério geral, com textos distintos, para os `not.toContain` não darem falso positivo.

Casos novos:

- **Fase 2 envia só os títulos, mesmo com descrições e critérios cadastrados.** Projeto na Fase 2
  com o codebook rico: a entrada contém os títulos e `DEFINITIONS_HEADING`, e não contém
  `CODEBOOK_HEADING`, `GENERAL_CRITERIA_HEADING`, nenhuma descrição, nenhum nome de critério.
- **Fase 1 também envia só os títulos** (`it.each([PHASE_1, PHASE_2])` com o caso acima; as
  constantes estão em `preconditions.ts`).
- **Fase 3 envia o codebook completo.** `expect(llm.inputs).toEqual([composeLlmInput({ phase:
  PHASE_3, ... })])` montado a partir de `loadCodebook(project)` e do prompt vigente, e mais as
  asserções legíveis: contém `CODEBOOK_HEADING`, cada descrição, cada critério específico, o
  `GENERAL_CRITERIA_HEADING` **uma vez só**. Não contém o tipo da definição nem rótulo de escala.
- **Fase 3 usa a versão vigente, não uma anterior.** Duas versões de codebook (v1 e v2, com
  descrições diferentes): a entrada traz a descrição da v2 e não a da v1. Mesmo desenho do caso
  "envia o texto do prompt VIGENTE".
- **Fase 3 sem descrição nem critério ainda testa.** Codebook só com títulos na Fase 3: `ok: true`,
  e a entrada tem `CODEBOOK_HEADING` com as linhas `Definição: <título>` sem linha vazia sobrando
  (D2).

Os casos atuais criam projeto sem fase, ou seja, na Fase 1 (default da coluna), e continuam passando
sem mudança.

### 1.3 Mutação para conferir

Voltar temporariamente `phase: PHASE_2` fixo: os casos da Fase 3 têm de cair. Trocar por
`phase: PHASE_3` fixo: os das Fases 1 e 2 têm de cair.

### Pronto quando

Lint, typecheck e `npm test` verdes. Commit sugerido:
`feat(pipeline): teste de prompt monta a entrada pela fase do projeto`.

### O que a Parte 2 herda

- Fixtures ricas em `prompt-test.int.test.ts`: `RICH_DEFINITIONS` (descrição + critério próprio,
  tipos `DefinitionFixture`) e `RICH_GENERAL_CRITERIA`. `DEFINITIONS` continua só com títulos.
- `readyProject(admin, { phase?, definitions?, generalCriteria? })`: cria o projeto direto com
  `seedProject(..., { phase })` (não passa mais por `newProject`). Sem `phase`, fica na Fase 1.
- Helper novo no `describe`: `expectedInput(phase, project)`, que recompõe com `composeLlmInput` a
  partir de `loadCodebook`/`loadPrompt` vigentes e `ITEM_CONTENT`. Serve de referência na Parte 2.
- A fase entrou como **query própria** (`select phase from projects`) dentro da mesma `transaction`
  que já lia item, codebook e prompt. Projeto vazio devolve `TEST_DENIED`, antes do item.
- `PHASE_2` segue importado em `actions.ts` (usado em `advancePhase` e no salvar do codebook).

---

# Parte 2 — A action devolve a entrada, e ela é a mesma de uma rodada

**Objetivo:** `testPrompt` devolve `input` junto com `output`; fica provado que essa entrada é, byte
a byte, a que uma rodada da mesma fase enviaria para o mesmo item, e que nada é gravado em nenhuma
fase.

**Ler antes:** seções 1 a 5, "O que a Parte 2 herda", `(tabs)/rounds/actions.ts` (`createRound`,
`generateResponses`) e o mock de LLM de `generate-responses.int.test.ts`.

### 2.1 `pipeline/actions.ts`

```ts
export type PromptTestState =
  | { error: string }
  | { ok: true; nonce: number; model: string; output: string; input: string }
  | null
```

`return { ok: true, nonce: Date.now(), model: answer.model, output: answer.text, input }`, com a
mesma variável passada a `askLlm` (§ 2). Nos erros não muda nada (D3). O client component ignora o
campo novo até a Parte 3, então typecheck fica verde.

### 2.2 Testes em `pipeline/prompt-test.int.test.ts`

- **O retorno traz a entrada junto com a saída.** Nas Fases 2 e 3 (`it.each`):
  `result.input` é `toBe(llm.inputs[0])`, e `result.output` continua `llm.text`.
- **A entrada é devolvida sem normalização.** Prompt com `\r\n`, recuo e espaço no fim da linha, e
  item com linha em branco: `result.input` é `toBe(llm.inputs[0])` e contém esses caracteres
  intactos.
- **A entrada do teste é a que uma rodada da mesma fase enviaria para o mesmo item.** Nas Fases 2 e 3
  (`it.each`): testar o prompt, depois chamar `createRound` e `generateResponses` para o mesmo item,
  ler `responses.sent_input` e comparar `toBe(result.input)`. Este é o teste que prova o AC 3 de ponta
  a ponta. Precisa do mesmo mock de `@/lib/ai` (já está no arquivo) e dos imports das actions de
  rodada. Se as pré-condições de rodada pedirem algo que o fixture não tem (avaliador ativo,
  critérios na Fase 3), completar o fixture, não afrouxar a regra. Limpeza: a rodada e a resposta
  saem pelo `cleanup(projs, users)`; conferir que a tabela `scores` fica vazia.
- **Nada é gravado, em nenhuma fase.** Transformar o caso atual "não grava nada" em
  `it.each([PHASE_2, PHASE_3])`, com o `rowCounts()` antes e depois. Idem para "não congela versão
  nenhuma": `usedAt` do codebook e do prompt continua `null` na Fase 3.
- **O teto vale na Fase 3.** Um caso só: `LLM_PROJECT_RESPONSES_MAX=1`, projeto na Fase 3, a
  segunda chamada é recusada com a mensagem do teto e `llm.inputs` tem uma entrada só.
- **Erro não traz entrada.** Falha da LLM (`llm.fails = true`): o retorno tem `error` e não tem a
  chave `input` (D3).

### 2.3 Mutação para conferir

Devolver `input: input.trim()`: o caso sem normalização cai. Devolver uma entrada recomposta com
`PHASE_2` fixo: o caso de equivalência com a rodada cai na Fase 3.

### Pronto quando

Lint, typecheck e `npm test` verdes. Commit sugerido:
`feat(pipeline): teste de prompt devolve a entrada enviada junto com a saída`.

### O que a Parte 3 herda

- (preencher) o formato final de `PromptTestState`.
- (preencher) qualquer ajuste de fixture que o teste de equivalência exigiu.

---

# Parte 3 — A tela mostra a entrada, recolhida, acima da saída

**Objetivo:** o Administrador vê, depois do teste, a entrada enviada num painel fechado, acima da
resposta; a dica do campo diz o que vai à LLM naquela fase. Fecha a varredura dos ACs.

**Ler antes:** seções 1 a 5, "O que a Parte 3 herda", `pipeline/prompt-test.tsx`,
`(tabs)/prompt/page.tsx`, `(tabs)/rounds/sent-input.tsx`, `app/components/ui/disclosure.tsx` e a
nota de memória sobre a faixa preta do preview.

### 3.1 `pipeline/prompt-test.tsx`

- Importar `SentInput` de `../(tabs)/rounds/sent-input` (D4).
- Nova prop `phase: number`.
- `export function promptTestHint(phase: number): string` com os dois textos de D6, usando
  `PHASE_3` de `preconditions.ts` como limiar. O `Field` passa a usar `hint={promptTestHint(phase)}`.
- Extrair `export function PromptTestResult({ answer, pending })` (D7), sem hook. Ordem dentro do
  contêiner que escurece:
  1. `<SentInput sentInput={answer.input} />`;
  2. o título "Resposta da LLM (modelo)" / "Resposta do teste anterior (modelo)";
  3. o `Card` com a saída;
  4. a frase "Nada disso é gravado...".
- `PromptTest` passa a renderizar `{answer ? <PromptTestResult answer={answer} pending={pending} /> : null}`.

Conferir no navegador se o `<pre>` do `SentInput` precisa de `max-h` dentro do painel do teste
(o `scrollBoxClass` já limita a altura na tela da rodada). Não ajustar se não precisar.

### 3.2 `(tabs)/prompt/page.tsx`

`<PromptTest ... phase={project.phase} />`. `project` já vem de `requirePipelineAdmin(access, id)`.

### 3.3 Testes

Em `(tabs)/prompt/page.int.test.ts`:

- **A página passa a fase do projeto ao teste.** `it.each([PHASE_2, PHASE_3])`: projeto criado com
  a fase, `props.phase` igual a ela.

Num `pipeline/prompt-test.unit.test.ts` novo (renderizando com `createElement` +
`renderToStaticMarkup`, sem hook):

- **`promptTestHint`**: Fases 1 e 2 falam em "títulos"; Fase 3 fala em "codebook completo" e não em
  "títulos".
- **`PromptTestResult` mostra a entrada recolhida, acima da saída.** O markup tem um `<details>` sem
  o atributo `open`, com `SENT_INPUT_SUMMARY` no `<summary>`; o texto da entrada aparece dentro dele;
  o índice da entrada no markup é menor que o da saída.
- **A entrada aparece como veio.** Entrada com `\n`, recuo e linha em branco: o conteúdo do `<pre>`,
  depois de desfazer o escape HTML, é `toBe` a entrada.
- **Durante uma nova chamada, entrada e saída anteriores escurecem juntas** (`pending: true`: as
  duas dentro do contêiner com `opacity-60` e `aria-busy`).
- **Não aparece a frase de resposta antiga** (`SENT_INPUT_MISSING` ausente).

Se `renderToStaticMarkup` num `.unit.test.ts` esbarrar em configuração do Vitest (ambiente `node`,
JSX em `.ts`), mover os casos para um `.int.test.ts` ao lado, que é onde os testes de página já
fazem isso.

### 3.4 Conferência no navegador

Projeto local na Fase 2 e outro na Fase 3 (com descrição, critério específico e critério geral),
logado pelo `/dev/login`:

- a dica do campo muda entre as duas fases;
- depois do teste, o painel "Entrada enviada à LLM" aparece fechado, acima da resposta;
- aberto, mostra os títulos na Fase 2 e o codebook completo na Fase 3, com quebras e recuo intactos;
- testar de novo: entrada e resposta anteriores escurecem juntas e são trocadas no fim;
- em 375 px, a linha longa quebra dentro da caixa, sem rolagem horizontal da página.

A LLM de verdade custa: usar o teto baixo (`LLM_PROJECT_RESPONSES_MAX`) ou o provedor falso local,
se houver, e limpar a cena depois (a tabela `scores` precisa ficar vazia para o `npm test`).

### 3.5 Varredura dos ACs

| AC do issue | Onde está provado |
|---|---|
| Nas Fases 1 e 2 o teste envia o prompt com os títulos, como hoje | § 1.2 (Fase 1 e Fase 2 com codebook rico, só títulos); casos atuais intactos |
| Na Fase 3 o teste envia o prompt com o codebook completo da versão vigente | § 1.2 (codebook completo; versão vigente, não a anterior) |
| A entrada mostrada é a mesma que uma rodada daquela fase enviaria para aquele item | § 2.2 (teste → rodada → `sent_input` `toBe` a entrada devolvida, Fases 2 e 3); § 3.3 (a tela mostra `answer.input` sem transformação) |
| A entrada aparece recolhida, acima da saída | § 3.3 (`<details>` sem `open`, antes da saída); § 3.4 |
| O teste continua sem gravar Resposta, sem criar Rodada e sem congelar versão | § 2.2 (`rowCounts` e `usedAt`, Fases 2 e 3) |
| O teste continua sujeito ao teto de respostas do projeto | casos atuais de teto; § 2.2 (teto na Fase 3) |
| Teste: na Fase 2 a LLM falsa recebe só os títulos; na Fase 3, o codebook completo | § 1.2 |
| Teste: o retorno traz a entrada junto com a saída | § 2.2 |
| Teste: nada é gravado, em nenhuma das fases | § 2.2 |
| Suíte verde | cada Parte |

### Pronto quando

Lint, typecheck e `npm test` verdes, conferência no navegador feita, tabela acima sem linha em
aberto, checkboxes do issue marcados. Commit sugerido:
`feat(pipeline): teste de prompt mostra a entrada enviada, recolhida`.

### O que esta Parte fechou

- (preencher)

---

## 6. Fica para depois (registrar, não construir)

- **Entrada também no erro da LLM** (D3). Útil no `too_large`, para ver o tamanho do que foi. Seria
  um campo `input` opcional no ramo de erro da chamada e o mesmo `SentInput` acima do `Alert`.
- **Copiar a entrada** com um botão. Não pedido; o `<pre>` já permite selecionar.
- **Composição da Fase 4**, quando o épico existir (§ 4).

## 7. Deploy

Sem migration. Deploy normal do código. A conferência em prod é um teste de prompt num projeto de
cada fase, lembrando que ele consome o teto do projeto.
