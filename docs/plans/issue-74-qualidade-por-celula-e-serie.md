# Plano de implementação — Issue #74: "35 — Qualidade por célula e série da Fase 3"

Link: https://github.com/nicolasddr/tcc/issues/74
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 10 e 11, e a 12 e a
14 na parte que toca matriz e série)
Blocked by: #73 (**fechada**, commits `eac416a`, `97850ff`, `7276de5`). `Quality`, `qualityOf`,
`qualityPair`, `hasQuality`, `QualityPanel`, `QualityValue` e as palavras de `quality-labels.ts` já
existem e são a base desta fatia.

**A executar em 3 partes, uma por chat.** As seções 1 a 6 são o contexto comum. Quem pegar qualquer
Parte lê `AGENTS.md`, estas seis seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | O cálculo puro: construtor de matriz genérico, matriz de Qualidade, série de Qualidade e as palavras | ☑ |
| 2 | A tela de rodadas: a matriz de Qualidade dentro do bloco da Qualidade | ☑ |
| 3 | A visão geral: a série de Qualidade, a prova de que o Avaliador não vê nada, e a varredura dos ACs | ☐ |

**Sem migration, sem ADR nova.** Matriz e série são derivadas das mesmas notas que o ICR já carrega,
na leitura. Nenhuma tabela, coluna ou cache. As decisões de fundo já estão escritas: emenda de
2026-09-22 da **ADR 0004** (Qualidade só como distribuição, "na rodada inteira, por célula e na
série") e emenda de 2026-09-22 da **ADR 0011** (Qualidade segue as regras de visibilidade e de
outlier do ICR). O verbete **Qualidade** de `docs/CONTEXT.md` já descreve o comportamento final.

**Sem deploy especial.** Nada de `db push`.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Qualidade da rodada | `(tabs)/rounds/quality.ts` (`Quality`, `QualityPair`, `qualityOf`, `qualityPair`, `hasQuality`) | **a medida de cada célula e de cada ponto**. Não muda |
| Palavras da Qualidade | `(tabs)/rounds/quality-labels.ts` (`QUALITY_LABEL`, `QUALITY_UNRATED`, `QUALITY_UNRATED_WITHOUT_OUTLIERS`, `formatShare`, `qualityTotal`) | ganha as frases da matriz e da série. A varredura de palavras de juízo do teste já lê toda constante nova |
| Painel e linha | `(tabs)/rounds/quality-panel.tsx` (`QualityPanel`, `QualityValue`) | `QualityValue` é **o** texto de cada ponto da série (foi desenhado para isso na #73, D9) |
| Matriz do ICR | `(tabs)/rounds/agreement-matrix.ts` (`matrixColumns`, `agreementMatrix`, `MatrixCell`, `MatrixRow`, `CriterionKey`) | **a estrutura a reaproveitar**. O agrupamento por célula e a regra de aplicável viram um construtor genérico (Parte 1) |
| Tabela do ICR | `(tabs)/rounds/agreement-matrix-table.tsx` (`AgreementMatrixTable`) | o desenho a copiar para a tabela de Qualidade. **Não muda** |
| Palavras da matriz do ICR | `(tabs)/rounds/agreement-labels.ts` (`CELL_NOT_APPLICABLE`, `CELL_NOT_APPLICABLE_TITLE`, `CELL_UNRATED_LABEL`, `AGREEMENT_ALL_LABEL`, `AGREEMENT_WITHOUT_OUTLIERS_LABEL`) | reaproveitadas como estão: "—", "sem nota" e "com todos" têm de ser as mesmas expressões nas duas matrizes |
| Série do ICR | `(tabs)/rounds/agreement-series.ts` + `agreement-series-chart.tsx` | o desenho a copiar (cards por rodada). **Não muda**: é da #75 |
| Critérios | `pipeline/criteria.ts` (`criteriaOfDefinition`, `generalCriteria`, `ownCriteria`, `isGeneral`) | usados como estão |
| Rodadas | `(tabs)/rounds/rounds.ts` (`RoundSummary` já traz `phase`, `codebookVersionNumber`, `promptVersionNumber`, `closedAt`) | a entrada da série. Nenhuma consulta nova |
| Tela de rodadas | `(tabs)/rounds/page.tsx` | já carrega `focusCodebook` (versão fixada pela rodada), `observations` e `outliers`; ganha a matriz dentro da `Section` da Qualidade (Parte 2) |
| Visão geral | `(tabs)/page.tsx` | já carrega `agreement.rounds`, `observations` e `outliers` no ramo do Administrador; ganha a `Section` da série (Parte 3) |
| Testes de página | `(tabs)/rounds/page.int.test.ts` (`roundWith(..., { phase })`, `qualityScene`, `qualityPanelOf`, `matrixOf`, `classNamesOf`, `allTextOf`), `(tabs)/page.int.test.ts` (`roundWith` com `phase`, `seriesOf`, `qualityOf`, `sectionWith`) | onde entram as provas de quem vê o quê |
| Helpers | `test/helpers.ts` (`addRound(..., { phase })`, `addEvaluation`, `addScore`, `addOutlier`) | nada novo precisa nascer |

O que **falta** e esta fatia cria: o construtor de matriz genérico, a matriz de Qualidade, a série de
Qualidade, as palavras delas, a tabela na tela de rodadas e a série na visão geral.

---

## 2. A fatia por extenso

### A matriz de Qualidade

A mesma forma da matriz de ICR: definições nas linhas, critérios nas colunas (gerais primeiro, depois
os específicos na ordem das definições), critério geral valendo para todas as definições. É sempre
a matriz da **versão de codebook que a rodada fixou**, não a vigente, pelo mesmo motivo do ICR.

Cada célula tem um de três estados:

| Estado | Quando | O que aparece |
|---|---|---|
| não aplicável | critério específico de outra definição | `CELL_NOT_APPLICABLE` ("—") com o `title` `CELL_NOT_APPLICABLE_TITLE` |
| sem nota | o par existe na versão e ninguém avaliou ainda | `CELL_UNRATED_LABEL` ("sem nota"), **nunca** 0% |
| com nota | há ao menos uma nota | Alto, Médio e Baixo, cada um com porcentagem e contagem |

A matriz vive **só na tela de rodadas**, dentro do bloco "Qualidade na rodada N", logo abaixo do
`QualityPanel`, espelhando o lugar da matriz de ICR dentro do bloco da Concordância. A visão geral não
ganha matriz (a de ICR também não está lá).

### A série de Qualidade

Um ponto por rodada **da Fase 3** (`hasQuality(round.phase)`), em ordem cronológica, cada um com as
três porcentagens e contagens, a versão de codebook e a versão de prompt da rodada, e se ela está
aberta ou fechada. Nada é somado, nem tirado a média, nem ligado entre rodadas: cada ponto mede a
combinação de versões que está ao lado dele.

A série vive **na visão geral**, numa `Section` "Qualidade por rodada", logo depois de "Qualidade na
rodada N". Aparece só quando há ao menos um ponto: um projeto sem rodada da Fase 3 não ganha texto
nenhum sobre Qualidade (história 13).

### Outliers

Com algum avaliador marcado na rodada, a célula e o ponto mostram o valor **com todos** e, junto, o
valor **sem os marcados**, o com todos primeiro. Sem marca, um valor só. O recorte é o mesmo
`qualityPair` da #73, que usa o mesmo `withoutExcluded` do ICR: Qualidade e ICR nunca discordam sobre
quem saiu.

### Quem vê

Só o Administrador. A invisibilidade é estrutural e já existe: a tela de rodadas do Avaliador retorna
antes de qualquer cálculo, e na visão geral `agreement` é `null` para quem não é Administrador. A
fatia só acrescenta cálculo depois desses pontos, e prova por teste que nada chega ao Avaliador.

---

## 3. Decisões desta fatia

**D1. O par na matriz e na série diverge, de propósito, do que a #65 fez com o ICR.** A #65 decidiu
que a matriz de ICR fica só "com todos" (com a frase `MATRIX_SCOPE_NOTE`) e que a série de ICR desenha
só o com todos (com a marca "com exclusão"). A #74 tem AC explícito no sentido oposto para a
Qualidade: "matriz e série mostram também o valor sem os marcados". A ADR 0011 (emenda) exige que o
par ande junto, e não proíbe o par por célula; o que a #65 recusou foi uma **série filtrada**, uma
linha contínua de valores sem os marcados, que não é o que se faz aqui. Então:

- a **matriz de Qualidade** leva o par em cada célula;
- a **série de Qualidade** não desenha linha nem coluna: é uma lista de pontos, e cada ponto traz o
  **seu** par, que é só o par da rodada repetido na visão geral. Não existe uma "série sem os
  marcados" em lugar nenhum;
- a **matriz e a série de ICR não mudam** (§ 5). As duas matrizes lado a lado ficam diferentes quanto
  ao par, e a legenda da de Qualidade diz isso em meia frase, para ninguém ler uma pela regra da
  outra.

> **A confirmar antes da Parte 1:** se o desejado for o contrário (a matriz de Qualidade só com todos,
> como a de ICR), o AC da issue muda e esta decisão cai. O plano segue o AC.

**D2. Um construtor de matriz genérico, e a matriz de ICR passa a usá-lo sem mudar de
comportamento.** O agrupamento por célula (`groupByCell`) e a regra de aplicável já existem em
`agreement-matrix.ts`. Em vez de copiá-los, extrair:

```ts
export type MeasuredCell<V> =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'measured'; value: V }

export type MeasuredRow<D, C, V> = {
  definition: D
  cells: { column: MatrixColumn<C>; cell: MeasuredCell<V> }[]
}

export function measuredMatrix<D extends DefinitionKey, C extends CriterionKey, V>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
  measure: (group: readonly RoundObservation[]) => V,
): MeasuredRow<D, C, V>[]
```

em `agreement-matrix.ts`, e reescrever `agreementMatrix` em cima dele, traduzindo `measured` para o
`{ state: 'calculated'; agreement }` que o `MatrixCell` já expõe. **Nenhuma asserção de
`agreement-matrix.unit.test.ts` muda**: é a prova de que a refatoração não alterou o ICR. O nome
`measuredMatrix` é sugestão; o que importa é a matriz de Qualidade não ter uma segunda cópia da regra
de aplicável.

**D3. A matriz de Qualidade é uma função de uma linha em `quality.ts`.**

```ts
export function qualityMatrix<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): MeasuredRow<D, C, QualityPair>[]
```

com `measure = (group) => qualityPair(group, excluded)`. Consequências que os testes fixam:

- Rodada com marca: **toda** célula com nota tem `withoutOutliers` não nulo, mesmo aquela em que o
  marcado não avaliou (aí os dois valores são iguais). A regra é por rodada, não por célula, como no
  painel.
- Célula avaliada só por marcados: `all` com nota e `withoutOutliers` `{ rated: false }`, e a tela diz
  `QUALITY_UNRATED_WITHOUT_OUTLIERS` ao lado do com todos.
- "sem nota" é o estado `unrated` da matriz (nenhuma observação), e não um `Quality` `rated: false`:
  uma célula sem observação nunca vira `qualityPair([])`.

**D4. A série é um módulo puro novo, `(tabs)/rounds/quality-series.ts`.**

```ts
export type QualitySeriesPoint = {
  roundId: string
  roundNumber: number
  codebookVersionNumber: number
  promptVersionNumber: number
  closedAt: string | null
  pair: QualityPair
}

export function qualitySeries(
  rounds: readonly RoundSummary[],
  observations: ReadonlyMap<string, RoundObservation[]>,
  outliers: ReadonlyMap<string, ReadonlySet<string>>,
): QualitySeriesPoint[]
```

- Filtra por `hasQuality(round.phase)`: é a única comparação de fase da série.
- Preserva a ordem recebida (`listRounds` já devolve cronológica).
- Rodada da Fase 3 sem nota vira ponto com `pair.all` `rated: false`, e **não some** da série (como
  no ICR).
- O módulo não exporta nenhuma função de agregação entre rodadas, e o teste varre as exportações
  para provar isso, como `agreement-series.unit.test.ts` já faz.
- `outliers` é obrigatório (não tem o default que a série do ICR ganhou por compatibilidade): a série
  de Qualidade nasce já com o par.

**D5. Nenhuma cor de juízo, na matriz e na série.** O mesmo D5 da #73: sem `scaleTone`, sem `Badge`
de tom `success`/`warning`/`danger`, sem `ProgressBar`, sem `brand`. A célula é **só texto**, sem
barra: numa grade que já rola na horizontal, três barras por célula (seis com par) seriam ruído, e o
texto já diz tudo. Na série, o ponto usa `QualityValue`, que já passou pela varredura de classes. A
série **não tem gráfico** (§ 7): com os três pontos da escala na mesma cor, uma coluna empilhada não
se lê, e três colunas lado a lado por rodada pedem cores diferentes para os três pontos, que é
justamente o que a #73 proibiu.

**D6. Os componentes.**

- `(tabs)/rounds/quality-matrix-table.tsx`, servidor, `QualityMatrixTable({ definitions, criteria,
  observations, excluded, codebookVersionNumber })`, no desenho de `AgreementMatrixTable`: mesma
  moldura (`overflow-x-auto`, cabeçalho com "Definição", `Badge tone="neutral"` "geral" nos critérios
  gerais), mesmo `EmptyState` quando a versão não tem definição e critério para cruzar, e uma linha de
  rodapé dizendo a versão de codebook com um `InfoTooltip` da legenda (D7).
- A célula com nota escreve **uma linha por ponto da escala**, "Alto 62,5% (5)", na ordem de `SCALE`.
  Com par, dois blocos empilhados, o com todos primeiro, cada um com o seu rótulo curto (reusar
  `AGREEMENT_ALL_LABEL` e `AGREEMENT_WITHOUT_OUTLIERS_LABEL`); sem par, um bloco sem rótulo.
  A formatação de linha (`scaleLabel` + `formatShare` + contagem) é a mesma de `distributionText` em
  `quality-panel.tsx`: exportar de lá ou mover para `quality-labels.ts`, em vez de reescrever.
- `(tabs)/rounds/quality-series-list.tsx`, servidor, `QualitySeriesList({ points, projectId })`, no
  desenho da lista de cards de `AgreementSeriesChart`: "Rodada N", "Codebook vX", **"Prompt vY"**,
  "fechada em …" ou `Badge tone="info"` "aberta", e embaixo `<QualityValue pair={point.pair} />`. Sem a
  marca "com exclusão" (o par já está à vista no próprio ponto). Rodapé com a frase de "um ponto por
  rodada, nada somado" (D7) e o `OpenLink` "Abrir rodadas".

**D7. As palavras novas moram em `quality-labels.ts`.**

- `QUALITY_MATRIX_LEGEND`: o que é "sem nota" (célula que existe no codebook e que ninguém avaliou
  ainda) e "—" (critério específico de outra definição), montada com `CELL_UNRATED_LABEL`,
  `CELL_NOT_APPLICABLE` e `CELL_NOT_APPLICABLE_TITLE`; que "sem nota" não vale 0%; e que, com
  avaliador marcado, cada célula traz o par — diferente da matriz de Concordância acima, que é só com
  todos.
- `QUALITY_SERIES_HINT` e `QUALITY_SERIES_HELP`: um ponto por rodada da Fase 3; cada ponto mede as
  versões de codebook e de prompt indicadas nele; nenhum valor junta rodadas; rodadas da Fase 2 não
  entram. Sem orientação de leitura pelo ICR (#76) e sem comparação entre fases (#75/#78).
- `QUALITY_SERIES_NOTE` (rodapé): uma frase no espírito de "Um ponto por rodada, e nenhum valor que
  junte rodadas", com a variante de um ponto só.
- A varredura de palavras de juízo de `quality-labels.unit.test.ts` pega todas elas sozinha.
  **Nenhuma pode conter "meta"** (nem "metade"), como anotado na #73.

**D8. Só calcula quando a página já calcula a Qualidade.**

- Tela de rodadas: `QualityMatrixTable` só é renderizada dentro da `Section` que já depende de
  `focusQuality` (rodada em foco com `hasQuality`). Usa `focusCodebook`, `focusObservations` e
  `focusExcluded`, que a página já tem. Nenhuma consulta nova.
- Visão geral: `qualitySeries(agreement.rounds, agreement.observations, agreement.outliers)` só
  quando `agreement` existe (ramo do Administrador). Nenhuma consulta nova.

---

## 4. Critérios de aceite × onde são provados

| AC da issue | Parte | Prova |
|---|---|---|
| A matriz de Qualidade usa a mesma estrutura da matriz de ICR | 1, 2 | `matrixColumns` compartilhado; unitário compara colunas das duas matrizes para o mesmo codebook; ICR sem asserção mudada |
| Cada célula mostra Alto, Médio e Baixo com as contagens | 1, 2 | unitário (contagens por célula) + página (texto da célula) |
| Par inexistente = não aplicável; célula sem nota = sem nota | 1, 2 | unitário com critério geral e específico + página ("—" e "sem nota", sem "0%") |
| Série: um ponto por rodada da Fase 3, com as três porcentagens e as versões de codebook e prompt | 1, 3 | unitário + página da visão geral ("Codebook vX", "Prompt vY") |
| Rodadas da Fase 2 não entram na série | 1, 3 | unitário (projeto com rodadas das duas fases) + página |
| Com outlier, matriz e série mostram também o sem os marcados, sem esconder o com todos | 1, 2, 3 | unitário (`all` idêntico ao sem filtro) + páginas (os dois rótulos, com todos primeiro) |
| Nada disso aparece para o Avaliador | 2, 3 | páginas: componentes fora da árvore e texto sem "Qualidade" nem "%" |
| Testes: unitário da matriz, unitário da série, página Admin × Avaliador, suíte verde | 1, 2, 3 | — |

---

## 5. Fronteira com as fatias vizinhas

**#65/#63 (matriz e série de ICR)**: `agreement-matrix-table.tsx`, `agreement-series.ts`,
`agreement-series-chart.tsx` e `agreement-labels.ts` **não mudam**. `agreement-matrix.ts` muda só por
dentro (D2), com os testes dele intocados. `MATRIX_SCOPE_NOTE` continua verdadeira: fala da matriz de
Concordância.

**#75 (fase na série de ICR e o que mudou entre rodadas)** é dona da série de ICR entre as Fases 2 e
3 e de "o que mudou". A série de Qualidade não mostra fase (só tem Fase 3) nem diferença entre
pontos. Se a #75 acabar mexendo em `AgreementSeriesChart` antes desta fatia, copiar o desenho dos
cards de lá, não de antes.

**#76 (orientação pelo ICR)**: nenhum texto desta fatia diz quando a Qualidade é confiável nem para
onde olhar.

**#77 (avanço da Fase 3)**: pode reaproveitar `qualitySeries` para achar "a última rodada da Fase 3",
mas isso é dela. Esta fatia não toca `pipeline/phase-2-checklist.tsx`.

**#78 (CSV)**: a comparação de Qualidade entre as Fases 2 e 3 continua sendo pelo CSV.

---

## 6. Gotchas herdados

- **Cena no banco quebra teste de integração**: se a conferência no navegador deixar notas no banco
  local, `scores` precisa ficar vazia antes de `npm test`.
- **Sem comentários no código** e **sem Prettier** (`npx prettier` reformata o arquivo inteiro).
- **`collectText` só anda pelos children**: texto que vira prop (`title`, `text` de `InfoTooltip`)
  some das asserções; ler a prop via `findElement`, ou usar `allTextOf`/`markupTextOf`, que a #73
  deixou prontos.
- **Palavras de juízo**: nenhuma constante nova pode conter "meta", "boa", "ruim", "aprovad",
  "suficiente", "atinge", "adequad".
- **Captura do preview**: se o screenshot sair preto, provar por DOM (`get_page_text`, `read_page`) e
  `resize_window` para 375px.

---

# Parte 1 — O cálculo puro e as palavras

**Objetivo:** construtor de matriz genérico, `qualityMatrix`, `qualitySeries` e as palavras novas, com
testes unitários. Nenhuma tela muda.

**Ler antes:** `AGENTS.md`, seções 1 a 6, `(tabs)/rounds/agreement-matrix.ts` e o teste dele,
`agreement-series.ts` e o teste dele, `quality.ts`, `quality-labels.ts` e o teste dele,
`quality-panel.tsx` (`distributionText`), `pipeline/criteria.ts` e `rounds.ts` (`RoundSummary`).

### 1.1 `agreement-matrix.ts`: o construtor genérico

- Extrair `measuredMatrix` (D2) com `MeasuredCell<V>` e `MeasuredRow<D, C, V>`.
- `agreementMatrix` vira `measuredMatrix(..., ordinalAlpha)` traduzido para `MatrixCell`. As
  exportações e os tipos atuais continuam com o mesmo nome e a mesma forma.
- Rodar `agreement-matrix.unit.test.ts` **antes de qualquer outra mudança**: verde sem tocar em
  asserção.

### 1.2 `quality.ts`: `qualityMatrix`

A função do D3. Importa `measuredMatrix` e os tipos de `./agreement-matrix`.

### 1.3 `quality-series.ts`

A função e o tipo do D4.

### 1.4 `quality-labels.ts`

- As constantes do D7.
- Tirar a formatação de uma linha de distribuição de dentro de `quality-panel.tsx` para cá (algo como
  `levelText(level): string` → "Alto 62,5% (5)"), e fazer `distributionText` usá-la. O texto de
  `QualityValue` não muda: os testes de página da #73 continuam verdes sem mexer.

### 1.5 Testes da Parte 1

`(tabs)/rounds/quality-matrix.unit.test.ts` (copiar `score`, `criterion` e as definições de
`agreement-matrix.unit.test.ts`):

- [ ] **Mesma estrutura do ICR**: para o mesmo codebook, as colunas de `qualityMatrix` e de
      `agreementMatrix` são as mesmas, na mesma ordem (gerais primeiro), e as linhas também.
- [ ] **Critério geral vale para todas as definições**: com duas definições e um critério geral, a
      coluna do geral é aplicável nas duas linhas.
- [ ] **Não aplicável**: critério específico de `d1` na linha de `d2` é `not_applicable`, mesmo que
      exista observação (impossível no banco, mas a regra é da versão, não das notas).
- [ ] **Sem nota**: par aplicável sem observação é `unrated`, e não `measured` com `rated: false`.
- [ ] **Distribuição por célula**: duas células com notas diferentes dão contagens e `share` próprios,
      sem vazar de uma para a outra.
- [ ] **Sem marca, um valor só**: `excluded` vazio dá `withoutOutliers: null` em toda célula medida.
- [ ] **Com marca, o par em toda célula medida**, inclusive na que o marcado não avaliou (os dois
      valores iguais), e `all` idêntico a `qualityOf(grupo)` sem filtro.
- [ ] **Célula avaliada só pelo marcado**: `all` com nota, `withoutOutliers` `rated: false`.

`(tabs)/rounds/quality-series.unit.test.ts` (copiar `round`, `score` e `ratings` de
`agreement-series.unit.test.ts`, com `phase` e `promptVersionNumber` no `round`):

- [ ] **Só rodadas da Fase 3**: rodadas 1 e 2 da Fase 2 e 3 e 4 da Fase 3 dão dois pontos, 3 e 4.
- [ ] **Ordem recebida preservada.**
- [ ] **Cada ponto com as suas versões**: `codebookVersionNumber` e `promptVersionNumber` da própria
      rodada.
- [ ] **Rodada da Fase 3 sem nota não some**: vira ponto com `pair.all` `rated: false`.
- [ ] **Nada agregado**: o ponto de cada rodada é igual a `qualityPair` das observações dela sozinha,
      e o módulo não exporta nenhuma função além de `qualitySeries` (varrer `Object.keys` do módulo,
      como o teste da série de ICR).
- [ ] **Par por ponto**: rodada com marca tem `withoutOutliers` não nulo; a vizinha sem marca tem
      `null`.
- [ ] **Projeto só com Fase 2** dá série vazia.

`(tabs)/rounds/quality-labels.unit.test.ts`:

- [ ] A varredura de palavras de juízo já existente pega as constantes novas (conferir que elas
      aparecem no conjunto varrido).
- [ ] `levelText` para "Alto 62,5% (5)" e "Baixo 0% (0)".
- [ ] `QUALITY_MATRIX_LEGEND` usa as mesmas expressões da matriz de ICR (`CELL_UNRATED_LABEL`,
      `CELL_NOT_APPLICABLE`) e diz que "sem nota" não é 0%.
- [ ] As frases da série não falam de ICR, de faixa nem de Fase 2 como comparação.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes (a #73 fechou com 73 arquivos e 985 testes).
Nenhuma tela mudou.

### O que a Parte 2 herda

- **Nomes finais, como no plano.** `agreement-matrix.ts` exporta `measuredMatrix`, `MeasuredCell<V>`
  (`not_applicable` | `unrated` | `measured` com `value`) e `MeasuredRow<D, C, V>`; `agreementMatrix`
  virou `measuredMatrix(..., ordinalAlpha)` traduzido para `MatrixCell`, e
  `agreement-matrix.unit.test.ts` passou sem tocar em asserção. `quality.ts` exporta
  `qualityMatrix(definitions, criteria, observations, excluded)`. `quality-series.ts` exporta só
  `qualitySeries(rounds, observations, outliers)` e o tipo `QualitySeriesPoint`.
- **Palavras em `quality-labels.ts`:** `QUALITY_MATRIX_LEGEND`, `QUALITY_SERIES_HINT`,
  `QUALITY_SERIES_HELP` e `levelText(level)` ("Alto 62,5% (5)"), que `distributionText` de
  `quality-panel.tsx` já usa. O texto de `QualityValue` não mudou.
- **Divergência:** o rodapé da série virou **duas constantes**, `QUALITY_SERIES_NOTE` (vários pontos)
  e `QUALITY_SERIES_NOTE_SINGLE` (um ponto só), em vez de uma função, para a varredura de palavras de
  juízo alcançar as duas. A Parte 3 escolhe entre elas por `points.length`.
- **D1 seguiu o AC:** a matriz de Qualidade leva o par em cada célula, e a legenda diz isso ao
  contrário da matriz de Concordância.
- `quality-labels.ts` agora importa `PHASE_2`/`PHASE_3` de `pipeline/preconditions` e o tipo
  `QualityLevel` de `quality.ts` (só tipo, sem ciclo).
- **Testes:** `quality-matrix.unit.test.ts` (8), `quality-series.unit.test.ts` (8) e 5 novos em
  `quality-labels.unit.test.ts`. Suíte: 75 arquivos, 1006 testes, lint e typecheck verdes.

---

# Parte 2 — A tela de rodadas: a matriz de Qualidade

**Objetivo:** o Administrador vê, no bloco "Qualidade na rodada N", a matriz de Qualidade da rodada em
foco, abaixo do `QualityPanel`.

**Ler antes:** seções 1 a 6, o "o que herda" da Parte 1, `(tabs)/rounds/page.tsx`,
`agreement-matrix-table.tsx`, `quality-panel.tsx`, e em `(tabs)/rounds/page.int.test.ts` os helpers
`roundWith`, `qualityScene`, `qualityPanelOf`, `matrixOf`, `classNamesOf` e os testes da Qualidade
da #73.

### 2.1 `(tabs)/rounds/quality-matrix-table.tsx`

`QualityMatrixTable` como no D6, com a célula como no D6 e a legenda do D7. Sem cor de juízo (D5).

### 2.2 `(tabs)/rounds/page.tsx`

Dentro da `Section` da Qualidade, trocar o conteúdo por um `flex flex-col gap-4` com
`<QualityPanel pair={focusQuality} />` e, embaixo,

```tsx
<QualityMatrixTable
  definitions={focusCodebook?.definitions ?? []}
  criteria={focusCodebook?.criteria ?? []}
  observations={focusObservations}
  excluded={focusExcluded}
  codebookVersionNumber={focusRound.codebookVersionNumber}
/>
```

no desenho da `Section` de Concordância. A `Section` continua condicionada a `focusQuality` (D8). O
`help` da `Section` pode ganhar meia frase dizendo que a matriz abaixo mostra a mesma distribuição
por célula; se ganhar, a frase mora em `quality-labels.ts`.

### 2.3 Testes da Parte 2

Em `(tabs)/rounds/page.int.test.ts` (novo helper `qualityMatrixOf(tree)`, no desenho de `matrixOf`):

- [ ] **O Administrador vê a matriz numa rodada da Fase 3**: com a cena de duas definições, um
      critério geral e um específico de cada, a `QualityMatrixTable` está na árvore com as
      `definitions`/`criteria` da versão fixada pela rodada, e o texto da célula avaliada tem as três
      porcentagens e contagens.
- [ ] **Não aplicável e sem nota na tela**: o texto tem "—" (com o `title` certo no markup) e
      "sem nota", e a célula sem nota não tem "0%".
- [ ] **Dentro do bloco da Qualidade, fora do da Concordância**: a `QualityMatrixTable` está na
      `Section` da Qualidade (`findSection`), e a `AgreementMatrixTable` continua na de Concordância,
      sem prop nova.
- [ ] **E não existe numa rodada da Fase 2**: `findElement(tree, QualityMatrixTable)` é `null`, e a
      matriz de ICR continua lá.
- [ ] **Com outlier marcado, o par na célula**: os rótulos "com todos" e "sem os marcados como
      outlier" aparecem, o com todos primeiro no markup; sem marca, nenhum dos dois rótulos na
      matriz.
- [ ] **A versão é a da rodada**: rodada fixou Codebook v1, projeto já está na v2 com uma definição a
      mais; a matriz tem as linhas da v1 (copiar o teste equivalente da matriz de ICR, se houver).
- [ ] **Nenhuma cor de juízo**: `classNamesOf` na subárvore da `QualityMatrixTable` sem `success`,
      `warning`, `danger` nem `brand`.
- [ ] **O Avaliador não vê**: o teste "não fala de coeficiente nem de Qualidade" (rodada da Fase 3
      fechada) ganha `findElement(tree, QualityMatrixTable) === null`.

### 2.4 Conferência no navegador

Supabase local, `npm run dev:local`, `/dev/login`. Cena: rodada 1 da Fase 2 e rodada 2 da Fase 3,
codebook com duas definições, um critério geral e um específico por definição, Ana, Bruno e Carla
avaliando, Carla marcada, e uma célula que ninguém avaliou. Conferir: matriz só na rodada da Fase 3,
logo abaixo do `QualityPanel`; "—" e "sem nota" nos lugares certos; o par em cada célula medida, com
todos primeiro; a legenda no `InfoTooltip`; a 375px, a tabela rolando **dentro** do
`overflow-x-auto`, sem rolagem horizontal da página. **Apagar a cena** depois (`scores` vazia).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, e a tela conferida.

### O que a Parte 3 herda

- **`QualityMatrixTable`** em `(tabs)/rounds/quality-matrix-table.tsx`, com as props do D6
  (`definitions`, `criteria`, `observations`, `excluded`, `codebookVersionNumber`). A célula com nota
  é uma linha por ponto da escala via `levelText`; com par, dois blocos rotulados com
  `AGREEMENT_ALL_LABEL` e `AGREEMENT_WITHOUT_OUTLIERS_LABEL`, e o sem os marcados sem nota diz
  `QUALITY_UNRATED_WITHOUT_OUTLIERS`. Rodapé com a versão de codebook e o `InfoTooltip` com
  `QUALITY_MATRIX_LEGEND` (sozinha, sem `MATRIX_SCOPE_NOTE`).
- **`page.tsx`:** a `Section` da Qualidade virou `flex flex-col gap-4` com `QualityPanel` e a
  matriz embaixo. O `help` da `Section` **não** ganhou meia frase: a legenda já está no tooltip da
  matriz.
- **Testes:** helpers novos em `(tabs)/rounds/page.int.test.ts`: `qualityMatrixOf`,
  `qualityMatrixTextOf`, `qualityCellsOf` (texto de cada `<td>` na ordem do markup), a forma
  `MATRIX_SHAPE` (geral Clareza + Profundidade de Informacional + Precisão de Transacional), `note()`
  e a cena `qualityMatrixScene(admin, { phase, carla })`. 9 testes novos; o do Avaliador ganhou
  `QualityMatrixTable` fora da árvore.
- **Divergência:** a varredura de cor de juízo da matriz ignora as classes `focus-visible:` — o
  `InfoTooltip` traz `focus-visible:ring-brand-ring`, que é anel de foco e não tom de juízo. Se a
  série da Parte 3 tiver `InfoTooltip`/`OpenLink` na subárvore, o mesmo filtro vale.
- Suíte: 75 arquivos, 1015 testes, lint e typecheck verdes. Conferido no navegador (cena da § 2.4,
  apagada depois; `scores` vazia): "—" com o `title`, "sem nota", o par com todos primeiro, e a
  375px a tabela rola dentro do `overflow-x-auto`, sem rolagem horizontal da página.

---

# Parte 3 — A visão geral: a série, e a varredura

**Objetivo:** a série de Qualidade na visão geral do Administrador, a prova de que o Avaliador não vê
matriz nem série, e a varredura dos ACs.

**Ler antes:** seções 1 a 6, os dois "o que herda", `(tabs)/page.tsx`, `agreement-series-chart.tsx`
(os cards), `(tabs)/page.int.test.ts` (`roundWith`, `seriesOf`, `qualityOf`, `sectionWith` e os
testes da Qualidade da #73).

### 3.1 `(tabs)/rounds/quality-series-list.tsx`

`QualitySeriesList` como no D6, com o rodapé do D7.

### 3.2 `(tabs)/page.tsx`

- `const qualityPoints = agreement ? qualitySeries(agreement.rounds, agreement.observations,
  agreement.outliers) : []`.
- Nova `Section` "Qualidade por rodada" logo depois de "Qualidade na rodada N", só quando
  `qualityPoints.length > 0`, com `hint` `QUALITY_SERIES_HINT`, `help` `QUALITY_SERIES_HELP` e
  `<QualitySeriesList points={qualityPoints} projectId={project.id} />`.
- A `Section` "Concordância por rodada" **não muda**.

### 3.3 Testes da Parte 3

`(tabs)/page.int.test.ts` (novo helper `qualitySeriesOf(tree)`, no desenho de `seriesOf`):

- [ ] **O Administrador vê a série com um ponto por rodada da Fase 3**: projeto com rodadas 1 e 2 da
      Fase 2 e 3 e 4 da Fase 3; `points` tem as rodadas 3 e 4, e o texto tem "Rodada 3", "Rodada 4",
      "Codebook v…" e "Prompt v…" de cada uma, e as porcentagens.
- [ ] **Rodadas da Fase 2 não entram**: o texto da `Section` da série não tem "Rodada 1" nem
      "Rodada 2" (a série de ICR ao lado continua com as quatro).
- [ ] **Mesmos valores que a tela de rodadas**: o `pair` do ponto da rodada em foco é igual ao
      `pair` do `QualityPanel` da tela de rodadas para a mesma rodada.
- [ ] **Com outlier numa rodada, o par só nesse ponto**, com todos primeiro; o outro ponto com um
      valor só.
- [ ] **Projeto sem rodada da Fase 3 não tem a `Section`**: `QualitySeriesList` fora da árvore e
      nenhum "Qualidade" no texto da página, mesmo com o projeto já na Fase 3 e só rodadas da Fase 2.
- [ ] **O Avaliador não vê**: com rodada da Fase 3 aberta e depois fechada, `QualitySeriesList` e
      `QualityMatrixTable` fora da árvore, e o texto sem "Qualidade" nem "%" (estender o teste da
      #73 em vez de escrever outro).

### 3.4 O glossário

Conferir o verbete **Qualidade** de `docs/CONTEXT.md` contra o que ficou na tela: "na rodada
inteira, por célula e na série das rodadas da Fase 3" agora é verdade inteira. Nada a mudar, a menos
que a D1 tenha mudado; nesse caso, emendar a ADR 0011 antes do código.

### 3.5 Varredura dos ACs

Passar a tabela da § 4 linha por linha, cada uma com o teste verde que a prova. Anotar no comentário
de fechamento da issue o commit de cada Parte (a issue é fechada à mão, como as anteriores).

### 3.6 Conferência no navegador

A mesma cena da Parte 2 com uma rodada 3 da Fase 3 a mais, sem marca: a visão geral mostra
"Qualidade por rodada" com os pontos 2 e 3 (não o 1), cada um com "Codebook v…" e "Prompt v…"; o
ponto 2 com o par, o 3 com um valor só; a 375px sem rolagem horizontal. **Apagar a cena** depois.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, os ACs conferidos um a um, e a visão geral
conferida no navegador.

### O que esta Parte fechou

_(preencher ao fim da Parte 3.)_

---

## 7. Fica para depois (registrar, não construir)

- **Gráfico da série de Qualidade.** Três pequenos gráficos de colunas, um por ponto da escala (Alto
  ao longo das rodadas, Médio, Baixo), todos na mesma cor neutra, respeitariam o D5. Não é AC, e a
  lista de pontos já responde à história 11.
- **Par na matriz de ICR.** Continua registrado na #65 como fatia futura. Se entrar, as duas matrizes
  passam a se comportar igual e a meia frase de diferença da `QUALITY_MATRIX_LEGEND` sai.
- **Orientação pelo ICR** ao lado da Qualidade: #76.
- **Qualidade da última rodada da Fase 3 na confirmação do avanço**: #77.
- **Comparação de Qualidade entre as Fases 2 e 3**: CSV, #78.
