# Descrição de cada nível da escala, por critério

Escrito em 2026-10-19 contra o `main` em `7714cd0`. Sem issue no GitHub: os commits não levam
`Refs`/`Closes`.

**Objetivo:** cada critério do codebook pode ter uma descrição para Alto, outra para Médio e outra
para Baixo (âncoras da régua: "Relevância: Alto = a query mantém a intenção da pergunta…"). Na tela
de avaliação, passar o mouse (ou o foco do teclado) num botão de nível mostra a descrição daquele
nível; o nível já escolhido mostra a sua descrição abaixo dos botões, o que cobre o toque.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Banco e servidor: três colunas em `codebook_criteria`, leitura em `loadCriteria`, gravação em `saveCodebook`, limite, glossário | `feat(codebook): gravar a descrição de cada nível do critério` | |
| 2 | Editor e leitura do codebook: três campos por critério, detecção de alteração, lista somente leitura | `feat(codebook): descrever Alto, Médio e Baixo em cada critério` | |
| 3 | Tela de avaliação: balão no hover/foco de cada botão, descrição do nível escolhido abaixo dos botões | `feat(avaliar): mostrar a descrição do nível ao passar o mouse` | |

A Parte 1 não muda nada visível: nenhum formulário manda os campos novos ainda e nenhuma tela os
lê. A Parte 2 só mexe no editor e na leitura do codebook. A Parte 3 só mexe no formulário de
avaliação. As Partes 2 e 3 dependem da 1, mas não uma da outra.

**Decisões ⚠ D1 e D2 confirmadas pelo usuário em 2026-10-19**, ambas na opção recomendada: as
descrições são **por critério** (versionam com o codebook), e fora do mouse a descrição do nível
**selecionado** aparece abaixo dos botões. Não perguntar de novo.

---

## 1. Ponto de partida

| Peça | Onde | Nesta série |
|---|---|---|
| Escala | `(tabs)/evaluate/scale.ts`: `SCALE = ['high','medium','low']`, `scaleLabel`, `scaleRank`. Fixa (ADR 0010) | não muda |
| Tabela | `lib/db/schema.ts` ~273 `codebookCriteria`: `name`, `description` (CHECK ≤ 2000), `scope`, `perResponse` gerado | Parte 1 |
| Leitura | `pipeline/codebook.ts`: tipo `CodebookCriterion`, `loadCriteria` (usado por `loadCodebook` e `loadCodebookVersion`) | Parte 1 |
| Gravação | `pipeline/actions.ts`: `parseCriteria` (~115, arrays paralelos `criterion_name`/`criterion_scope`/`criterion_description`), insert em `codebookCriteria` (~365). Salvar apaga e regrava os critérios da versão | Parte 1 |
| Entrada da LLM | `pipeline/llm-input.ts`: `criterionLine` manda `nome: descrição` na Fase 3+ | Parte 1 só acrescenta um teste (D4) |
| Limites | `lib/limits.ts`: `CRITERION_NAME_MAX` 200, `CRITERION_DESCRIPTION_MAX` 2000 | Parte 1 |
| Editor | `pipeline/codebook-editor.tsx`: `CriterionRow`, `newCriterion`, `toCriterionRows`, `serializeCriteria` (~108, base do "alterações não salvas"), `CriterionFields` (~256), `InheritedCriteria` (~388) | Parte 2 |
| Leitura do codebook | `pipeline/definition-list.tsx`: `criterionItem` (~95); usada pelo editor fechado e por `(tabs)/codebook/[versionId]/page.tsx` | Parte 2 |
| Avaliação | `(tabs)/evaluate/page.tsx` carrega a versão do codebook **da rodada** via `loadCodebookVersion` → `resolveCells`; `evaluation-form.tsx` desenha os botões de `SCALE` (~330) | Parte 3 |
| Balão | `app/components/ui/tooltip.tsx`: `InfoTooltip` (hover só com `pointerType === 'mouse'`, clique abre, Esc fecha, balão `display:none` fechado) | Parte 3 reaproveita o estilo |
| Testes | `pipeline/actions.int.test.ts` (helper ~110 monta o form; `rawCriteria`), `phase-4-freeze.int.test.ts` ~91, `llm-input.unit.test.ts`, `(tabs)/evaluate/page.int.test.ts`, `(tabs)/codebook/...` | as três Partes |

Caminhos curtos são relativos a `app/projects/[id]/`.

---

## 2. O que a leitura do código achou

1. **O glossário diz que a escala nunca vai à LLM** (`docs/CONTEXT.md`, *Escala*: "A LLM não se
   avalia"). As descrições dos níveis são instrução para o avaliador, não para a LLM. Ver D4.
2. **A avaliação lê a versão do codebook da rodada**, não a mais recente. Então a descrição que o
   avaliador vê é a da versão em que a rodada foi aberta, sem trabalho extra: basta `loadCriteria`
   devolver os campos novos.
3. **Versionamento sai de graça.** Salvar regrava todos os critérios da versão; numa versão já usada
   (ou congelada na Fase 4), salvar cria versão nova com o conteúdo inteiro. Mudar só uma descrição
   de nível passa a contar como alteração do codebook, como a descrição do critério já conta. Isso é
   o comportamento certo: a régua do avaliador mudou.
4. **O placeholder da descrição do critério já sugere âncora** ("Ex.: vale Alto quando a fonte é
   citada e verificável.", `codebook-editor.tsx` ~343). Com campos próprios para os níveis, ele passa
   a competir com eles. Parte 2 troca o exemplo; buscar a frase antiga nos testes antes.
5. **`parseCriteria` tolera `criterion_description` ausente** (`descriptions.length > 0 && ≠ names`).
   Os campos novos seguem a mesma regra, para que os testes e formulários de hoje continuem válidos
   sem mandá-los.
6. **`<details>` fechado ainda envia os campos de dentro.** Se a Parte 2 puser os três campos num
   `Disclosure` fechado, eles continuam no `FormData`. Conferir no teste da Parte 2.
7. **No formulário de avaliação o clique já seleciona o nível**, então o padrão do `InfoTooltip`
   (clique abre o balão) não serve. E no toque não existe hover. Daí D2.

---

## 3. Decisões

**D1 ⚠ (confirmada). Onde a descrição mora.** Por critério, três textos opcionais, como conteúdo da
versão do codebook. Rejeitada: três textos por projeto, iguais em todos os critérios ("Alto" de
Relevância e de Diversidade não querem dizer a mesma coisa).

**D2 ⚠ (confirmada). Fora do mouse.**
- Mouse: balão ao passar por cima do botão.
- Teclado: balão no foco visível do botão; o botão tem `aria-describedby` apontando para o texto.
- Todos, inclusive toque: abaixo dos botões, a descrição do nível selecionado, em texto pequeno
  (`text-xs text-muted`), no formato "Alto: …". Sem nível selecionado ou sem descrição, nada.
- Passar o mouse no botão **já selecionado** não abre balão (o texto já está abaixo).

**D3. Formato no banco e no código.** Três colunas `text` anuláveis em `codebook_criteria`:
`high_description`, `medium_description`, `low_description`, cada uma com CHECK de tamanho (`IS NULL
OR char_length(...) <= 500`). Três colunas, e não `jsonb`, porque a escala é fixa (ADR 0010) e o
padrão da tabela é coluna com CHECK. No TypeScript, `CodebookCriterion` ganha
`levels: Record<ScaleValue, string | null>`, montado em `loadCriteria`; quem desenha itera `SCALE` e
lê `criterion.levels[option]`. `pipeline/codebook.ts` importa `ScaleValue` de
`../(tabs)/evaluate/scale` (`rounds/` já importa de lá; `scale.ts` não importa nada, sem ciclo).

**D4. Não vai à LLM.** `criterionLine` continua igual. Parte 1 acrescenta um teste em
`llm-input.unit.test.ts` que passa um critério com níveis e afirma que o texto deles não aparece na
entrada da Fase 3. O glossário ganha uma linha dizendo isso (ver Parte 1).

**D5. Limite.** `LEVEL_DESCRIPTION_MAX = 500` em `lib/limits.ts`. O balão tem 320 px; 500
caracteres já são umas 10 linhas. Os três são opcionais e independentes (pode descrever só Alto e
Baixo).

**D6. Campos do formulário.** Arrays paralelos `criterion_level_high`, `criterion_level_medium`,
`criterion_level_low`, um valor por critério, na mesma ordem de `criterion_name`. Ausentes = todos
nulos; presentes com tamanho diferente de `criterion_name` = "Não foi possível ler os critérios
enviados." (mesma mensagem de hoje). Texto normalizado como a descrição (`\r\n` → `\n`, `trim`,
vazio → `null`).

---

## 4. Parte 1: banco e servidor

**Commit:** `feat(codebook): gravar a descrição de cada nível do critério`

1. **(TDD)** `pipeline/actions.int.test.ts`, no `describe` de critérios: estender o helper do form
   (~110) com `levels?: Partial<Record<ScaleValue, string>>` por critério e `rawCriteria.levels`.
   Testes, vendo cada um falhar antes do código:
   - salvar com os três níveis grava os três (ler da tabela);
   - salvar com só Alto grava Alto e deixa Médio/Baixo nulos; texto em branco vira `null`;
   - form sem os campos novos continua salvando, com níveis nulos (garantia do achado 5);
   - quantidade de `criterion_level_high` ≠ quantidade de nomes → erro de leitura;
   - 501 caracteres → `A descrição do nível Alto pode ter no máximo 500 caracteres.` (uma mensagem
     por nível, com `scaleLabel`);
   - `loadCodebook` e `loadCodebookVersion` devolvem `levels` com os três valores.
2. `lib/limits.ts`: `LEVEL_DESCRIPTION_MAX = 500`.
3. `lib/db/schema.ts`: três colunas + três CHECKs (`cc_high_description_len`, …). Rodar
   `npx drizzle-kit generate`, **ler o SQL gerado** (só `ADD COLUMN` + `ADD CONSTRAINT`), depois
   `supabase db reset` (Docker antes; ver memória do Supabase CLI).
4. `pipeline/codebook.ts`: `levels` em `CodebookCriterion` e em `loadCriteria`.
5. `pipeline/actions.ts`: `ParsedCriterion.levels`, leitura em `parseCriteria` (D6), insert com as
   três colunas.
6. `pipeline/llm-input.unit.test.ts`: o teste de D4 (deve passar sem mudar `llm-input.ts`; mutar
   `criterionLine` para incluir os níveis e ver ficar vermelho).
7. `docs/CONTEXT.md`, entrada *Escala*: "Cada critério pode descrever o que vale Alto, Médio e Baixo
   nele (*descrição do nível*). É instrução para o avaliador e, como a escala, não vai à LLM."
8. Antes de fechar: `grep` por `toEqual(` e `Object.keys(` sobre objetos de critério nos testes
   (o campo novo quebra igualdade exata). `npm run lint`, `npx tsc --noEmit`, `npm test`.

Fora: qualquer tela. Prod precisa de `db push` depois do merge (memória de drift de schema).

---

## 5. Parte 2: editor e leitura do codebook

**Commit:** `feat(codebook): descrever Alto, Médio e Baixo em cada critério`

1. **(TDD)** Testes de página/editor (`(tabs)/codebook/...` e `pipeline/page.int.test.ts`, onde hoje
   se confere o editor e a `DefinitionList`):
   - o editor de um critério com níveis gravados renderiza os três campos com os valores;
   - a leitura (`DefinitionList`) mostra "Alto: …" só para os níveis preenchidos;
   - `changesLabel`/detecção: mudar só um nível marca o critério como alterado (testar
     `serializeCriteria` por meio do que já é testado; se não houver ponto de teste, exportar e
     testar unitariamente).
2. `codebook-editor.tsx`:
   - `CriterionRow.levels: Record<ScaleValue, string>`; `newCriterion` com três vazios;
     `toCriterionRows` a partir de `criterion.levels`; `serializeCriteria` inclui os três.
   - Em `CriterionFields`, depois da descrição do critério, um `Disclosure` "Descrição dos níveis
     (opcional)", aberto se algum nível já tem texto. Dentro, três `Textarea` (`rows={2}`,
     `maxLength={LEVEL_DESCRIPTION_MAX}`), rótulo com `ScaleMarker` + `scaleLabel`, `name`
     conforme D6. O `summary` diz quantos estão preenchidos ("2 de 3").
   - Os `name` ficam dentro do `<details>` mesmo fechado (achado 6); o teste da Parte 2 confere que
     salvar com o bloco fechado não apaga os níveis.
   - Trocar o placeholder da descrição do critério (achado 4) por algo sobre o que o critério julga,
     ex.: "Ex.: a resposta indica de onde veio a informação." Buscar a frase antiga nos testes.
   - Ajuda curta no `summary` (ⓘ): "Aparece para o avaliador ao passar o mouse no botão do nível."
     Conferir na Parte 3 que é isso mesmo que acontece.
   - `InheritedCriteria` (gerais repetidos em cada definição): não mostra níveis, para não inchar.
3. `definition-list.tsx` `criterionItem`: abaixo da descrição, lista curta dos níveis preenchidos
   (`ScaleMarker` + "Alto: texto"), `text-[13px] text-muted`, `preWrapClass`.
4. Verificar no preview (`/dev/login`): criar critério, preencher dois níveis, salvar, recarregar,
   ver na leitura; 375 px sem estouro.

Fora: diff visual entre versões do codebook (não existe hoje).

---

## 6. Parte 3: tela de avaliação

**Commit:** `feat(avaliar): mostrar a descrição do nível ao passar o mouse`

1. **(TDD)** `(tabs)/evaluate/page.int.test.ts` (ou um `evaluation-form` testado por render), com
   um critério que tem Alto e Baixo descritos e Médio vazio:
   - os botões Alto e Baixo têm `aria-describedby` apontando para um elemento com a descrição;
     Médio não tem `aria-describedby`;
   - sem seleção, nenhum texto "Alto: …" abaixo dos botões; com o valor gravado/selecionado Alto,
     o texto aparece;
   - afirmar por `aria-describedby`/props, não pela ausência do texto no markup: o balão fica no
     DOM com `display:none` (memória do `markupTextOf`).
2. Componente novo `LevelHint` (ou `ScaleOption`) em `(tabs)/evaluate/`, por botão:
   - `onPointerEnter`/`Leave` só com `pointerType === 'mouse'` (como `InfoTooltip`), `onFocus`
     só quando `:focus-visible` (`event.currentTarget.matches(':focus-visible')`), `onBlur` fecha,
     Esc fecha;
   - balão `role="tooltip"` com `id` de `useId`, mesmo estilo do `InfoTooltip`
     (`bg-ink-soft text-surface`, 320 px), `display:none` fechado; não abre se o botão está
     selecionado (D2) ou se o nível não tem descrição;
   - posição: abaixo do botão, alinhado à esquerda do **grupo** de botões (não do botão), para Baixo
     não estourar à direita (memória: o balão do `InfoTooltip` sai pela direita a 375 px).
3. `evaluation-form.tsx`: os botões de `SCALE` passam a usar o componente; abaixo do grupo, se
   `isScaleValue(value)` e `cell.criterion.levels[value]`, um
   `<p className="m-0 text-xs text-muted">` com "Alto: …" (`preWrapClass`).
4. Modo de leitura (depois do envio): sem mudança. O `ScaleBadge` não ganha balão.
5. Verificar no preview, com mouse de verdade (ação `hover` do browser): balão abre e fecha, Tab
   abre no foco, Esc fecha, seleção mostra o texto abaixo; 375 px sem estouro horizontal.

Fora: revisão de discordâncias, anotações de consenso e telas de rodada (mostram notas, não os
botões); balão no `ScaleBadge` do modo de leitura.
