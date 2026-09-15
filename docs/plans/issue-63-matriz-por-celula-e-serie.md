# Plano de implementação — Issue #63: "25b — Matriz definição por critério e série de ICR por rodada"

Link: https://github.com/nicolasddr/tcc/issues/63
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 38 e 39, e a parte
de invisibilidade da 35)
Blocked by: #62 (fechada) — "Concordância: módulo de cálculo e ICR da rodada"

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60, #61 e #62.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Agrupar por célula, sem tela: `agreement-matrix.ts`, os quatro estados de célula e os rótulos | ☑ |
| 2 | A matriz na tela do Administrador, sobre a versão de codebook que a rodada fixou | ☑ |
| 3 | A série de ICR por rodada na página do projeto, e a invisibilidade ao Avaliador | ☑ |

**Nenhuma ADR nova.** As decisões que esta fatia usa já estão registradas: ADR 0002 (prompt e codebook
separados — é a matriz por célula que torna essa separação útil), ADR 0004 (faixa de referência sem
trava), ADR 0011 (ICR invisível ao Avaliador). Uma convenção pequena nasce aqui e vai para o
glossário, não para uma ADR: a diferença entre célula **não aplicável** e célula **não calculável**
(§ 2).

**Sem migration.** Nada de tabela nova nem de coluna nova: as duas leituras são derivadas das notas
que a #60 grava e das observações que a #62 já sabe carregar. Não há `db push` em prod no deploy
desta fatia.

---

## 1. Ponto de partida

A #62 deixou o motor pronto e o recorte por rodada resolvido. Esta fatia **não toca em
`lib/agreement.ts`**: ela filtra e agrupa as mesmas observações antes de chamar a mesma função.

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| O coeficiente | `lib/agreement.ts` (`ordinalAlpha`) | chamado uma vez por célula (Parte 1) e uma vez por rodada (Parte 3) |
| Observações com os ids crus | `(tabs)/rounds/agreement.ts` (`RoundObservation` tem `definitionId` e `criterionId`) | é por isso que agrupar por célula não precisa de consulta nova |
| Observações de todas as rodadas de uma vez | `loadProjectObservations` → `Map<roundId, RoundObservation[]>` | a série inteira sai daqui, sem N+1 |
| Esforço por avaliador | `listEvaluatorEffort` | já ligado ao painel; segue como está |
| Faixa, tom, formato e N | `(tabs)/rounds/agreement-labels.ts` | reaproveitado inteiro; ganha só os rótulos de célula |
| Painel e valor compacto | `(tabs)/rounds/agreement-panel.tsx` (`AgreementPanel`, `AgreementValue`) | o painel recebe a matriz ao lado; `AgreementValue` vira o ponto da série |
| Células de uma versão de codebook | `pipeline/criteria.ts` (`resolveCells`, `criteriaOfDefinition`, `isGeneral`) | quem decide se um par definição × critério **existe** |
| Definições e critérios de uma versão específica | `pipeline/codebook.ts` (`loadCodebookVersion`) | a matriz é sobre a versão **da rodada**, não sobre a vigente |
| Rodadas em ordem cronológica | `(tabs)/rounds/rounds.ts` (`listRounds`, já ordena por `roundNumber`) | a série é esta lista com um número em cada linha |
| Visão geral do projeto | `(tabs)/page.tsx` | onde a série entra, dentro do bloco que só o Administrador recebe |

O que **falta** e esta fatia cria: agrupar observações por célula, distinguir os estados de uma
célula, desenhar a matriz e desenhar a série.

---

## 2. As duas leituras, por extenso

### A matriz

A unidade de análise continua sendo resposta × célula, como a #62 fixou. A matriz não muda o
cálculo: ela **recorta** as observações da rodada por `definitionId` e `criterionId` e chama
`ordinalAlpha` em cada recorte. O `unitId` dentro de um recorte já é único por resposta, então o
coeficiente da célula é o Alpha daquela célula ao longo das respostas da rodada.

Uma célula tem **quatro** estados, e confundi-los é o erro que o AC proíbe:

| Estado | Quando | O que a tela mostra |
|---|---|---|
| `calculated` calculável | há observações e `ordinalAlpha` devolve valor | o número, com o tom da faixa |
| `calculated` não calculável | há observações, mas o coeficiente não existe (`few_evaluators`, `no_shared_units`, `no_variation`) | "não calculável" com o motivo curto |
| `unrated` | a célula **existe** na versão de codebook da rodada, e ninguém ainda deu nota nela | "sem nota" |
| `not_applicable` | o par definição × critério **não existe** na versão: o critério é específico de outra definição | traço, em tom neutro |

`unrated` é um estado à parte porque `ordinalAlpha([])` devolve `few_evaluators`, e "menos de dois
avaliadores enviaram avaliação nesta rodada" seria uma frase falsa embaixo de uma célula que
simplesmente ninguém abriu ainda. E `not_applicable` é à parte porque um critério específico da
definição A **nunca** vai ter nota na definição B — isso não é falta de dado, é o formato do
codebook. Em nenhum dos quatro estados aparece zero.

### A série

Um ponto por rodada, na ordem cronológica que `listRounds` já devolve, cada ponto com: o número da
rodada, o coeficiente (ou "não calculável"), a faixa, e **a versão de codebook que aquela rodada
fixou**. A versão junto do ponto é AC, e é o que impede a leitura errada de que a curva mede sempre
a mesma coisa.

**Não existe média, nem soma, nem "ICR do projeto", em tela nenhuma.** A série é a resposta da fase;
a média apagaria a curva e misturaria versões diferentes de codebook. Um teste da Parte 3 afirma
isso sobre o texto renderizado, e não só sobre a intenção.

---

## 3. Decisões desta fatia

**A matriz mora na seção de concordância da rodada em foco, e "em foco" passa a ser a rodada aberta,
se houver, senão a última rodada do projeto.** Hoje a seção inteira vive dentro do `openRound ? …` da
`(tabs)/rounds/page.tsx`, o que significa que ela desaparece exatamente no momento em que serve para
alguma coisa: o Administrador fecha a rodada, o codebook destrava, e é aí que ele pergunta onde
refinar. Com "rodada em foco", o ciclo fecha: fechar a rodada N → ler a matriz da rodada N → refinar
→ abrir a rodada N+1.

**Nenhuma rota nova.** A tela por rodada, com navegação entre respostas, é da #64 (revisão de
discordâncias), e criar `/rounds/[roundId]` aqui seria decidir por ela. Consequência assumida: a
matriz de uma rodada antiga não é alcançável nesta fatia (§ 5).

**A matriz é sobre a versão de codebook da rodada, não sobre a vigente.** Depois de fechada a rodada
1 e refinado o codebook, a versão vigente é a 2 — e desenhar a matriz da rodada 1 com as definições
da v2 mostraria colunas que ninguém avaliou e esconderia as que foram avaliadas. Por isso a Parte 2
carrega `loadCodebookVersion(projectId, round.codebookVersionId)`, e por isso `listRounds` passa a
devolver `codebookVersionId`.

**A forma é tabela de verdade: definições nas linhas, critérios nas colunas.** É o que o AC descreve
e é o que vai para a monografia. As colunas saem ordenadas **gerais primeiro, depois os específicos
na ordem das definições**, o que agrupa os específicos perto da linha a que pertencem e deixa o bloco
denso (os gerais, que valem para todas) à esquerda. A tabela vai dentro de um contêiner com rolagem
horizontal própria, e a página nunca rola na horizontal.

**O tom da célula vem da mesma `agreementBand`** que o painel usa, pelo valor cru. Nada de escala de
cor nova: a faixa da ADR 0004 é a única régua na tela, e repetir os mesmos três tons faz a matriz ser
lida com o mesmo vocabulário do número grande logo acima.

**Os rótulos de célula são curtos e têm legenda.** Dentro de uma célula não cabe a frase de
`notCalculableMessage`. Nascem versões curtas ("1 avaliador", "sem cruzamento", "sem variação", "sem
nota"), e uma legenda abaixo da tabela explica cada uma por extenso. O texto longo continua existindo
e continua sendo o do painel.

**A série é desenho mais lista, e a lista é a fonte de verdade.** O gráfico é um SVG simples de
colunas, com marcas nos cortes 0,667 e 0,8, e é `aria-hidden`: quem lê por leitor de tela, e todo
teste desta fatia, leem a lista textual de pontos. Alpha negativo tem a **altura da coluna** presa em
zero, e o número exibido continua o cru, com o sinal — aparar o número seria mentir, aparar o desenho
é só não desenhar para fora do eixo.

**A série é carregada dentro do bloco do Administrador da visão geral.** O mesmo `viewerIsAdmin` que
já decide os cartões de codebook, prompt e itens decide a série: o Avaliador não recebe nem os dados,
não só não vê o componente.

---

## 4. Fronteira com as fatias vizinhas

**#64 (revisão de discordâncias)** é dona da tela por rodada, da navegação entre respostas, da
classificação de divergência (unânime, adjacente, extrema) e das justificativas por avaliador. Esta
fatia não classifica divergência e não mostra nota de avaliador nenhum: a matriz mostra **coeficiente
por célula**, e nada mais.

**#65 (outliers)** é dona da marca e do "com todos e sem os marcados, lado a lado". A costura é a
mesma da #62: excluir alguém é um `filter` sobre as observações antes de agrupar. Não criar nada de
outlier aqui — nem coluna, nem parâmetro, nem prop reservada.

**#67 (exportação CSV)** é dona do dado bruto por linha. A matriz não é um caminho de exportação, e
não deve ganhar botão de baixar nada aqui.

**#68 (avançar da Fase 2 para a 3)** continua sem olhar métrica. Nenhuma action desta fatia calcula
coeficiente; quem chama `ordinalAlpha` continua sendo só página.

---

# Parte 1 — Agrupar por célula, sem tela

**Objetivo:** dada a lista de observações de uma rodada e a versão de codebook que ela fixou, produzir
a matriz já resolvida, com os quatro estados de célula. Puro, sem banco, sem React.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `lib/agreement.ts`,
`(tabs)/rounds/agreement.ts`, `(tabs)/rounds/agreement-labels.ts` e `pipeline/criteria.ts`.

### 1.1 `(tabs)/rounds/agreement-matrix.ts`

```ts
export type MatrixCell =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'calculated'; agreement: Agreement }

export type MatrixColumn<C> = { criterion: C; isGeneral: boolean }

export type MatrixRow<D, C> = {
  definition: D
  cells: { column: MatrixColumn<C>; cell: MatrixCell }[]
}

export function matrixColumns<C extends CriterionScope>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
): MatrixColumn<C>[]

export function agreementMatrix<D extends DefinitionKey, C extends CriterionScope>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): MatrixRow<D, C>[]
```

- `matrixColumns`: gerais na ordem em que vêm, depois os específicos na ordem das definições. Usar
  `generalCriteria` e `ownCriteria` de `pipeline/criteria.ts` — não reimplementar o conceito de
  critério geral em lugar nenhum.
- `agreementMatrix`: uma linha por definição, na ordem recebida; uma célula por coluna. A célula é
  `not_applicable` quando o critério não está em `criteriaOfDefinition(definition.id, criteria)`;
  `unrated` quando está mas nenhuma observação casa com o par; senão `calculated` com
  `ordinalAlpha` das observações daquele par.
- Agrupar as observações **uma vez** num `Map` com chave `${definitionId}:${criterionId}`, e não
  varrer a lista inteira por célula.
- Sem `server-only`, sem `@/lib/db`. As únicas importações são de tipo, mais `lib/agreement` e
  `pipeline/criteria`.

### 1.2 Rótulos curtos em `agreement-labels.ts`

Acrescentar ao módulo que já existe, mantendo o padrão das constantes exportadas:

- `CELL_NOT_APPLICABLE = '—'` e `CELL_NOT_APPLICABLE_TITLE` ("critério específico de outra
  definição"), `CELL_UNRATED_LABEL = 'sem nota'`.
- `cellNotCalculableLabel(reason)` → "1 avaliador" / "sem cruzamento" / "sem variação".
- `MATRIX_LEGEND`: a frase única que explica os três rótulos curtos e o traço, montada a partir das
  próprias constantes, no mesmo espírito de `BAND_REFERENCE`.
- Nada de novo em `lib/agreement.ts`: ele continua com uma função exportada.

### 1.3 Testes da Parte 1

`agreement-matrix.unit.test.ts` e casos novos em `agreement-labels.unit.test.ts`:

- **Célula sem nota não vira zero** (AC do issue, e o caso mais importante da Parte): definição com
  critério, nenhuma observação naquele par → `state: 'unrated'`, e nenhuma asserção produz `0`.
- **Célula não aplicável ≠ não calculável**: critério específico da definição A produz
  `not_applicable` na linha da definição B, e o rótulo é o traço, não o de não calculável.
- **Critério geral rende uma célula por definição, com valores próprios**: montar observações em que
  o mesmo critério geral concorda na definição A e discorda na definição B, e afirmar que os dois
  alphas são diferentes. É a prova, em teste, de que a unidade é resposta × célula.
- **Célula com um avaliador só**: `calculated` com `calculable: false`, `reason: 'few_evaluators'`, e
  o rótulo curto correspondente.
- **Célula calculável**: quatro respostas, dois avaliadores, `A = [1,2,3,1]` e `B = [1,2,3,2]` no
  mesmo par → `alpha` de `0.79`, o mesmo valor já conferido no papel na #62.
- **Ordem das colunas**: gerais antes dos específicos, e específicos na ordem das definições.
- **Observações de outra célula não vazam**: notas de um par não entram no coeficiente do par
  vizinho.

### Pronto quando

`npm run test:unit`, `npm run lint` e `npm run typecheck` verdes. `agreementMatrix` existe, é pura,
distingue os quatro estados, e nenhum arquivo fora de `(tabs)/rounds/agreement-matrix*.ts` e
`agreement-labels*.ts` foi tocado.

### O que a Parte 2 herda

**Assinaturas finais** (`(tabs)/rounds/agreement-matrix.ts`):

```ts
export type CriterionKey = DefinitionKey & CriterionScope

export type MatrixCell =
  | { state: 'not_applicable' }
  | { state: 'unrated' }
  | { state: 'calculated'; agreement: Agreement }

export type MatrixColumn<C> = { criterion: C; isGeneral: boolean }

export type MatrixRow<D, C> = {
  definition: D
  cells: { column: MatrixColumn<C>; cell: MatrixCell }[]
}

export function matrixColumns<C extends CriterionKey>(
  definitions: readonly DefinitionKey[],
  criteria: readonly C[],
): MatrixColumn<C>[]

export function agreementMatrix<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  observations: readonly RoundObservation[],
): MatrixRow<D, C>[]
```

**O que divergiu do plano:**

- O parâmetro de critério é `C extends CriterionKey`, e não `C extends CriterionScope`. Casar uma
  observação com uma célula exige o `id` do critério, e `CriterionScope` só tem `definitionId`.
  `CriterionKey` é o apelido de `DefinitionKey & CriterionScope` — as linhas de
  `loadCodebookVersion` já satisfazem os dois.
- Critério específico de uma definição **fora** da lista recebida não vira coluna. A Parte 2 sempre
  passa as definições e os critérios da mesma versão de codebook, então o caso não aparece na tela;
  fica registrado porque muda o que `matrixColumns` devolve se alguém filtrar as linhas.

**O que a tela precisa conhecer:**

- `agreementMatrix` devolve uma linha por definição na ordem recebida, e em cada linha uma célula
  por coluna, na ordem de `matrixColumns` — a tela pode renderizar `row.cells` direto, sem procurar
  coluna por coluna, e `MatrixColumn.isGeneral` já diz onde vai o badge "geral".
- O N da célula sai de `cell.agreement` (`units` e `raters`) com o `sampleSize` que já existe; não
  há campo novo para isso.
- Rótulos novos em `agreement-labels.ts`: `CELL_NOT_APPLICABLE` ("—"), `CELL_NOT_APPLICABLE_TITLE`,
  `CELL_UNRATED_LABEL`, `cellNotCalculableLabel(reason)` e `MATRIX_LEGEND`. `MATRIX_LEGEND` já é
  montado a partir das outras constantes e termina dizendo que nenhum desses casos vale zero.
- Nada foi tocado fora de `agreement-matrix.ts`, `agreement-matrix.unit.test.ts`,
  `agreement-labels.ts` e `agreement-labels.unit.test.ts`. `lib/agreement.ts` continua com uma
  função exportada, e `listRounds` ainda **não** devolve `codebookVersionId` — isso é o passo 2.1.

---

# Parte 2 — A matriz na tela do Administrador

**Objetivo:** a matriz aparece na seção de concordância, sobre a versão de codebook que a rodada
fixou, e continua acessível depois que a rodada fecha.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 2 herda" da Parte 1,
`(tabs)/rounds/page.tsx`, `agreement-panel.tsx`, `page.int.test.ts` da mesma pasta,
`pipeline/codebook.ts` e `app/components/ui/{card,badge,section}.tsx`.

### 2.1 `codebookVersionId` em `RoundSummary`

Uma linha no `select` de `listRounds` (`rounds.ts`). É o que permite carregar a versão certa para uma
rodada **fechada**, já que `loadOpenRound` só cobre a aberta.

### 2.2 A rodada em foco em `(tabs)/rounds/page.tsx`

- `focusRound = openRound ?? rounds[rounds.length - 1] ?? null`.
- A seção "Concordância na rodada N" sai de dentro do `openRound ? …` e passa a depender de
  `focusRound`. Quando a rodada em foco está fechada, o título e a dica dizem isso ("rodada N,
  fechada em …"), para ninguém ler o número como se fosse da rodada em andamento.
- `effort`, `evaluatedResponses` e as observações do painel passam a ser os da rodada em foco.
- Dentro da mesma `transaction`, carregar `loadCodebookVersion(project.id, focusRound.codebookVersionId)`.
  Uma consulta a mais, só para a rodada em foco — a lista inteira continua barata.
- O `AgreementValue` de cada linha da lista e o mapa por rodada continuam como estão.

### 2.3 `(tabs)/rounds/agreement-matrix.tsx`

Componente de servidor, sem estado:

- Cabeçalho de coluna: nome do critério, com um `Badge tone="neutral"` discreto de "geral" nos
  gerais. Cabeçalho de linha: título da definição.
- Célula: o valor formatado com `formatAlpha` e o tom da faixa quando calculável; o rótulo curto nos
  outros três estados, em tom neutro. O N da célula (`sampleSize`) entra como `title`, para a tabela
  não ficar ilegível.
- `MATRIX_LEGEND` abaixo da tabela, e uma frase dizendo que a matriz é da versão de codebook que a
  rodada fixou, com o número da versão.
- Contêiner com `overflow-x-auto`; a página não rola na horizontal em 1100px nem em 375px.
- Quando a versão não tem definição nenhuma (rodada antiga, codebook vazio), um `EmptyState` em vez
  de uma tabela sem linha.

### 2.4 Testes da Parte 2 (`(tabs)/rounds/page.int.test.ts`)

No desenho que o arquivo já usa (`findElement`, `textOf`, `markupTextOf`):

- **Célula sem dado suficiente não vira zero** (AC): rodada com duas definições, um avaliador
  avaliando só uma delas; a matriz mostra o rótulo de não calculável / sem nota na outra, e o texto
  renderizado não contém `0,000` em célula nenhuma.
- **A matriz é da versão da rodada, não da vigente**: rodada fixa a v1, o codebook avança para a v2
  com um critério novo; a matriz da rodada 1 mostra as colunas da v1 e **não** mostra o critério que
  só existe na v2.
- **A matriz sobrevive ao fechamento**: projeto sem rodada aberta e com uma fechada → o painel e a
  matriz aparecem, com o título dizendo que a rodada está fechada.
- **Critério geral aparece em todas as definições**: duas definições, um critério geral; a matriz tem
  duas linhas com a mesma coluna, e cada uma com o seu valor.
- **Célula não aplicável**: critério específico da definição A aparece como traço na linha da B.
- **O Avaliador não alcança `/rounds`**: confirmar que o `notFound` já coberto segue verde.

### Pronto quando

`npm test`, `npm run lint` e `npm run typecheck` verdes; a matriz na tela mostra coeficiente por
célula, distingue os quatro estados e usa a versão de codebook da rodada. Verificar no navegador
(`npm run dev:local`) em 1100px e 375px — e lembrar que o screenshot sai preto pelo problema conhecido
do preview, então a conferência é por `get_page_text` e geometria via `javascript_tool`.

### O que a Parte 3 herda

**O que divergiu do plano:**

- O componente é `(tabs)/rounds/agreement-matrix-table.tsx`, exportando `AgreementMatrixTable`, e
  não `agreement-matrix.tsx`. Um par `agreement-matrix.ts` + `agreement-matrix.tsx` na mesma pasta
  seria ambíguo para `import … from './agreement-matrix'` — e não existe nenhum par assim no repo.
  O sufixo segue a convenção que já existe ao lado (`agreement.ts` → `agreement-panel.tsx`).
- A "rodada em foco" é `rounds.find(isOpen) ?? rounds[rounds.length - 1] ?? null`, sobre a lista de
  `listRounds`, e não `openRound ?? …`. É a mesma rodada, mas como `RoundSummary` ela já traz
  `codebookVersionId` e `codebookVersionNumber`, que a matriz precisa; `openRound` continua existindo
  e continua sendo quem decide a geração de respostas e o fechamento.
- O `EmptyState` cobre também o codebook sem nenhum critério, não só o sem definição: sem uma das
  duas pontas não há célula para cruzar.
- O tom da faixa entra como `Badge` com o número dentro, reaproveitando o mesmo vocabulário visual do
  `BandBadge` do painel, em vez de uma cor de fundo própria da célula.

**O que a Parte 3 pode usar:**

- `RoundSummary` agora tem `codebookVersionId` (passo 2.1), ao lado de `codebookVersionNumber`. A
  série da Parte 3 só precisa do número, que já estava lá.
- `(tabs)/rounds/page.tsx` já carrega `loadCodebookVersion` dentro da mesma `transaction`, e a seção
  de concordância vive fora do `openRound ? …`: o ciclo fechar → ler → refinar → reabrir está de pé.
- `AgreementMatrixTable` recebe `definitions`, `criteria`, `observations` e `codebookVersionNumber`
  por parâmetro — nada de consulta dentro do componente. Se a #64 criar `/rounds/[roundId]`, mover a
  matriz para lá é só mudar quem passa os quatro.
- Os helpers de cena do `page.int.test.ts` mudaram de nome e de forma: `openRoundWith` virou
  `roundWith(admin, responseCount, { shape, status })`, aceita o formato do codebook e cria rodada
  fechada; `scene.cells` agora traz `definitionTitle` e `criterionName`, e `cellsOf(scene, titulo)`
  recorta as células de uma definição. `readyProject` ganhou um terceiro parâmetro com o mesmo
  `shape`. O teste também ganhou `findSection`, que acha a `Section` que contém um componente — é
  como se afirma sobre o título de uma seção, já que `textOf` só varre `children`.
- Nada foi tocado em `lib/agreement.ts`, em `agreement.ts`, em `agreement-matrix.ts` nem em
  `agreement-labels.ts`: a Parte 2 só consome o que a Parte 1 deixou pronto.

**Conferido no navegador** (`npm run dev:local`, rodada fechada com 3 definições, 2 critérios gerais
e 2 específicos): a matriz mostra os quatro estados na mesma tabela, a página não rola na horizontal
nem em 1100px nem em 375px, e em 375px é o contêiner da tabela que rola (327px de viewport útil para
748px de tabela).

---

# Parte 3 — A série de ICR por rodada

**Objetivo:** a página do projeto mostra a evolução da concordância rodada a rodada, com a versão de
codebook em cada ponto, sem média nenhuma — e o Avaliador não vê nada disso.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 3 herda" da Parte 2, `(tabs)/page.tsx`,
`(tabs)/page.int.test.ts` e `agreement-labels.ts`.

### 3.1 `(tabs)/rounds/agreement-series.ts` — puro

```ts
export type SeriesPoint = {
  roundId: string
  roundNumber: number
  codebookVersionNumber: number
  closedAt: string | null
  agreement: Agreement
}

export function agreementSeries(
  rounds: readonly RoundSummary[],
  observations: ReadonlyMap<string, RoundObservation[]>,
): SeriesPoint[]
```

- Um ponto por rodada, na ordem recebida (que já é cronológica). Rodada sem nenhuma observação vira
  ponto não calculável — nunca some da série, e nunca vira zero.
- Nenhuma função de agregação neste módulo. Nada de `average`, `total` ou `overall`: se a função não
  existe, ninguém a chama por engano.
- Unitário `agreement-series.unit.test.ts`: ordem cronológica preservada; rodada sem avaliação vira
  ponto com `calculable: false`; duas rodadas produzem exatamente dois pontos, com as suas versões.

### 3.2 `(tabs)/rounds/agreement-series.tsx`

- Lista de pontos, um por rodada: "Rodada N", o valor (`formatAlpha` ou `NOT_CALCULABLE_LABEL`), o
  badge da faixa, "Codebook vN" e a data de fechamento quando existe. Reaproveitar `AgreementValue`
  onde couber, em vez de reescrever a linha.
- Acima da lista, um SVG de colunas: eixo de 0 a 1, linhas de referência em 0,667 e 0,8, coluna por
  rodada, altura presa em zero para alpha negativo, e cor pelo tom da faixa. `aria-hidden`, porque a
  lista logo abaixo já diz tudo.
- Uma linha de referência textual: `BAND_REFERENCE`, a mesma frase do painel.
- Vazios: sem rodada, `EmptyState` dizendo que a série começa na primeira rodada; com uma rodada só,
  o ponto aparece e o texto diz que a comparação começa na segunda.
- Link "Abrir rodadas" no padrão `OpenLink` da própria visão geral.

### 3.3 Ligação em `(tabs)/page.tsx`

- Dentro da `transaction` que já existe, e **só** no ramo `viewerIsAdmin`, carregar `listRounds` e
  `loadProjectObservations`.
- Calcular a série depois da transação, com `agreementSeries`.
- Renderizar numa `Section` própria, "Concordância por rodada", depois dos cartões de artefato e
  antes do checklist de avanço de fase.

### 3.4 Testes da Parte 3 (`(tabs)/page.int.test.ts`)

- **Versões diferentes viram pontos separados, e nada agrega as duas** (AC e teste pedido pelo
  issue): duas rodadas, uma na v1 e outra na v2, cada uma com avaliações de dois avaliadores; a tela
  mostra dois valores distintos, cada um com a sua versão; e o texto renderizado **não** contém
  `formatAlpha((a + b) / 2)` nem as palavras "média" e "no total".
- **Rodada sem avaliação continua na série**, como ponto não calculável, e não como zero.
- **Ordem cronológica**: os números de rodada aparecem em ordem crescente no texto.
- **Invisibilidade ao Avaliador**: reforçar o teste que já existe ("a visão geral vista pelo avaliador
  não fala de concordância") com um cenário que **tem** rodadas e avaliações — hoje ele passaria mesmo
  se a série vazasse, porque não há dado. Continua afirmando que o texto não contém "Krippendorff",
  "ICR" nem "Concordância".

### 3.5 Glossário

Em `docs/CONTEXT.md`, na entrada **Concordância (ICR)**, acrescentar duas frases: que não existe média
entre rodadas em tela nenhuma (o que já está implícito em "nunca agregado entre versões diferentes",
mas a proibição é explícita no AC), e a distinção entre célula **não aplicável** e célula **não
calculável**.

### Pronto quando

`npm test`, `npm run lint` e `npm run typecheck` verdes; a visão geral do Administrador mostra a série
com a versão em cada ponto, nenhum número agrega rodadas, e a do Avaliador não menciona concordância.
Fechar a #63 com referência ao commit, como nas fatias anteriores.

### O que ficou desta Parte

**O que divergiu do plano:**

- O componente é `(tabs)/rounds/agreement-series-chart.tsx`, exportando `AgreementSeriesChart`, e
  não `agreement-series.tsx` — mesma razão da Parte 2: um par `agreement-series.ts` +
  `agreement-series.tsx` na mesma pasta seria ambíguo para `import … from './agreement-series'`. O
  sufixo diz o que o componente é, como em `agreement-matrix.ts` → `agreement-matrix-table.tsx`.
- `OpenLink` saiu de dentro de `(tabs)/page.tsx` para `app/components/ui/open-link.tsx`. A série
  precisava do mesmo link, e um arquivo de `page` não pode exportar componente nomeado sem brigar
  com as convenções de export do Next. A visão geral passou a importá-lo de lá, e nada mudou no
  visual.
- O SVG tem `viewBox` de largura fixa em 100 unidades, com `preserveAspectRatio="none"` e um
  `maxWidth` de 120px por ponto. Com `meet` o desenho ficava preso ao tamanho natural (duas
  colunas de 26px num contêiner de 912px); com `none` sem teto, as colunas viravam barras de 251px
  de largura por 25px de altura. O teto por ponto mantém a coluna em ~66px em qualquer contagem de
  rodadas. As linhas de referência levam `vectorEffect="non-scaling-stroke"`, senão o tracejado
  esticava junto com a escala horizontal.
- A frase da série evita a palavra "média" no texto renderizado, e não só a operação: o teste do AC
  afirma sobre o texto, então dizer "sem média entre rodadas" quebraria a própria asserção. O texto
  diz "nenhum valor que junte rodadas".
- Um teste a mais do que o plano pedia: a série vazia (projeto sem rodada) mostra o `EmptyState` e
  leva às rodadas. E o unitário afirma que `agreement-series.ts` exporta **só** `agreementSeries` —
  é como a proibição de agregar vira teste, e não só intenção.

**O que ficou de pé:**

- `(tabs)/page.tsx` carrega `listRounds` e `loadProjectObservations` dentro da mesma `transaction`,
  só no ramo `viewerIsAdmin`, e calcula a série depois. O Avaliador não recebe os dados, e o teste
  de invisibilidade agora roda sobre um projeto **com** rodada avaliada.
- `docs/CONTEXT.md`, na entrada **Concordância (ICR)**: não existe média, soma nem "ICR do projeto"
  em tela nenhuma, e a distinção entre célula **não aplicável**, **não calculável** e **sem nota**.
- Nada foi tocado em `lib/agreement.ts`, `agreement.ts`, `agreement-matrix.ts`,
  `agreement-matrix-table.tsx` nem `agreement-labels.ts`.

**Conferido no navegador** (`npm run dev:local`, projeto com duas rodadas fechadas, uma na v1 e
outra na v2): os dois pontos aparecem em ordem, cada um com a sua versão, o gráfico desenha as duas
colunas com as linhas de corte, e a página não rola na horizontal nem em 1100px nem em 375px.

**Ponta solta conhecida (fora desta fatia):** `(tabs)/evaluate/actions.int.test.ts` afirma que a
tabela `scores` está globalmente vazia. É uma asserção global num banco local compartilhado com o
cenário de dev, então ela falha sempre que existe dado semeado à mão. Não tem relação com esta
fatia, e some com `npm run db:reset`.

---

## 5. Riscos e pontas soltas

**A matriz de uma rodada antiga não é alcançável.** A decisão de não criar rota por rodada (§ 3)
deixa visível só a rodada em foco. É consciente: a tela por rodada é da #64, e a #67 exporta o dado
bruto de qualquer rodada. Se a #64 criar `/rounds/[roundId]`, mover a matriz para lá é barato — o
componente já recebe definições, critérios e observações por parâmetro.

**Matriz esparsa.** Com muitos critérios específicos, a tabela fica larga e cheia de traços. A
ordenação das colunas (gerais primeiro) e a rolagem horizontal própria seguram o caso comum do TCC,
que é poucos critérios, quase sempre gerais. Se ficar ilegível em uso real, o caminho é uma segunda
forma de leitura (lista por definição), não encolher a tabela.

**Custo de leitura na visão geral.** `loadProjectObservations` traz todas as notas do projeto, e a
visão geral é a tela mais visitada. Só o Administrador paga, e o teto de respostas por projeto mantém
isso na casa dos milhares de linhas. Se doer, o caminho é agregar por rodada no banco — não paginar
na tela, e não gravar retrato de ICR (isso violaria a história 44).

**Ordenar as células pelo pior coeficiente** seria o jeito mais direto de responder "onde refinar", e
não é AC. Fica registrado aqui como fatia futura, de propósito fora do escopo desta.

**Deploy:** nada a fazer. Sem migration, sem variável nova, sem `db push`.
