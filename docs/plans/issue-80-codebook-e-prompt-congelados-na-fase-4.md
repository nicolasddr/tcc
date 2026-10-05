# Plano de implementação — Issue #80: "40 — Codebook e prompt congelados na Fase 4"

Link: https://github.com/nicolasddr/tcc/issues/80
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 4, 5, 6 e 7; seções
"Congelamento" de Decisões de Implementação e de Testing Decisions)
Blocked by: nenhuma.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Regra pura: quando o projeto está congelado e as duas mensagens | ☑ |
| 2 | As actions: recusa em `saveCodebook` e `savePrompt`, e a prova de que o resto continua livre | ☑ |
| 3 | As telas: codebook e prompt em modo de leitura na Fase 4, testes de página e varredura dos ACs | ☑ |

**Nenhuma ADR nova.** A regra está escrita na **ADR 0004** ("A Fase 4 congela codebook e prompt
enquanto dura") e no glossário (`docs/CONTEXT.md`, verbete **Fase**, item *Fase 4*: "Enquanto o projeto
está na Fase 4, codebook e texto do prompt não mudam; o pool de itens continua crescendo"). Se algo
divergir, emende a ADR em vez de improvisar no código.

**Sem migration.** `projects.phase` já aceita 1 a 4 e `rounds.phase` já aceita 4. Nada de schema.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Salvar codebook | `pipeline/actions.ts` (`saveCodebook`) | ganha a recusa da Fase 4 logo depois de ler a fase sob `FOR UPDATE` (Parte 2) |
| Salvar texto do prompt | `pipeline/actions.ts` (`savePrompt`) | trava a linha do projeto mas **não lê a fase**; passa a ler e recusar (Parte 2) |
| Metadados do prompt | `pipeline/actions.ts` (`savePromptMetadata`) | **sem mudança** |
| Itens | `pipeline/actions.ts` (`createItem`, `updateItem`, `deleteItem`, `withEditableItem`) | **sem mudança** |
| Teste de prompt | `pipeline/actions.ts` (`testPrompt`) + `pipeline/llm-input.ts` (`composeLlmInput`, `phase >= PHASE_3` → codebook completo) | **sem mudança de código**: a Fase 4 já cai no ramo do codebook completo |
| Trava por rodada aberta | `(tabs)/rounds/preconditions.ts` (`codebookLockedMessage`) | modelo de mensagem. Não muda |
| Constantes de fase | `pipeline/preconditions.ts` (`PHASE_1`…`PHASE_4`) | só importadas |
| Editor do codebook | `pipeline/codebook-editor.tsx` (`CodebookEditor`, `CodebookReadOnly`) | já tem o modo de leitura para rodada aberta; passa a usá-lo na Fase 4 (Parte 3) |
| Editor do prompt | `pipeline/prompt-editor.tsx` (`PromptEditor`) | **não tem** modo de leitura travado; ganha um (Parte 3) |
| Páginas | `(tabs)/codebook/page.tsx`, `(tabs)/prompt/page.tsx` | a do codebook já passa `phase`; a do prompt passa a calcular o aviso (Parte 3) |
| Dica do teste de prompt | `pipeline/prompt-test.tsx` (`promptTestHint`, `phase >= PHASE_3`) | já diz "codebook completo… como numa rodada desta fase". Não muda |
| Testes vizinhos | `(tabs)/rounds/actions.int.test.ts` (helpers `readyProject(admin, phase)`, `codebookForm`, `codebookVersionsOf`, `titlesOfVersion`; casos "com rodada aberta, salvar o codebook é recusado"), `pipeline/prompt-test.int.test.ts` (`readyProject`, `expectedInput`, `rowCounts`), `(tabs)/codebook/page.int.test.ts`, `(tabs)/prompt/page.int.test.ts` | copiar helpers e espelhar os casos |

O que **falta**, e esta fatia cria: a regra pura do congelamento com as duas mensagens, as duas
recusas nas actions, o modo de leitura do prompt e o uso do modo de leitura do codebook na Fase 4.

---

## 2. O congelamento, por extenso

### O que congela

- **Codebook inteiro**: definição (título, tipo), descrição, critério e ordem. Na prática, qualquer
  chamada a `saveCodebook` com o projeto na Fase 4, porque a action salva o conjunto inteiro da versão.
- **Texto do prompt**: qualquer chamada a `savePrompt` com o projeto na Fase 4, **inclusive** a que
  manda o mesmo texto (hoje ela devolve `ok` sem gravar, pelo `decideTextSave → 'unchanged'`). A
  recusa vem antes da decisão de versionamento, então "mesmo texto" também é recusado. Pela interface
  isso não acontece, porque o botão some.

### O que fica livre

- **Metadados do prompt** (nome, descrição, registro de mudanças): não vão à LLM.
- **Cadastrar item**: é do pool que saem os itens novos da Fase 4. Editar e remover item **não usado**
  também continuam livres (a issue não congela o pool; só a regra de item usado, que já existe, vale).
- **Teste de prompt**: monta como na Fase 3, com o codebook completo da versão vigente, e não grava
  nada.

### Fases 1, 2 e 3

Nada muda. A recusa nova só existe com `phase >= PHASE_4`.

---

## 3. Decisões

**D1. Regra e mensagens num módulo puro novo, `pipeline/freeze.ts`.** Duas exportações:

```ts
export function isFrozen(phase: number): boolean  // phase >= PHASE_4
export function frozenMessage(subject: 'codebook' | 'prompt'): string
```

As duas mensagens têm o mesmo formato (AC 2) e dizem as duas coisas do AC 3: a Fase 4 congela
codebook e prompt enquanto dura, e refinar exige voltar à Fase 3. Rascunho:

- codebook: "Este projeto está na Fase 4, que congela o codebook e o prompt enquanto dura, para que o
  teste de replicação meça exatamente o que a Fase 3 avaliou. Para refinar o codebook, é preciso
  voltar à Fase 3."
- prompt: mesmo texto até "avaliou.", depois "Para refinar o texto do prompt, é preciso voltar à
  Fase 3. Nome, descrição e registro de mudanças continuam editáveis, porque não vão à LLM."

Sem palavra de juízo (nada de "aprovado", "replicou", "generalizou"), como pede o PRD. A mensagem não
aponta para um botão de retorno, porque ele só nasce na #86; quando a #86 entrar, ela decide se a
mensagem ganha o caminho ("na visão geral"). Anotar isso no "o que herda" da Parte 3.

Por que módulo próprio e não `pipeline/preconditions.ts`: aquele arquivo é das pré-condições de
**avanço**. O congelamento é usado por duas actions e duas telas, e fica mais fácil de achar sozinho.
Se na Parte 1 parecer pequeno demais, cabe em `preconditions.ts` sem prejuízo; anote a escolha.

**D2. Na Fase 4, o congelamento vem antes da trava por rodada aberta.** Hoje `saveCodebook` checa a
rodada aberta logo depois do `FOR UPDATE`. Na Fase 4 com rodada aberta (possível depois da #82), a
mensagem de rodada aberta diria "Feche a rodada para voltar a editar", o que é falso: fechar não
destrava nada. Então a checagem da fase vai **antes** de `loadOpenRound`, no mesmo bloco e na mesma
transação. A tela segue a mesma precedência (Parte 3).

**D3. `savePrompt` passa a ler a fase sob o lock que já faz.** A issue diz que a recusa entra "no mesmo
ponto em que essas ações já recusam quando há rodada aberta". Para o codebook é verdade; para o prompt
**não existe** recusa por rodada aberta (com rodada aberta, salvar o texto cria a versão seguinte,
porque a vigente já está usada). O "mesmo ponto" no prompt é, então, logo depois do
`select … for('update')` da linha do projeto, que hoje só seleciona `id` e passa a selecionar `phase`.
Isso preserva a garantia do PRD (Integridade): a edição que chega junto com o avanço ou é salva antes
e o avanço a vê, ou chega depois e é recusada.

**D4. Ordem dentro das actions: autorização → parse → transação → lock → fase.** A recusa por fase só
acontece para o Administrador; o Avaliador continua recebendo `DENIED`/`PROMPT_DENIED`, que vêm antes.
Erro de validação do formulário (título vazio, texto vazio) continua vindo antes da recusa por fase,
porque o parse é anterior à transação. Isso é aceitável: pela interface o formulário nem aparece.
Não reordenar o parse.

**D5. `CodebookReadOnly` passa a receber o aviso pronto, não o número da rodada.** Troca a prop
`openRoundNumber: number | null` por `notice: string | null`. O `CodebookEditor` decide qual aviso
mostrar (D2) e passa o texto. Um teste existente de página chama `CodebookReadOnly` diretamente e
precisa trocar a prop (§ 3.4 da Parte 3).

**D6. `PromptEditor` ganha a prop `notice: string | null`.** Com aviso: sem botão "Editar texto"/
"Escrever o prompt", sem formulário, com um `Alert tone="notice"` acima do texto. O botão "Histórico"
fica. Metadados e teste de prompt continuam na página, sem mudança.

**D7. Fora do escopo, registrado para não parecer esquecimento.**

- O tooltip de `VersionStatus` diz, para versão "em aberto", que salvar altera a própria versão. Um
  projeto que avançou para a Fase 4 **antes** da #81 pode ter a vigente em aberto, e o tooltip
  contradiz o aviso. O aviso de congelamento, visível acima, resolve a leitura; não mexer no tooltip
  aqui.
- A linha de composição do `PromptEditor` ("Na chamada real seguem junto: N títulos de definição…")
  descreve a Fase 2 em qualquer fase. É anterior a esta fatia; vale um issue próprio.

---

## 4. Riscos e cuidados

- **Cena no banco quebra teste de integração**: limpar qualquer cena manual (projeto na Fase 4 criado
  para conferir a tela) antes de `npm test`.
- **Sem Prettier, sem comentários novos** no código.
- **Precedência (D2)** é o detalhe que mais facilmente sai errado: há teste dedicado nas Partes 2 e 3.
- **Não mexer em `createRound`**: abrir rodada na Fase 4 é a #82. Aqui a rodada aberta na Fase 4 só
  aparece em teste, semeada por `addRound(…, { phase: PHASE_4 })`, para provar a precedência.

---

# Parte 1 — Regra pura

**Objetivo:** `isFrozen` e `frozenMessage` existem, testadas, sem ninguém usá-las ainda.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `pipeline/preconditions.ts` (constantes e estilo das
mensagens), `(tabs)/rounds/preconditions.ts` (`codebookLockedMessage`) e o teste dela em
`(tabs)/rounds/preconditions.unit.test.ts`.

### 1.1 `pipeline/freeze.ts` (novo)

Conforme D1.

### 1.2 `pipeline/freeze.unit.test.ts` (novo)

- [ ] `isFrozen` é falso nas Fases 1, 2 e 3 e verdadeiro na Fase 4 (`it.each`).
- [ ] As duas mensagens dizem "Fase 4", que ela congela codebook **e** prompt, e "voltar à Fase 3".
- [ ] A do codebook fala em refinar o codebook; a do prompt, em refinar o texto do prompt e diz que os
      metadados continuam editáveis.
- [ ] As duas começam com o mesmo trecho (o "mesmo formato" do AC 2).
- [ ] Nenhuma contém "aprov", "reprov", "replicou", "generaliz" (regex, como nos testes de orientação).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes.

Commit sugerido: `feat(pipeline): regra e mensagens do congelamento da fase 4`.

### O que a Parte 2 herda

- Módulo próprio, como em D1: `app/projects/[id]/pipeline/freeze.ts`. Importar com
  `import { frozenMessage, isFrozen } from './freeze'` em `pipeline/actions.ts`.
- Exporta `isFrozen(phase)` (`phase >= PHASE_4`), `frozenMessage(subject)` e o tipo
  `FrozenSubject = 'codebook' | 'prompt'`.
- Texto final igual ao rascunho de D1. As duas mensagens compartilham o trecho inicial (até
  "…o que a Fase 3 avaliou."), montado a partir de `PHASE_3`/`PHASE_4`.
- Teste: `pipeline/freeze.unit.test.ts`, 12 casos. Suíte completa: 82 arquivos, 1147 testes verdes.
- Nenhuma divergência do plano.

---

# Parte 2 — As actions

**Objetivo:** na Fase 4, o servidor recusa salvar codebook e texto do prompt sem gravar nada; o
resto continua funcionando. Os ACs 1 a 6 e 8 ficam provados por teste de integração.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, o "o que herda" da Parte 1, `pipeline/actions.ts`
(`saveCodebook`, `savePrompt`, `savePromptMetadata`, `createItem`, `withEditableItem`, `testPrompt`),
`(tabs)/rounds/actions.int.test.ts` (helpers do topo e o `it.each` "com rodada aberta, salvar o
codebook é recusado") e `pipeline/prompt-test.int.test.ts` (`readyProject`, `expectedInput`,
`rowCounts`).

### 2.1 `saveCodebook`

Logo depois de `const phase = project?.phase ?? PHASE_1`, **antes** de `loadOpenRound` (D2):

```ts
if (isFrozen(phase)) {
  failure = frozenMessage('codebook')
  return
}
```

Nada mais muda: a recusa sai pelo mesmo `failure` que as outras, sem `revalidatePath`.

### 2.2 `savePrompt`

O `select` sob `for('update')` passa a trazer `phase` (D3). Logo depois, antes de buscar `latest`:
recusar com `frozenMessage('prompt')`. Hoje a action sinaliza recusa com `let stale = false`; trocar
por um `let failure: string | null`, no padrão de `saveCodebook`, para caber as duas recusas sem
segunda variável. A mensagem `PROMPT_STALE` continua a mesma.

### 2.3 O que **não** muda

`savePromptMetadata`, `createItem`, `updateItem`, `deleteItem`, `testPrompt`, `composeLlmInput`.
Se a Parte 2 se pegar mexendo em algum deles, parou de implementar esta issue.

### 2.4 Testes da Parte 2

Arquivo novo `pipeline/phase-4-freeze.int.test.ts`, com helpers copiados de
`(tabs)/rounds/actions.int.test.ts` e `pipeline/prompt-test.int.test.ts`. Fixture base: projeto na
Fase 4 com codebook v1 e prompt v1 **usados** (`usedAt` preenchido) e uma rodada fechada da Fase 3
sobre elas, que é o estado real de um projeto que acabou de avançar.

Codebook (AC 1, 3):

- [ ] Salvar definição nova é recusado com `frozenMessage('codebook')`, e o banco fica igual: mesmas
      versões (contagem, `updatedAt`), mesmas definições, critérios e ordem.
- [ ] O mesmo para alterar só a descrição, só um critério e só a ordem (`it.each` com os quatro
      formulários). É o que prova "definição, descrição, critério ou ordem".
- [ ] Com a vigente **em aberto** (projeto que avançou antes da #81), a recusa vale igual e a versão
      em aberto não é atualizada no lugar.
- [ ] **Precedência (D2):** Fase 4 com rodada aberta (`addRound(…, { phase: PHASE_4 })`) devolve
      `frozenMessage('codebook')`, e **não** `codebookLockedMessage(n)`.
- [ ] O Avaliador continua recebendo a recusa de papel, não a de fase.

Prompt (AC 2, 3, 4):

- [ ] Salvar texto novo é recusado com `frozenMessage('prompt')`; versões, texto e `updatedAt` iguais.
- [ ] Salvar o **mesmo** texto também é recusado (§ 2), e nada muda.
- [ ] Salvar metadados funciona na Fase 4: grava nome, descrição e registro na vigente, sem versão nova.

Itens (AC 5):

- [ ] Cadastrar item funciona na Fase 4 e o item aparece no pool.
- [ ] Item não usado continua editável e removível na Fase 4.
- [ ] Item usado continua recusado em editar e remover, com a mesma mensagem de hoje.

Teste de prompt (AC 6), em `pipeline/prompt-test.int.test.ts`:

- [ ] O caso "na Fase 3 envia o codebook completo da versão vigente" vira `it.each([PHASE_3, PHASE_4])`.
- [ ] O `it.each` "na Fase %i não grava nada" passa a incluir `PHASE_4`.
- [ ] Novo: na Fase 4, com codebook e prompt **usados**, o teste envia o codebook completo da vigente
      e o `usedAt` das duas versões não muda.

Fases 1 a 3 (AC 8):

- [ ] Os testes existentes de `saveCodebook` e `savePrompt` continuam verdes **sem edição**. Se algum
      precisar mudar, é sinal de que a recusa vazou para fora da Fase 4.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com nenhum teste existente editado além do
`prompt-test.int.test.ts` (só parametrização).

Commit sugerido: `feat(pipeline): recusa salvar codebook e texto do prompt na fase 4`.

### O que a Parte 3 herda

- `saveCodebook` checa `isFrozen(phase)` logo depois do `FOR UPDATE`, antes de `loadOpenRound` (D2).
  `savePrompt` seleciona `phase` no `FOR UPDATE` e recusa antes de buscar `latest`; o `let stale`
  virou `let failure: string | null`, e `PROMPT_STALE` sai por ele (D3). Na tela, a precedência é a
  mesma: congelamento antes de rodada aberta.
- Teste novo: `pipeline/phase-4-freeze.int.test.ts`, 14 casos. Além do plano: um caso do prompt com a
  vigente **em aberto** (espelho do caso do codebook), e o caso do Avaliador cobre as duas actions.
- "Mesma mensagem de hoje" para item usado: `ITEM_USED` não é exportada, então o teste compara a
  recusa da Fase 4 com a de um projeto na Fase 2, em vez de importar a constante.
- A fixture "projeto recém-avançado" ficou local ao arquivo (`advancedProject(admin, { phase, used })`):
  Fase 4, codebook v1 e prompt v1 usados e uma rodada fechada da Fase 3. Não virou helper em
  `test/helpers.ts`; a Parte 3 testa por `renderToStaticMarkup` e não precisa dela.
- `prompt-test.int.test.ts`: só parametrização (`PHASE_4` nos dois `it.each`) e um caso novo, que monta
  o próprio projeto com `usedAt`, porque o `readyProject` dali não aceita `usedAt`.
- Nenhum teste existente de `saveCodebook`/`savePrompt` foi editado. Suíte completa: 83 arquivos,
  1164 testes verdes (+17).

---

# Parte 3 — As telas

**Objetivo:** na Fase 4, o Administrador vê codebook e prompt em leitura, com a explicação, e não um
formulário que falha. Metadados, teste de prompt e itens continuam iguais. No fim da Parte, a issue
fecha.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, os dois "o que herda", `pipeline/codebook-editor.tsx`
(`CodebookEditor`, `CodebookReadOnly`), `pipeline/prompt-editor.tsx`, `(tabs)/codebook/page.tsx`,
`(tabs)/prompt/page.tsx` e os testes de página delas (a partir de "com rodada aberta, a tela fica em
leitura" no codebook e de "a tela traz o editor, os dados da versão e o teste" no prompt).

### 3.1 `pipeline/codebook-editor.tsx`

- `CodebookReadOnly`: `openRoundNumber` → `notice: string | null` (D5). Renderiza
  `<Alert tone="notice">{notice}</Alert>` quando houver.
- `CodebookEditor`: calcula o aviso com a precedência de D2:
  `isFrozen(phase) ? frozenMessage('codebook') : openRoundNumber !== null ? codebookLockedMessage(openRoundNumber) : null`.
  Com aviso, devolve `CodebookReadOnly`; sem aviso, o fluxo de hoje.

A página do codebook **não muda**: já passa `phase` e `openRoundNumber`.

### 3.2 `pipeline/prompt-editor.tsx`

Prop nova `notice: string | null` (D6). Com aviso: some o botão de editar/escrever, aparece o
`Alert` acima do `TextFrame`, e o estado `editing` nunca é alcançável.

### 3.3 `(tabs)/prompt/page.tsx`

Passa `notice={isFrozen(project.phase) ? frozenMessage('prompt') : null}` ao `PromptEditor`. Nada
mais. O painel de metadados, o `PromptTest` e o histórico ficam como estão.

### 3.4 Testes da Parte 3

`(tabs)/codebook/page.int.test.ts`:

- [ ] Editar o teste "com rodada aberta, a tela fica em leitura…" para chamar `CodebookReadOnly` com
      `notice: codebookLockedMessage(1)` (única edição de teste existente).
- [ ] **Fase 4**: o `CodebookEditor` recebe `phase: 4`; o HTML renderizado (`renderToStaticMarkup`)
      não tem `<form>`, `<input>`, `<textarea>`, `<select>` nem "Editar definições", mostra as
      definições e contém `frozenMessage('codebook')`.
- [ ] **Fase 4 com rodada aberta**: o aviso é o do congelamento, e o texto não contém "Feche a rodada".
- [ ] **Fases 2 e 3 sem rodada aberta**: "Editar definições" continua lá (pode ser `it.each`).

`(tabs)/prompt/page.int.test.ts`:

- [ ] **Fase 4**: `PromptEditor` recebe `notice === frozenMessage('prompt')`; o HTML não tem
      "Editar texto" nem `<textarea>`, e mostra o texto da vigente e o aviso.
- [ ] **Fase 4**: `PromptMetadataEditor` e `PromptTest` continuam na árvore, e o teste segue `ready`
      com os três insumos.
- [ ] **Fases 1 a 3**: `notice` é `null` (`it.each`).

`(tabs)/items/page.int.test.ts`:

- [ ] **Fase 4**: o editor de itens continua oferecendo cadastrar (sem regressão; um caso basta).

### 3.5 Conferência no navegador

Com o Supabase local e um projeto posto na Fase 4 (por `psql`, ver memória do preview pane): abrir
Codebook, Prompt e Itens como Administrador; conferir aviso, ausência de botão de edição, metadados
salvando e teste de prompt rodando com a LLM falsa (memória "LLM falsa por fetch"). Conferir também
um projeto na Fase 3, para ver que nada mudou. **Apagar a cena antes de `npm test`.**

### 3.6 Varredura dos ACs

Marcar na issue cada AC e cada item de "Testes", apontando o teste que o prova. Todos os oito ACs têm
teste nas Partes 2 e 3; o AC 7 também tem a conferência de 3.5.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; conferência de 3.5 feita; ACs marcados.

Commit sugerido: `feat(pipeline): codebook e prompt em leitura na fase 4`.

### Como ficou

- `CodebookReadOnly` recebe `notice: string | null` (D5); o `CodebookEditor` monta o aviso com a
  precedência de D2. `PromptEditor` ganhou `notice` (D6): com aviso, `editing` é sempre falso, o botão
  some e o `Alert` entra acima do `TextFrame`. A página do prompt passa
  `isFrozen(project.phase) ? frozenMessage('prompt') : null`; a do codebook não mudou.
- Testes: 3 casos novos no codebook (Fase 4; Fase 4 com rodada aberta; `it.each` Fases 2 e 3), 5 no
  prompt (Fase 4 em leitura; Fase 4 com metadados e teste `ready`; `it.each` Fases 1 a 3 com
  `notice === null` e "Editar texto") e 1 nos itens (Fase 4 oferece "Novo item" e edição do não usado).
  Única edição de teste existente: a chamada a `CodebookReadOnly` com `notice`. Suíte: 83 arquivos,
  1174 testes verdes (+10).
- 3.5 conferido com a LLM falsa: na Fase 4, Codebook e Prompt em leitura com o aviso e sem botão de
  edição; metadados salvos na vigente sem versão nova (conferido por `psql`); teste de prompt devolveu
  a resposta falsa; Itens com "Novo item". Na Fase 3, "Editar definições" e "Editar texto" seguem lá.
  Cena apagada.
- Varredura dos ACs: AC 1 e 3 → `phase-4-freeze.int.test.ts` (casos do codebook) e
  `freeze.unit.test.ts`; AC 2 → casos do prompt no mesmo arquivo; AC 4 e 5 → casos de metadados e de
  itens no mesmo arquivo, mais o caso de Itens na Fase 4 em `items/page.int.test.ts`; AC 6 →
  `prompt-test.int.test.ts` (`it.each` com `PHASE_4` e o caso com versões usadas); AC 7 → casos de
  Fase 4 em `codebook/page.int.test.ts` e `prompt/page.int.test.ts`, mais 3.5; AC 8 → testes antigos
  de `saveCodebook`/`savePrompt` sem edição e os `it.each` de Fases 1 a 3 nas páginas.

### O que fica para depois

- D7 está desatualizado num ponto: `promptComposition` já descreve a Fase 3 (codebook completo) desde
  o commit 6cd9100; só o tooltip de `VersionStatus` segue pendente. Na Fase 4 com a vigente
  **congelada**, ele diz "A próxima alteração salva cria a versão 2", o que também contradiz o aviso.
- Quando a #86 (voltar da Fase 4 para a Fase 3) entrar, decidir se `frozenMessage` passa a dizer onde
  fica o retorno.
- D7: tooltip de `VersionStatus` com vigente em aberto na Fase 4 e linha de composição do
  `PromptEditor` desatualizada desde a Fase 3.
