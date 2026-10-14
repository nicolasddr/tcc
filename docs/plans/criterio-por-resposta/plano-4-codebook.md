# Plano 4 — Codebook: mandar à LLM, ler e criar o critério por resposta

Série "Critério por Resposta", plano 4 de 4. Spec: `~/Desktop/spec-criterio-por-resposta-v2.md`
(fora do repo; seções 1 a 5 e 10 são o contexto comum, a 6.4 é a origem deste plano). Escrito em
2026-10-13 contra o `main` em `907184d`, **antes** de os Planos 1, 2 e 3 serem implementados. Os
nomes que vêm deles são os propostos lá:

- do Plano 1 (D4, § 5.2, § 6.4): `Scope`, `CriterionScope = { definitionId, scope }`,
  `isPerResponse`, `perResponseCriteria`, `isScope`; `CodebookCriterion.scope` e
  `LlmCriterion.scope`; a opção `perResponseCriteria` de `addCodebookVersion`; o `insert` de
  `saveCodebook` e o `definitionsWithoutCriteria` dele montando o tipo **a partir de
  `definitionIndex`** (achado 3); o editor com os gerais por `generalCriteria`;
- do Plano 2 (D2, D3, § 7.6): `PER_RESPONSE_LABEL = 'Por resposta'` em `pipeline/criteria.ts`,
  `PER_RESPONSE_KEY` em `evaluate/completeness.ts`, a fórmula de notas com o termo "por resposta"
  (R3), `notesPerResponse` contando a célula por resposta, e o texto proposto do
  `NOTES_PER_RESPONSE_HELP`;
- do Plano 3 (§ 7.9, § 8): nenhum descarte de leitor sobrando, o `QUALITY_POINTS` para trocar e a
  receita da cena de conferência.

**Antes da Parte 1, ler o § 6.6 do Plano 1, o § 7.6 do Plano 2 e o § 7.9 do Plano 3** ("O que o
Plano N herda") e corrigir aqui o que tiver mudado.

**Objetivo:** a ferramenta passa a oferecer o critério por resposta: o Administrador o cria no
editor, ele aparece na leitura do codebook (vigente e congelada) e vai à LLM na Fase 3. Fecha a
série.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Entrada da LLM na Fase 3: bloco "Critérios por resposta" depois dos gerais; verbete *Fase*; emenda à ADR 0002 | `feat(llm): critérios por resposta no codebook da Fase 3` | |
| 2 | Leitura do codebook: bloco próprio na lista de definições (vigente e congelada) e a contagem do card "Critérios" | `feat(codebook): critérios por resposta na leitura` | |
| 3 | Editor e action: bloco no editor, `parseCriteria`/`saveCodebook` com o tipo novo, alterações não salvas; os dois textos que aparecem em todo projeto; fecha a série | `feat(codebook): criar critério por resposta no editor` | |

A ordem acima **inverte a da spec** (6.4: editor, leitura, LLM). É a decisão D1, ⚠.

**Duas decisões ⚠** (D1 e D2), as duas antes da Parte 1. Perguntar as duas de uma vez antes de
editar código, mesmo que o pedido seja só "implemente a Parte 1".

Sem issue no GitHub: os commits não levam `Refs`/`Closes`.

---

## 1. Ponto de partida

Caminhos curtos são relativos a `app/projects/[id]/`.

| Peça | Onde | Nesta série |
|---|---|---|
| Entrada da LLM | `pipeline/llm-input.ts`: `GENERAL_CRITERIA_HEADING` (~14), `LlmCriterion` (~18, com `scope` desde o Plano 1), `codebookBlock` (~56), `composeLlmInput` (~73); chamadores: `testPrompt` (`pipeline/actions.ts` ~835) e `generateResponses` (`(tabs)/rounds/actions.ts` ~340, via `loadRoundComposition` em `pipeline/responses.ts`), os dois com `CodebookCriterion` | Parte 1 |
| Leitura | `pipeline/definition-list.tsx` (lista de definições; o geral aparece **dentro** de cada definição com o selo "Geral", não há bloco de gerais); usada por `CodebookBody` (`codebook-editor.tsx` ~220) e por `(tabs)/codebook/[versionId]/page.tsx` | Parte 2 |
| Cards | `pipeline/criteria-summary.tsx`: `NotesPerResponse` (valor `notesPerResponse`, hint `notesPerResponseFormula`, ⓘ `NOTES_PER_RESPONSE_HELP`) e o card "Critérios" (hint `próprios · gerais`, com `own = criteria.length - general`, ~40) | Parte 2 (contagem), Parte 3 (ⓘ) |
| Action | `pipeline/actions.ts`: `ParsedCriterion` (~78, `definitionIndex: number \| null`), `GENERAL_SCOPE` (~106), `parseCriteria` (~108), `saveCodebook` (~218; `definitionsWithoutCriteria` ~256, `insert(codebookCriteria)` ~349) | Parte 3 |
| Editor | `pipeline/codebook-editor.tsx`: `changesLabel` (~129, privado), `generalScopeLabel` (~184), `CriterionFields` (~247, campo oculto `criterion_scope`), `CodebookFields` (~410: estado `initial`/`general`, `uncovered`, `summaryCriteria`, bloco "Critérios gerais" ~679, `SaveBar`) | Parte 3 |
| Textos de todo projeto | `NOTES_PER_RESPONSE_HELP` (`pipeline/criteria.ts` ~57), `QUALITY_POINTS` (`(tabs)/rounds/quality-labels.ts` ~23) | Parte 3 |
| Testes | `llm-input.unit`, `prompt-test.int`, `(tabs)/rounds/generate-responses.int`, `(tabs)/codebook/page.int`, `pipeline/actions.int` (describe "critérios do codebook", ~2392), `criteria.unit` (~197), `(tabs)/rounds/quality-labels.unit` (~130–170) | as três Partes |

---

## 2. O que a revisão da spec achou

Achados desta revisão contra o código, além dos da seção 4 da spec. Os que mudam a spec estão
repetidos nela (seção 4, itens 41 a 51).

1. **Os Planos 1, 2 e 3 ainda não foram implementados.** Ver o aviso do topo.
2. **Na ordem da spec, a `main` fica dois commits num estado que a série quis evitar.** Com o
   editor na Parte 1, a ferramenta já cria critério por resposta, mas:
   - a leitura do codebook não o mostra (`DefinitionList` só percorre definições): o Administrador
     salva, a tela volta à leitura e o critério some dela, embora esteja no banco;
   - a rodada da Fase 3 não o manda à LLM (`codebookBlock` só tem os blocos de definição e de
     gerais, e desde o Plano 1 `generalCriteria` filtra pelo tipo). A Resposta grava a entrada
     enviada (`responses.sent_input`, ADR 0002): uma rodada gerada entre as Partes fica, para
     sempre, com uma entrada sem o critério que o codebook dela tinha.
   É o mesmo raciocínio da seção 6 da spec, que deixa a tela de criar por último. D1.
3. **`saveCodebook` deriva o tipo de `definitionIndex` em dois lugares desde o Plano 1** (§ 5.5 e
   § 6.4 dele): o `insert` (`definitionIndex === null ? 'general' : 'specific'`) e o
   `definitionsWithoutCriteria` da validação de R4. Se o valor novo for aceito só em
   `parseCriteria`, com `definitionIndex: null`, o critério por resposta é **gravado como geral** e
   **cobre** as definições sem critério (R4 quebrado no servidor), sem erro e sem aviso do `tsc`.
   D3: `ParsedCriterion` passa a carregar o tipo, e os dois lugares leem dele. O mesmo vale para a
   numeração (`orderIndex`), que hoje usa a chave `general` para todo critério sem definição.
4. **O card "Critérios" conta o próprio como `criteria.length - general`** (`criteria-summary.tsx`
   ~40): com um critério por resposta, o hint diria "1 próprio · 1 geral" num codebook sem
   critério próprio. É o achado 16 da spec (que o Plano 1 corrigiu na fórmula), noutra tela, e o
   Plano 1 não o lista.
5. **A leitura não tem bloco de gerais.** O geral aparece dentro de cada definição, com o selo
   "Geral". O bloco por resposta é o primeiro que fica fora das definições: entra no fim de
   `DefinitionList`, que serve às duas telas de leitura (D4).
6. **O editor tem um resumo próprio**, montado das linhas do formulário (`summaryCriteria`, ~502),
   e não de `criteria`. Sem as linhas por resposta, o card "Notas por resposta" diria 5 em edição e
   6 em leitura no mesmo codebook do PoC.
7. **`changesLabel` é privado e sem teste** (nenhum teste afirma "critérios gerais alterados"), e o
   estado sujo só muda por interação. Sem biblioteca de DOM no repo, R6 só se prova exportando a
   função (D5).
8. **Os testes de integração da entrada usam `composeLlmInput` como oráculo** (`expectedInput` em
   `prompt-test.int` ~185 e em `generate-responses.int`): ficam verdes com ou sem o bloco. O
   vermelho da Parte 1 tem que vir de afirmar o bloco literal.
9. **Textos de todo projeto que continuam verdadeiros e não mudam:** `roundInputSummary` da Fase 3
   ("… com descrição e critérios, inclusive os critérios gerais"), o hint da página do codebook ("os
   critérios com que ele julga"), `prompt-editor.tsx` e `prompt-test.tsx` ("títulos, descrições e
   critérios"), `missingCriteriaMessage` e as mensagens de precondição da rodada (o critério por
   resposta não cobre definição, R4). Nenhum nega o critério por resposta.
10. **Os textos que só ficam errados com critério por resposta, e que aparecem em todo projeto**,
    são dois: `NOTES_PER_RESPONSE_HELP` ("e não uma nota por resposta", afirmado em `criteria.unit`
    ~201) e `QUALITY_POINTS` ("Cada nota é uma célula (definição × critério)"; os testes afirmam
    até 40 palavras por ponto e "não o de respostas", e os de página comparam com a constante, sem
    quebrar). Pela regra da spec 7.1, entram **com a tela que cria**: com D1, a Parte 3.
11. **A mensagem de escopo inválido omite um tipo**: "Todo critério precisa pertencer a uma
    definição ou ser geral." O teste ~2950 afirma só `'definição'`.
12. **`loadRoundComposition` e `loadCodebook` já passam o tipo à LLM** (os dois usam
    `loadCriteria`, que seleciona `scope` desde o Plano 1): a Parte 1 só mexe em `llm-input.ts`.

---

## 3. Decisões

**D1 ⚠. Ordem das Partes** (achado 2). Duas saídas:

- **(a) recomendada, a tela de criar por último**: Parte 1 a entrada da LLM, Parte 2 a leitura,
  Parte 3 o editor e a action, com os dois textos de todo projeto (achado 10). Até a Parte 3 nenhum
  critério por resposta chega ao banco pela ferramenta, então as Partes 1 e 2 não mudam nada
  visível num projeto real; cada uma se confere com a cena montada à mão, como nos Planos 2 e 3.
- **(b) a ordem da spec** (editor, leitura, LLM): os textos de todo projeto ficam na Parte 2, como
  a spec diz. Custo: o achado 2 por dois commits, inclusive em produção, se a `main` for
  publicada entre as Partes.

Recomendação: **(a)**. Com (b), as seções 5, 6 e 7 valem na ordem 7, 6, 5, e o § 7.3 vai para a
Parte de leitura.

**D2 ⚠. Textos** (spec 7.1, a parte do Plano 4). Regra da série: texto que só aparece quando existe
critério por resposta entra na Parte da tela; texto que aparece em todo projeto entra com a tela
que cria (Parte 3).

- **Cabeçalho na entrada da LLM** (R8). Duas opções:
  - a da spec (R8, seção 9): `Critérios por resposta:`;
  - **recomendada**, em paralelo com o cabeçalho dos gerais: `Critérios por resposta, que valem
    para a resposta inteira:`. O dos gerais diz à LLM onde a regra vale ("que valem para todas as
    definições"); sem o complemento, "por resposta" fica sem o mesmo apoio.
  A constante é `PER_RESPONSE_CRITERIA_HEADING`, em `llm-input.ts`. A escolha muda o R8 e o
  exemplo da seção 9 da spec, e entra na emenda à ADR 0002.
- **Título do bloco** no editor e na leitura: `Critérios por resposta`, numa constante
  `PER_RESPONSE_CRITERIA_LABEL` em `pipeline/criteria.ts`, ao lado do `PER_RESPONSE_LABEL`.
- **Editor**:
  - ⓘ do título (18 palavras): `Valem para a resposta inteira, e não para uma definição: cada um
    rende uma nota só por resposta.`
  - rótulo do campo `Nome do critério por resposta`; botão `Adicionar critério por resposta`;
    vazio `Nenhum critério por resposta nesta versão.`
  - `changesLabel`: `critérios por resposta alterados`, depois de `critérios gerais alterados`.
- **Leitura**: debaixo do título, `Julgam a resposta inteira: uma nota por resposta, sem
  definição.`; depois, nome e descrição de cada critério, no mesmo desenho dos critérios dentro da
  definição, sem selo.
- **Card "Critérios"**: o hint ganha `· N por resposta` **só quando há critério por resposta**
  (`0 próprios · 1 geral · 1 por resposta`); sem ele, igual ao de hoje.
- **Escopo inválido** (achado 11): `Todo critério precisa pertencer a uma definição, ser geral ou
  ser por resposta.`
- **`NOTES_PER_RESPONSE_HELP`** (texto do Plano 2, 24 palavras): `Cada critério geral vira uma nota
  em cada definição; cada critério por resposta, uma nota só. É o esforço do avaliador a cada
  resposta.`
- **`QUALITY_POINTS`, primeiro ponto** (33 palavras): `Cada nota é uma célula avaliada por um
  avaliador numa resposta: definição × critério, ou só o critério, quando ele é por resposta. O
  total é o número de notas, não o de respostas.`
- **Glossário**: § 5.4.

**D3. O tipo no parse** (achado 3). `ParsedCriterion` troca `definitionIndex: number | null` por
`{ scope: Scope; definitionIndex: number | null }`, com `definitionIndex` preenchido só em
`specific`. O valor de formulário de cada tipo:

- índice da definição → `specific`;
- `general` (o `GENERAL_SCOPE` de hoje) → `general`;
- `per_response` → `per_response`, numa constante irmã (`PER_RESPONSE_SCOPE`), no lugar onde o
  Plano 1 tiver deixado o `GENERAL_SCOPE` (ver o handoff dele);
- qualquer outro → a mensagem de escopo inválido.

A chave da numeração passa a ser o tipo (`general`, `per_response`) ou o índice. O `insert` grava
`scope: criterion.scope`, e o `definitionsWithoutCriteria` de `saveCodebook` monta
`{ definitionId, scope: criterion.scope }`: os dois deixam de derivar o tipo de `definitionIndex`.
A coerência continua garantida também pelo CHECK `cc_scope_definition` do Plano 1.

**D4. Onde mora o bloco de leitura.** No fim de `DefinitionList`, só quando
`perResponseCriteria(criteria)` não é vazio. Assim as duas telas de leitura (a vigente, por
`CodebookBody`, e a versão congelada) o recebem sem mudança nelas, e os testes que chamam
`DefinitionList(props)` direto já o enxergam. O componente passa a devolver a lista e o bloco
juntos; o espaçamento segue o da lista (decidir lendo o pai).

**D5. `changesLabel` exportado**, com um parâmetro a mais (`perResponseChanged`, entre
`generalChanged` e `noteChanged`), e testado em `(tabs)/codebook/page.int.test.ts`, que já importa
o editor (importá-lo num `*.unit` puxaria `actions.ts` e o banco). É o idioma do `ORDER_HELP`, já
exportado para teste.

**D6. Mover um critério entre blocos fica fora** (spec 7.5): só criar no bloco certo e remover do
outro, como entre específico e geral.

---

## 4. Gotchas

- **Docker Desktop antes de tudo.**
- **`scores` inteira vazia antes do `npm test`.** Nas Partes 2 e 3, limpar a cena do navegador
  antes da suíte (§ 8), e não semear com a suíte rodando.
- **Não salvar o codebook da cena nas Partes 1 e 2**: até a Parte 3, o editor não carrega o
  critério por resposta, e salvar o descarta (achado 18 da spec). A regra cai com a Parte 3.
- **TDD**: ler a **mensagem** de cada vermelho e contar quais asserções rodaram; asserções depois
  da primeira falha não rodaram (`it` separados, ou mutação depois do verde). Vermelho de import não
  prova regra, e o Vitest não confere tipos.
- **`npm run typecheck` depois da última edição de teste.**
- **Antes de prever testes antigos editados**, buscar as frases que mudam: `e não uma nota por
  resposta`, `(definição × critério)`, `ou ser geral`, `critérios gerais alterados`, `próprios ·`,
  e o prefixo cortado (`'pertencer a uma defini'`).
- **`markupTextOf`/`textOf` leem o balão do ⓘ e o corpo de `<details>` fechado**: afirmar a ordem
  do bloco por posição no markup, e não por ausência de texto.
- **Contar palavras dos ⓘ novos** (até 25): o teste do editor só confere os da leitura.
- **Sem comentários novos no código; sem `npx prettier`.**
- **Desfazer mutação por `cp`/`sed` inverso, nunca `git checkout`.**

---

## 5. Parte 1 — Entrada da LLM na Fase 3

**Antes de começar:** ler os três handoffs e perguntar D1 e D2. Este texto assume D1 = (a) e o
cabeçalho recomendado; com o da spec, só a constante muda.

**Ler antes:** `pipeline/llm-input.ts` e `llm-input.unit.test.ts` inteiros; `prompt-test.int` até
o primeiro `it` (`readyProject`, `expectedInput`) e "na Fase %i envia o codebook completo…"
(~308); `generate-responses.int` (`openRound` ~128, `sentInputsOf` ~188) e "a rodada da Fase 3
manda o codebook completo…" (~434); a emenda de 2026-09-22 da ADR 0002.

### 5.1 Composição (TDD, unitário) — `llm-input.unit.test.ts`

Constante do PoC no molde de `PHASE_3_PARTS`/`PHASE_3_INPUT`: cinco definições `Query 1`…`Query 5`
com as descrições da seção 9 da spec (`The 1st generated query.` …), `Relevance` geral e
`Diversity` por resposta, com descrição curta no lugar das perguntas do artigo, e o item `Which
major cities get more international arrivals than Paris?`. Um `it` por caso:

- [ ] **PoC, byte a byte**: `composeLlmInput` na Fase 3 é igual ao exemplo da seção 9 (com o
      cabeçalho de D2).
- [ ] **Posição**: o bloco vem depois do de gerais e antes do item, uma vez só; com dois critérios
      por resposta, na ordem recebida.
- [ ] **Sem geral**: o bloco vem logo depois da última definição, separado por linha vazia.
- [ ] **Sem critério por resposta, sem cabeçalho**: `PHASE_3_INPUT` não contém
      `PER_RESPONSE_CRITERIA_HEADING`.
- [ ] **Critério por resposta sem descrição** vai só com o nome, sem os dois-pontos.
- [ ] **R7**: nas Fases 1 e 2, a entrada do PoC é a de hoje (só os títulos): nem o nome nem a
      descrição do `Diversity`.

Vermelho esperado: o bloco não existe (o critério por resposta some da entrada desde o Plano 1),
então os casos de igualdade e de posição falham por asserção. `PER_RESPONSE_CRITERIA_HEADING` é
vermelho de import: criar a constante (vazia de uso) antes de rodar. O de R7 e o "sem cabeçalho"
são guardas, verdes desde o começo.

### 5.2 Teste de prompt e rodada (TDD, integração)

Achado 8: afirmar o bloco literal, `` `${PER_RESPONSE_CRITERIA_HEADING}\n- Diversity: …` ``, e não
só a igualdade com `expectedInput`.

- [ ] `prompt-test.int`: `readyProject` aceita `perResponseCriteria`. Na Fase 3, a entrada mandada
      à LLM traz o bloco uma vez; na Fase 2, nem o nome do critério.
- [ ] `generate-responses.int`: `openRound` aceita `perResponseCriteria`. A rodada da Fase 3 grava
      em `sent_input` a entrada com o bloco, igual à que foi à LLM.

Vermelho esperado: o bloco ausente (asserção). O da Fase 2 é guarda.

### 5.3 Código — `pipeline/llm-input.ts`

`PER_RESPONSE_CRITERIA_HEADING` (D2); em `codebookBlock`, depois do bloco de gerais, o bloco de
`perResponseCriteria(criteria)` com `criterionLine`, só quando não é vazio. Nada mais muda: os
chamadores já passam o tipo (achado 12).

### 5.4 Docs

- `docs/CONTEXT.md`, verbete **Fase**, item *Fase 3* (tracked, entra no commit): "… mais os
  critérios gerais uma vez só; o tipo da definição e a escala não vão." → "… mais os critérios
  gerais uma vez só e, num bloco próprio, os critérios por resposta; o tipo da definição e a escala
  não vão."
- **Emenda à ADR 0002** (gitignored, fora do commit): a forma do codebook na Fase 3 ganha o bloco
  por resposta, com o cabeçalho escolhido em D2; as Respostas anteriores continuam com a entrada
  que gravaram.

### 5.5 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- Nenhuma tela mudou (nenhum critério por resposta chega ao banco pela ferramenta): sem navegador.
- Testes antigos editados: nenhum (só os helpers `readyProject`/`openRound`, sem asserção mudada).

### 5.6 O que a Parte 2 herda

Feita em 2026-10-14, sem commit no momento da escrita. `npm run lint`, `npm run typecheck` e
`npm test` (108 arquivos, 1657 testes) verdes.

- **D1 = (a) e D2 com o cabeçalho recomendado**, confirmadas pelo usuário antes do código; os
  demais textos de D2 ficam como escritos em § 3.
- **Cabeçalho final**: `PER_RESPONSE_CRITERIA_HEADING = 'Critérios por resposta, que valem para a
  resposta inteira:'`, em `llm-input.ts`. Em `codebookBlock`, o bloco de `perResponseCriteria`
  vem depois do de gerais, só quando não é vazio. Os chamadores não mudaram (achado 12 confirmado).
- **Correção do topo pelos handoffs** (§ 5.10 e § 6.6 do Plano 1): o tipo gravado já não é derivado
  em linha. `saveCodebook` usa `scopeOf(definitionIndex)` (privada em `pipeline/actions.ts`, ~108)
  no `insert` e no `definitionsWithoutCriteria`; a chave da numeração em `parseCriteria` (~159) e
  os dois `definitionId` (~277 e ~358) ainda comparam `definitionIndex === null`. D3 troca o
  `scopeOf` pelo `criterion.scope`; o `grep` de § 7.7 continua achando os `definitionId`, que não
  derivam tipo. `GENERAL_SCOPE` é privado, ~106.
- **Testes novos**: em `llm-input.unit`, o `describe` "composeLlmInput com critério por resposta"
  (8 `it`: PoC byte a byte, posição, dois critérios na ordem, sem geral, sem cabeçalho, sem
  descrição e R7 nas Fases 1 e 2); em `prompt-test.int`, Fase 3 com o bloco e Fase 2 sem o nome;
  em `generate-responses.int`, a rodada da Fase 3 com o bloco gravado em `sent_input`.
- **Testes antigos editados**: só os helpers (`readyProject` e `openRound` aceitam
  `perResponseCriteria`); nenhuma asserção mudou.
- **Vermelhos**: 5 unitários e 2 de integração, todos por asserção (bloco ausente); a igualdade com
  `expectedInput` passou antes do código, como o achado 8 previa. Guardas verdes desde o começo
  (sem cabeçalho, R7, Fase 2). No "uma vez só", só a primeira asserção rodou antes do código.
- **Mutações** (desfeitas por `cp`): bloco antes dos gerais derruba 6 (PoC, posição, os
  literais); bloco duas vezes derruba 6 (as contagens e os literais); cabeçalho sempre derruba a
  guarda "sem cabeçalho" e 4 antigos; o cabeçalho nos títulos da Fase 2 derruba os dois de R7, o
  de `prompt-test.int` e os dois antigos byte a byte das Fases 1 e 2. A gravação em `sent_input` não foi mutada: é a mesma fiação que o caso da
  Fase 4 já cobre.
- **Divergências do plano**: nenhuma além da correção acima. O `NOTES_PER_RESPONSE_HELP` (que o
  § 7.6 do Plano 2 mandou para "a Parte 2") e o "não salvar o codebook da cena" (que o § 7.9 do
  Plano 3 dá por encerrado "depois da Parte 1") ficam na Parte 3, por D1 = (a).

---

## 6. Parte 2 — Leitura do codebook

**Ler antes:** `definition-list.tsx`, `criteria-summary.tsx`, `codebook-editor.tsx`
(`CodebookBody`, ~220–245), `(tabs)/codebook/[versionId]/page.tsx`; em
`(tabs)/codebook/page.int.test.ts`, os helpers (~60–136) e os casos "a tela abre em leitura…"
(~433) e "a versão em leitura traz o critério geral dentro de cada definição" (~845).

### 6.1 Telas (TDD, integração) — `(tabs)/codebook/page.int.test.ts`

Cena de teste: projeto na Fase 2, duas definições sem critério próprio, `Clareza` geral e
`Diversity` por resposta com descrição (pelo `perResponseCriteria` do helper). Um `it` por caso:

- [ ] **Leitura vigente**: no markup do `CodebookEditor` em leitura, o título `Critérios por
      resposta` vem depois do título da última definição; o nome e a descrição do `Diversity`
      aparecem uma vez cada, depois do título; o selo `Geral` aparece duas vezes (o `Clareza`, uma em
      cada definição), e não três.
- [ ] **Versão congelada**: `textOf(DefinitionList(props))` da página da versão traz o bloco, com o
      `Diversity` uma vez.
- [ ] **Card "Critérios"**: o hint é `0 próprios · 1 geral · 1 por resposta`. No mesmo markup, o
      card "Notas por resposta" diz 3 e `2 definições × 1 critério geral + 1 por resposta` (guarda:
      verde desde o Plano 2).
- [ ] **Sem critério por resposta, nada novo**: na cena de "a versão em leitura traz o critério
      geral…", nem o título do bloco nem `por resposta` no hint (`1 próprio · 1 geral`).

Vermelho esperado: o título do bloco ausente (asserção); o hint diz `1 próprio · 1 geral`
(achado 4). As asserções de dentro do bloco só rodam depois do verde da primeira; o último caso é
guarda e só prova depois do código: mutar o "só quando há critério por resposta" para sempre.

### 6.2 Código

- `pipeline/criteria.ts`: `PER_RESPONSE_CRITERIA_LABEL` (D2).
- `definition-list.tsx`: D4, com o texto de D2.
- `criteria-summary.tsx`: o próprio contado sem os gerais **e** sem os por resposta
  (`perResponseCriteria`); o hint com `· N por resposta` só quando N > 0.

### 6.3 Conferência no navegador

Cena do § 8 (montada à mão). No `tcc-dev-local`, aba Codebook, logado como o Administrador:

- em leitura, o bloco "Critérios por resposta" depois da última Query, com a descrição do
  `Diversity`; os cards dizem 6 notas e `0 próprios · 1 geral · 1 por resposta`;
- a página da versão (pelo histórico) mostra o mesmo bloco;
- a 375 px, o bloco não estoura a largura.

**Não clicar em Editar e salvar.** Apagar a cena (§ 8) antes do `npm test`.

### 6.4 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- Conferência do § 6.3 feita, cena apagada.
- Testes antigos editados: nenhum.

### 6.5 O que a Parte 3 herda

(preencher ao fim da Parte 2: o desenho final do bloco e onde ficou o rótulo; divergências)

---

## 7. Parte 3 — Editor e action

**Ler antes:** `pipeline/actions.ts` (~72–170 e ~218–360), `codebook-editor.tsx` inteiro; em
`pipeline/actions.int.test.ts`, `fd`/`criteriaOf` (~84–150) e o describe "critérios do codebook"
(~2392–3130); em `(tabs)/codebook/page.int.test.ts`, "em edição, só a barra de salvar…" (~489) e
"os ⓘ do editor…" (~319); `criteria.unit` ~197; `quality-labels.unit` ~130–170.

### 7.1 Action (TDD, integração) — `pipeline/actions.int.test.ts`

`CriterionInput.scope` aceita `'per_response'`; `criteriaOf` seleciona `scope`. No describe
"critérios do codebook", um `it` por caso:

- [ ] **Grava o critério por resposta**: com uma definição, um específico e `Diversity` por
      resposta, o salvamento passa; o `Diversity` tem `scope` `per_response` e `definitionId` nulo;
      `loadCodebook` o devolve, e `notesPerResponse` conta 2.
- [ ] **Cada tipo numera do zero**: um geral e dois por resposta → `orderIndex` `[0]` no geral e
      `[0, 1]` nos por resposta, na ordem enviada.
- [ ] **R4**: duas definições, nenhuma com critério, só um por resposta → a mensagem de
      `missingCriteriaMessage` com as duas, e nenhuma versão gravada.
- [ ] **R1, trava de fase**: na Fase 1, só um critério por resposta → `CRITERIA_TOO_EARLY`, nada
      gravado.
- [ ] **R5**: versão congelada (helper, `usedAt`) com uma definição, `Clareza` geral e o
      `Diversity` por resposta; salvar com os dois e
      um por resposta novo cria a versão 2, com os dois por resposta (`scope`, definição nula); a
      versão 1 continua com um só.
- [ ] **Remover**: salvar a versão em aberto sem o por resposta apaga o critério (guarda).
- [ ] **Escopo desconhecido** (`per-response`, `Por resposta`) → a mensagem nova de D2, nada
      gravado.

Vermelho esperado, em dois tempos (achado 3):

1. Antes de qualquer código, `per_response` vira `NaN` em `parseCriteria`: os cinco primeiros
   recebem a mensagem de escopo inválido (asserção, pelo `ok: true` esperado ou pela mensagem
   errada). O de escopo desconhecido falha pela frase antiga.
2. **Fazer primeiro só a leitura do valor** em `parseCriteria` (o `scope` no `ParsedCriterion`),
   sem mexer na chave da numeração nem em `saveCodebook`, e rodar de novo: com a chave e com o
   `insert` e o `definitionsWithoutCriteria` ainda derivando de `definitionIndex`, o primeiro caso grava
   `general`, o de R4 passa (`ok: true`) e o da numeração dá `[0]`/`[1, 2]`. **É esse vermelho que
   prova D3**: ler as três mensagens e dizer no resumo. Depois, o resto de D3.

### 7.2 Editor (TDD, integração) — `(tabs)/codebook/page.int.test.ts`

Render de `CodebookFields` no molde de ~489, com a cena do § 6.1. Um `it` por caso:

- [ ] **O bloco**: no markup, o título `Critérios por resposta` vem depois de `Critérios gerais` e
      antes de `Observação desta versão`; o campo com `value="Diversity"` está depois do título; há
      um único `name="criterion_scope" value="per_response"`; o ⓘ do título é o de D2 e tem até 25
      palavras; o `Diversity` não está no "Herdados dos critérios gerais" de nenhuma definição.
- [ ] **O resumo em edição conta o por resposta** (achado 6): o card "Notas por resposta" diz 3,
      como na leitura.
- [ ] **Bloco vazio e fase**: sem critério por resposta, o bloco aparece com `Nenhum critério por
      resposta nesta versão.`; com `inPhase2: false`, não aparece.
- [ ] **R6** (D5): `changesLabel(0, false, true, false)` é `Alterações não salvas: critérios por
      resposta alterados.`; com tudo verdadeiro, a ordem é definições, gerais, por resposta,
      observação.

Vermelho esperado: o título do bloco ausente e o card em 2 (asserção). Para R6, **exportar
`changesLabel` antes** e rodar: com a assinatura antiga, o terceiro argumento vira o
`noteChanged`, e a frase sai `observação alterada` (asserção). As asserções de dentro do bloco só
rodam depois do verde da primeira.

### 7.3 Textos de todo projeto (TDD, unitário)

- [ ] `criteria.unit` › "o ⓘ do card fica em até 25 palavras…": trocar `'e não uma nota por
      resposta'` por `'cada critério por resposta, uma nota só'` (continua até 25 palavras).
- [ ] `quality-labels.unit` › "a explicação diz o que o número é…": `QUALITY_POINTS.join(' ')`
      contém `'quando ele é por resposta'` e continua com `'não o de respostas'`.

Vermelho esperado: as duas frases novas ausentes (asserção). Os testes de página que comparam
`more` com `QUALITY_POINTS` não mudam.

### 7.4 Código

Ordem: o parse logo depois do primeiro vermelho de § 7.1; o resto de D3 depois do segundo; o
editor depois do vermelho de § 7.2; os textos depois do de § 7.3.

- `pipeline/actions.ts`: D3 e a mensagem de escopo inválido.
- `codebook-editor.tsx`:
  - estado `perResponse`, inicial por `perResponseCriteria(criteria)`, no `initial`, no `discard` e
    no `dirty`;
  - bloco "Critérios por resposta" logo depois do de gerais, só em `inPhase2`: `SectionTitle` com o
    ⓘ de D2 e `CriterionFields` com `scope="per_response"` e os textos de D2;
  - `summaryCriteria` com as linhas por resposta (`{ definitionId: null, scope: 'per_response' }`);
  - `changesLabel` exportado, com `perResponseChanged` (D5).
- `pipeline/criteria.ts`: `NOTES_PER_RESPONSE_HELP` (D2).
- `(tabs)/rounds/quality-labels.ts`: `QUALITY_POINTS` (D2).

### 7.5 Docs

- **ADR 0013** (gitignored, fora do commit): acrescentar a decisão de D6 (mover entre blocos fica
  fora) e que o critério por resposta é criado no editor, num bloco próprio.
- `docs/CONTEXT.md`: nenhum verbete muda (o de *Critério* veio no Plano 1).

### 7.6 Conferência no navegador

Sem cena montada à mão: a partir daqui o critério nasce pela ferramenta. No `tcc-dev-local`,
projeto novo do usuário do `/dev/login` na Fase 2, sem rodada:

- editar o codebook: cinco Queries, `Relevance` geral; no bloco "Critérios por resposta",
  `Diversity` com descrição. A barra diz `critérios por resposta alterados`; o card em edição vai a
  6 notas;
- tentar salvar com uma Query sem critério e sem o geral: a recusa nomeia a Query, apesar do por
  resposta (R4);
- salvar; a leitura mostra o bloco; editar de novo carrega o `Diversity` no bloco certo; remover e
  salvar tira o bloco da leitura;
- opcional, com a LLM falsa (memória `llm-falsa-por-fetch-no-dev-local`): com o projeto na Fase 3,
  o teste de prompt mostra o bloco na entrada;
- a 375 px, o bloco do editor não estoura a largura.

Apagar o projeto de conferência (ordem da memória `cena-no-banco-quebra-int-test`), conferir
`scores` vazia e só então rodar `npm test`.

### 7.7 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -rn "definitionIndex === null" "app/projects/[id]/pipeline/actions.ts"` não acha derivação
  de tipo.
- Conferência do § 7.6 feita, projeto apagado.
- Testes antigos editados: os dois de § 7.3 (listar no resumo).

### 7.8 Fecho

A Parte 3 **fecha a série**. Sem issue no GitHub, sem `Closes`; o corpo do commit diz que a série
termina aqui. Depois dela:

- a regra "não salvar o codebook da cena" deixa de existir;
- a exportação CSV (#67, #78) pode ser planejada com R23 nos critérios de aceite (spec 6.5).

---

## 8. Cena de conferência (Parte 2)

A do § 8 do Plano 3, reduzida ao codebook: por Vitest descartável (memória
`vitest-como-runner-de-seed`), com a suíte parada e o banco sem projetos antes de semear:

- o usuário do `/dev/login` como Administrador; projeto na Fase 2;
- codebook do PoC pelo `perResponseCriteria` do helper, em duas versões: a 1 com `usedAt`
  (congelada, para a página da versão) e a 2 vigente, as duas com `Query 1`…`Query 5`, `Relevance`
  geral e `Diversity` por resposta com descrição.

Sem rodada, sem avaliação. **Não salvar o codebook.** Depois: apagar o projeto e o arquivo de seed,
conferir `scores` vazia e só então rodar `npm test`.

---

## 9. Fora deste plano

- Mover um critério entre blocos no editor (D6, spec 7.5).
- Os textos de todo projeto que continuam verdadeiros (achado 9).
- Mostrar a descrição de um critério geral uma vez só no formulário (adiado pelo usuário).
- A exportação CSV (spec 6.5).
