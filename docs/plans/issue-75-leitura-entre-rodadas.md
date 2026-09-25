# Plano de implementação — Issue #75: "36 — Leitura entre rodadas: fase na série de ICR e o que mudou"

Link: https://github.com/nicolasddr/tcc/issues/75
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 15 e 17; "Decisões
de Implementação › Mudanças entre rodadas" e "› Telas")
Blocked by: #70 (**fechada**, commits `9addd88`, `5b2c203`, `f9da0fd`). A rodada já grava a `phase`,
`RoundSummary` e `ReviewRound` já a trazem, e `roundInputSummary(phase)` já existe.

**A executar em 3 partes, uma por chat.** As seções 1 a 6 são o contexto comum. Quem pegar qualquer
Parte lê `AGENTS.md`, estas seis seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A série de ICR com a fase: o ponto carrega a fase, as rodadas agrupadas por fase no gráfico e nos cards | ☑ |
| 2 | O cálculo puro de "o que mudou" e as palavras | ☐ |
| 3 | "O que mudou" na tela da rodada e na lista de rodadas, a prova de que nada trava, e a varredura dos ACs | ☐ |

As Partes 1 e 2 são independentes (uma não usa nada da outra); a 3 depende da 2.

**Sem migration, sem ADR nova.** Tudo é derivado do que `listRounds` já devolve (`phase`,
`codebookVersionNumber`, `promptVersionNumber`). O verbete **Concordância (ICR)** de `docs/CONTEXT.md`
já diz que a série é "uma só para as Fases 2 e 3", com "a sua versão de codebook e a sua fase ao
lado", e o parágrafo da linha 125 já diz que "cada rodada mostra o que mudou em relação à anterior".
A regra de fundo é a **ADR 0004** (referência, nunca trava): nada desta fatia entra em
`roundBlockers`, em `canAdvance` nem em botão nenhum.

**Sem deploy especial.** Nada de `db push`.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Rodadas | `(tabs)/rounds/rounds.ts` (`RoundSummary` com `phase`, `codebookVersionNumber`, `promptVersionNumber`; `listRounds` em ordem de `roundNumber`) | **a entrada de tudo**. Nenhuma consulta nova |
| Série de ICR | `(tabs)/rounds/agreement-series.ts` (`SeriesPoint`, `agreementSeries`) | o ponto ganha `phase`; nasce o agrupamento por fase (Parte 1) |
| Teste da série | `(tabs)/rounds/agreement-series.unit.test.ts` (inclui "o módulo não exporta nenhuma função de agregação", que confere `Object.keys`) | ganha os casos de fase; a varredura de exportações é atualizada com cuidado (D3) |
| Gráfico da série | `(tabs)/rounds/agreement-series-chart.tsx` (`SeriesColumns` em SVG `preserveAspectRatio="none"` + lista de `Card`s) | ganha a fase ao lado do codebook e o agrupamento visual (Parte 1) |
| Visão geral | `(tabs)/page.tsx` (`Section` "Concordância por rodada", ramo do Administrador) | o `help` da `Section` passa a falar da fase |
| Composição por fase | `pipeline/preconditions.ts` (`PHASE_2`, `PHASE_3`); `rounds/preconditions.ts` (`roundInputSummary(phase)`) | a regra "a forma de montar muda na Fase 3" já está aqui; a frase da Parte 2 é coerente com ela |
| Tela da rodada | `(tabs)/rounds/[roundId]/page.tsx` (revisão de discordâncias; o Admin lê `roundInputSummary(round.phase)` acima da `Section`) | ganha "o que mudou", só para o Administrador (Parte 3) |
| Lista de rodadas | `(tabs)/rounds/round-list.tsx` (`RoundList`, só no ramo do Admin de `rounds/page.tsx`) | ganha "o que mudou" em cada card a partir da segunda rodada (Parte 3, D7) |
| Aviso em caixa | `app/components/ui/alert.tsx` (`Alert tone="notice"`, sem `role`) | o aviso de codebook e prompt juntos |
| Testes de página | `(tabs)/page.int.test.ts` (`seriesOf`, `seriesMarkupOf`, `seriesTextOf`, `roundWith` com `phase`), `(tabs)/rounds/[roundId]/page.int.test.ts` (`roundWith(admin, n, { phase })`, `textOf`, `listTextOf`, o teste "o avaliador na mesma rodada não lê a fase"), `(tabs)/rounds/page.int.test.ts` (`listOf`, `markupTextOf`) | onde entram as provas de página |
| Helpers | `test/helpers.ts` (`addRound(..., { roundNumber, status, phase })`, versões de codebook e prompt) | nada novo precisa nascer, salvo um atalho de cena se ficar repetitivo |

O que **falta** e esta fatia cria: `phase` no ponto da série, o agrupamento por fase no desenho,
o módulo puro de mudanças entre rodadas com as suas palavras, e o componente que as mostra.

---

## 2. A fatia por extenso

### A série de ICR entre fases

Continua **uma série só**, com um ponto por rodada, em ordem cronológica, cada ponto com o seu
coeficiente sobre a versão de codebook que a rodada fixou. Muda o que o ponto diz e como os pontos se
agrupam:

- cada card diz "Rodada N", **"Codebook vX · Fase F"**, o fechamento e o valor;
- as rodadas de cada fase ficam **juntas e separadas das da outra fase**: no gráfico, uma linha
  vertical tracejada entre o último ponto da Fase 2 e o primeiro da Fase 3, e embaixo das colunas um
  rótulo "Fase 2" / "Fase 3" que ocupa a largura das colunas daquela fase; na lista de cards, um
  subtítulo por fase;
- **nenhum ponto soma, média ou junta rodadas**. Agrupar é só desenho: o grupo não tem valor próprio.

A passagem da última rodada da Fase 2 para a primeira da Fase 3 com a mesma versão de codebook é a
comparação que interessa (o ICR mudou só porque a LLM passou a receber o codebook?). O `help` da
`Section` diz isso em uma frase. Não se calcula nada a partir dessa passagem (§ 7).

### O que mudou entre rodadas

A partir da **segunda rodada do projeto**, cada rodada diz, em relação à **rodada anterior do
projeto** (a de número imediatamente menor, atravessando fases):

| Linha | Mudou | Não mudou |
|---|---|---|
| Codebook | "Codebook: v3 → v4" | "Codebook: v4, o mesmo" |
| Prompt | "Prompt: v1 → v2" | "Prompt: v2, o mesmo" |
| Fase | "Fase: 2 → 3" | "Fase: 3, a mesma" |

(textos sugeridos; os definitivos saem na Parte 2 e moram num módulo de palavras.)

Mais dois textos condicionais:

- **Codebook e prompt mudaram juntos** → aviso escrito: não dá para atribuir uma diferença no ICR ou
  na Qualidade a um nem ao outro.
- **Primeira rodada da Fase 3** → a mudança principal foi a forma de montar a entrada, que passou a
  levar o codebook completo à LLM.

A primeira rodada do projeto não mostra comparação nenhuma (nem linha dizendo "sem anterior"). Nada
disso desabilita botão, esconde conteúdo ou impede abrir rodada.

### Quem vê

| | Administrador | Avaliador |
|---|---|---|
| Série de ICR com fase | sim (visão geral, como hoje) | não (como hoje) |
| "O que mudou" na tela da rodada (`[roundId]`) | sim | **não**, pelo mesmo motivo de a #70 esconder dele a fase e o que foi à LLM |
| "O que mudou" na lista de rodadas | sim | a lista não existe para ele |

---

## 3. Decisões desta fatia

**D1. `SeriesPoint` ganha `phase: number`.** `agreementSeries` copia `round.phase`. Nada mais muda na
assinatura. `agreementSeries` continua sem filtrar por fase: Fase 2 e Fase 3 no mesmo array, na ordem
recebida.

**D2. O agrupamento é por sequência contígua, não por valor de fase.**

```ts
export type PhaseRun = { phase: number; points: SeriesPoint[] }

export function phaseRuns(points: readonly SeriesPoint[]): PhaseRun[]
```

Percorre os pontos na ordem recebida e abre um grupo novo cada vez que a fase muda. Hoje isso dá no
máximo dois grupos (2 e 3). Quando a Fase 4 existir e houver o retorno 4 → 3, a série 2, 3, 4, 3
vira quatro grupos, **sem reordenar** rodada nenhuma: a ordem cronológica vale mais que juntar todas
as rodadas de mesmo número de fase. Os pontos de cada grupo são **os mesmos objetos**, sem cópia nem
valor novo.

**D3. A varredura de exportações continua provando que não há agregação.** O teste "o módulo não
exporta nenhuma função de agregação entre rodadas" passa a esperar `['agreementSeries', 'phaseRuns']`
e ganha a asserção de que `phaseRuns(points).flatMap((run) => run.points)` é igual (por identidade,
elemento a elemento) a `points`, e de que `PhaseRun` não tem outra chave além de `phase` e `points`.
É isso que prova o AC "nenhum ponto da série agrega rodadas": o grupo não carrega número.

**D4. O desenho do agrupamento em `AgreementSeriesChart`.**

- **No SVG:** para cada fronteira entre grupos, uma `<line>` vertical tracejada em
  `x = índiceDoPrimeiroPontoDoGrupo * slot`, com `vectorEffect="non-scaling-stroke"` e
  `stroke-line-strong`, como as linhas de corte. Sem fronteira quando há um grupo só.
- **Rótulos fora do SVG.** Texto dentro de um SVG com `preserveAspectRatio="none"` estica; então os
  rótulos "Fase 2" / "Fase 3" ficam numa linha HTML logo abaixo, `flex`, com cada grupo em
  `flex: run.points.length` (os slots são iguais, então a proporção bate), `text-xs text-muted`,
  com a mesma `maxWidth` do SVG (`points.length * SLOT_MAX_PX`). Para isso, SVG e linha de rótulos
  passam a morar num `div` que carrega o `maxWidth`, em vez de o SVG carregá-lo sozinho. A linha de
  rótulos aparece mesmo com um grupo só (diz de que fase é a série).
- **Na lista:** um `<ul>` por grupo, cada um precedido de um subtítulo pequeno "Fase 2" (sugestão:
  `text-[13px] font-semibold text-ink`), com o mesmo espaçamento de hoje. O card ganha
  `· Fase {point.phase}` ao lado de "Codebook v{n}", no estilo que `RoundList` já usa
  (`font-normal text-muted`), para que o AC "fase ao lado da versão de codebook" valha no próprio
  card e não só no subtítulo.
- **Nenhuma cor nova**: a fase não tem tom. As colunas continuam coloridas pela faixa do ICR (é o
  único número com régua).

**D5. As frases da série.** O rodapé de `AgreementSeriesChart` hoje diz "cada coeficiente mede a
versão de codebook indicada ao lado dele": passa a dizer "a versão de codebook e a fase indicadas ao
lado dele". O `help` da `Section` "Concordância por rodada" em `(tabs)/page.tsx` ganha: as Fases 2 e
3 estão na mesma série; a passagem da última rodada da Fase 2 para a primeira da Fase 3 com a mesma
versão de codebook mostra o efeito de a LLM passar a receber o codebook. Sem "melhor", "pior",
"melhorou". Se a frase ficar longa, vai para o `InfoTooltip` do rodapé (convenção da `f89f5ed`).

**D6. O módulo puro de mudanças: `(tabs)/rounds/round-changes.ts`.**

```ts
export type RoundVersions = {
  roundNumber: number
  phase: number
  codebookVersionNumber: number
  promptVersionNumber: number
}

export type Change = { changed: boolean; from: number; to: number }

export type RoundChanges = {
  previousRoundNumber: number
  codebook: Change
  prompt: Change
  phase: Change
  codebookAndPrompt: boolean
  entersPhase3: boolean
}

export function previousRoundOf<R extends RoundVersions>(
  rounds: readonly R[],
  round: RoundVersions,
): R | null

export function roundChanges(
  round: RoundVersions,
  previous: RoundVersions | null,
): RoundChanges | null
```

- `previousRoundOf`: a rodada de **maior `roundNumber` menor que o da rodada**, no array recebido (não
  depende da ordem do array nem de números contíguos). Atravessa fases.
- `roundChanges(round, null)` devolve `null`: é a primeira rodada, não há comparação.
- A comparação é pelo **número da versão congelada** de cada rodada (`codebookVersionNumber`,
  `promptVersionNumber`). O número é único por projeto e por artefato, então equivale a comparar a
  versão; é também o que a tela mostra. `RoundSummary` não traz `promptVersionId`, e não vale uma
  consulta nova para isso.
- `codebookAndPrompt = codebook.changed && prompt.changed`.
- `entersPhase3 = previous.phase < PHASE_3 && round.phase >= PHASE_3`. Com os dados de hoje isso é
  exatamente "a primeira rodada da Fase 3" (avançar para a Fase 3 exige rodada fechada na Fase 2, e
  não há volta da 3 para a 2). Quando a Fase 4 existir, uma rodada da Fase 3 depois do retorno 4 → 3
  **não** dispara a frase, e isso é o certo: a forma de montar a entrada não mudou (a Fase 4 também
  manda o codebook completo). O teste da Parte 2 fixa esse caso com `phase: 4` na anterior.
- A função **não recebe ICR nem Qualidade**. Ela descreve versões, não resultados.

**D7. Onde "o que mudou" aparece.** O AC fala em "a tela da rodada", que nas fatias anteriores
(#64, #70, #71) é `[roundId]/page.tsx`. Só que o `RoundList` só leva à revisão de rodadas
**fechadas**, e a rodada aberta é justamente a que o Administrador mais quer comparar enquanto gera e
avalia. Então:

- **`[roundId]/page.tsx`** (canônico): bloco completo, logo abaixo da linha de
  `roundInputSummary(round.phase)`, só para o Administrador, também quando a rodada está aberta (a
  página já renderiza o cabeçalho antes do `EmptyState` de rodada aberta).
- **`RoundList`**: o mesmo componente em cada card a partir da segunda rodada, entre as versões e o
  valor de ICR/Qualidade, porque é na lista que o Administrador lê os valores das rodadas lado a lado.

> **A confirmar antes da Parte 3:** se a intenção for só a tela `[roundId]`, a Parte 3 tira o
> `RoundList` e perde dois testes. O plano segue as duas.

**D8. O componente: `(tabs)/rounds/round-changes-note.tsx`**, servidor,
`RoundChangesNote({ changes }: { changes: RoundChanges })`.

- Uma linha de cabeçalho curta ("Em relação à rodada 3") e as três linhas de D6 numa lista
  `text-[13px] text-muted`, com o que mudou em `text-ink` (sem cor de juízo).
- Com `entersPhase3`: a frase da forma de montar a entrada em parágrafo próprio.
- Com `codebookAndPrompt`: `Alert tone="notice"` **sem `role`** (é informação, não alerta de
  formulário) com o aviso.
- Com `entersPhase3` **e** codebook ou prompt também mudado: o aviso ganha a variante que diz que a
  diferença também não se atribui só à forma de montar a entrada. Isso não é AC, mas sem ela a frase
  "a mudança principal foi a forma de montar a entrada" afirma mais do que se sabe. É uma constante a
  mais e um teste a mais.
- Recebe `RoundChanges` já calculado. Quem chama faz `roundChanges(...)` e só renderiza quando não é
  `null`, então a primeira rodada não gera nem o contêiner.

**D9. As palavras moram em `(tabs)/rounds/round-changes-labels.ts`**, no desenho de
`quality-labels.ts`: `changesHeading(previousRoundNumber)`, `codebookChangeText(change)`,
`promptChangeText(change)`, `phaseChangeText(change)`, `CODEBOOK_AND_PROMPT_NOTICE`,
`CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE`, `ENTERS_PHASE_3_NOTE`. O teste unitário das palavras varre
todas elas por palavras de juízo ("melhor", "pior", "melhorou", "piorou", "boa", "ruim",
"aprovad", "suficiente", "avançar", "Fase 4") e por qualquer verbo de proibição ("não pode abrir",
"bloque", "trava", "impede").

**D10. Nada trava, por construção.** `roundChanges` não é entrada de `roundBlockers`, de
`NewRound`, de `CloseRound` nem de `GenerateResponses`, e nenhuma dessas assinaturas muda. A prova de
página é que, numa cena em que codebook e prompt mudaram juntos, as props de `NewRound`/`CloseRound`
são as mesmas de uma cena sem mudança.

**D11. Só calcula onde a página já tem as rodadas.**

- `[roundId]/page.tsx`: hoje não carrega a lista de rodadas. Dentro da `transaction`, **só quando
  `access.isAdmin`**, chamar `listRounds(id, tx)` e devolver `changes` no `ReviewView` (`null` para o
  Avaliador e para a primeira rodada). `ReviewRound` não tem `promptVersionNumber`: em vez de
  estender `loadReviewRound`, usar o `RoundSummary` da própria rodada achado na lista
  (`rounds.find((r) => r.id === round.id)`). É uma consulta a mais, só para o Admin, e já indexada
  por projeto.
- `rounds/page.tsx`: `rounds` já está carregado; o `RoundList` calcula por card com
  `roundChanges(round, previousRoundOf(rounds, round))`. Nenhuma consulta nova.

---

## 4. Critérios de aceite × onde são provados

| AC da issue | Parte | Prova |
|---|---|---|
| A série de ICR mostra a fase de cada rodada ao lado da versão de codebook | 1 | unitário (`phase` no ponto) + página da visão geral ("Codebook v3 · Fase 2" no card) |
| As rodadas de cada fase aparecem agrupadas visualmente na série | 1 | unitário de `phaseRuns` + página (subtítulos "Fase 2" antes de "Fase 3" no markup, cada card no grupo certo) |
| Nenhum ponto da série agrega rodadas | 1 | varredura de exportações (D3) + unitário (`flatMap` dos grupos idêntico aos pontos) + página (nº de cards = nº de rodadas) |
| A tela da rodada mostra, em relação à anterior, se mudaram codebook, prompt e fase | 2, 3 | unitário de `roundChanges` + página `[roundId]` e `RoundList` |
| Quando codebook e prompt mudaram juntos, aparece o aviso escrito | 2, 3 | unitário (`codebookAndPrompt`) + página `[roundId]` como Administrador |
| Na primeira rodada da Fase 3 aparece a frase sobre a forma de montar a entrada | 2, 3 | unitário (`entersPhase3`, inclusive o caso da anterior na Fase 4) + página |
| A primeira rodada do projeto não mostra comparação | 2, 3 | unitário (`null`) + página (`RoundChangesNote` fora da árvore) |
| Nenhum desses avisos desabilita botão ou impede abrir rodada | 3 | página (D10: props de `NewRound`/`CloseRound` iguais com e sem mudança) + nenhuma assinatura de pré-condição muda |
| Testes: unitário das mudanças, unitário da série com fase, página do aviso, suíte verde | 1, 2, 3 | — |

---

## 5. Fronteira com as fatias vizinhas

**#74 (série de Qualidade)**: `quality-series.ts` e `QualitySeriesList` **não mudam**. A série de
Qualidade só tem Fase 3, então não ganha fase nem agrupamento. Se a Parte 3 quiser "o que mudou"
também nos cards da série de Qualidade, é fora de escopo (§ 7).

**#76 (orientação pelo ICR)**: a PRD põe a orientação na mesma tela da rodada. Esta fatia **não**
escreve nenhuma frase sobre para onde olhar, se a Qualidade é confiável ou o que refinar; só descreve
o que mudou. Se a #76 entrar antes, `RoundChangesNote` fica **acima** da orientação no `[roundId]`
(primeiro o que mudou, depois como ler). Nenhum texto daqui menciona a Fase 4.

**#77 (avanço da Fase 3)**: não toca `pipeline/phase-2-checklist.tsx` nem `canAdvance`.

**#78 (CSV)**: a fase já sai no CSV por lá; "o que mudou" não vira coluna.

**#63/#65 (série de ICR original)**: a marca "com exclusão", as linhas de corte, a cor por faixa e o
`AgreementValue` do card **não mudam**. A série continua desenhando o valor com todos.

---

## 6. Gotchas herdados

- **Cena no banco quebra teste de integração**: se a conferência no navegador deixar notas no banco
  local, `scores` precisa ficar vazia antes de `npm test`.
- **Sem comentários no código** e **sem Prettier** (`npx prettier` reformata o arquivo inteiro).
- **Texto em prop some das asserções**: `title`, `text` de `InfoTooltip` e o `help` da `Section` não
  aparecem em `textOf`; ler a prop via `findElement`, ou usar `markupTextOf`/`renderToStaticMarkup`.
- **`cx` não resolve conflito Tailwind**: className extra perde para a variante conforme a ordem do
  CSS; usar sufixo `!` se precisar sobrescrever o `Alert`.
- **Rodada aberta no `[roundId]`**: o `EmptyState` de rodada aberta já existe; o bloco de mudanças
  entra **antes** da `Section`, então aparece nos dois estados. Conferir que o teste cobre a rodada
  aberta.
- **Captura do preview**: se o screenshot sair preto, provar por DOM (`get_page_text`, `read_page`) e
  `resize_window` para 375px. 375px só vale medido em iframe.

---

# Parte 1 — A série de ICR com a fase

**Objetivo:** cada ponto da série carrega a fase; gráfico e cards agrupam as rodadas por fase, sem
valor novo.

**Ler antes:** seções 1 a 6, `agreement-series.ts`, `agreement-series.unit.test.ts`,
`agreement-series-chart.tsx`, a `Section` "Concordância por rodada" em `(tabs)/page.tsx` e os
helpers `seriesOf`/`seriesMarkupOf`/`seriesTextOf` de `(tabs)/page.int.test.ts`.

### 1.1 `agreement-series.ts`

- `SeriesPoint` ganha `phase` (D1).
- Nova `phaseRuns` e o tipo `PhaseRun` (D2).

### 1.2 `agreement-series-chart.tsx`

- Divisores no SVG e linha de rótulos HTML embaixo, com o `maxWidth` num `div` que envolve os dois
  (D4).
- Cards agrupados por `phaseRuns`, com subtítulo por fase e `· Fase N` ao lado do codebook (D4).
- Rodapé com a frase nova (D5).

### 1.3 `(tabs)/page.tsx`

- `help` da `Section` "Concordância por rodada" (D5).

### 1.4 Testes da Parte 1

Em `agreement-series.unit.test.ts` (o helper `round()` ganha um parâmetro `phase`, com default 2 para
não mexer nos testes de hoje):

- [ ] **A série carrega a fase de cada rodada**: rodadas 1–2 na Fase 2 e 3–4 na Fase 3 →
      `points.map((p) => p.phase)` é `[2, 2, 3, 3]`, na ordem recebida.
- [ ] **As duas fases numa série só**: o número de pontos é o número de rodadas, sem filtro.
- [ ] **`phaseRuns` agrupa por sequência**: `[2, 2, 3, 3]` → dois grupos, `phase` 2 e 3, com 2 pontos
      cada; um grupo só quando todas são da mesma fase; array vazio → `[]`.
- [ ] **Sem reordenar**: `[2, 3, 4, 3]` → quatro grupos, na ordem recebida (prepara o retorno 4 → 3).
- [ ] **O grupo não tem valor**: `flatMap` dos grupos é `toBe` elemento a elemento dos pontos
      originais; `Object.keys(run)` é `['phase', 'points']`.
- [ ] **Varredura de exportações** atualizada para `['agreementSeries', 'phaseRuns']` (D3).
- [ ] Os testes de hoje continuam passando sem asserção mudada (só o helper ganhou parâmetro).

Em `(tabs)/page.int.test.ts` (cena: rodadas 1–2 da Fase 2 com Codebook v1/v2, rodadas 3–4 da Fase 3,
a 3 com a **mesma** versão de codebook da 2):

- [ ] **O card diz a fase ao lado do codebook**: `seriesTextOf(tree)` contém "Codebook v2 · Fase 2" e
      "Codebook v2 · Fase 3" (a mesma versão nas duas fases, em cards distintos).
- [ ] **Agrupamento visual**: no markup, o subtítulo "Fase 2" vem antes do card da rodada 1 e o
      "Fase 3" vem depois do card da rodada 2 e antes do da 3; cada `<ul>` tem os cards da sua fase.
- [ ] **Rótulos do gráfico**: `seriesMarkupOf(tree)` tem os dois rótulos de fase e **uma** linha
      divisória (uma fronteira); numa cena só da Fase 2, zero divisórias e um rótulo.
- [ ] **Um ponto por rodada**: quatro cards para quatro rodadas; nenhum texto de média, "total" ou
      valor por fase.
- [ ] Os testes existentes da série (ordem cronológica, rodada sem avaliação, série vazia, marca de
      outlier) continuam verdes sem asserção mudada. Se algum comparar o texto exato do rodapé,
      atualizar só a frase (D5).

### 1.5 Conferência no navegador

Supabase local, `npm run dev:local`, `/dev/login`. Cena: rodadas 1–2 da Fase 2 e 3–4 da Fase 3, a 3
com o mesmo codebook da 2, notas suficientes para ICR calculável em pelo menos três. Conferir na visão
geral: a divisória cai entre a coluna 2 e a 3; os rótulos "Fase 2" / "Fase 3" ficam embaixo das
colunas certas também com 2 e com 6 rodadas (a proporção do `flex` bate com os slots); a 375px,
sem rolagem horizontal da página. **Apagar a cena** depois (`scores` vazia).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, e a tela conferida.

### O que a Parte 2 herda

- **Nomes finais** como no D1/D2: `SeriesPoint.phase`, `PhaseRun = { phase; points }`, `phaseRuns(points)`.
  Exportações de `agreement-series.ts`: `['agreementSeries', 'phaseRuns']`.
- **D4 como planejado**, com dois detalhes: o subtítulo de cada grupo na lista é um `<h3>` (a
  `Section` usa `<h2>`), e a linha de rótulos embaixo do SVG é `aria-hidden`, como o próprio SVG (a
  leitura por leitor de tela fica com os `<h3>`). Sem `data-*` para teste: a divisória é achada no
  markup como a `<line>` com `x1 == x2` e `y1="0"`, e os rótulos como o texto antes do primeiro `<h3>`.
- **D5**: o rodapé diz "a versão de codebook e a fase indicadas ao lado dele"; o `help` da `Section`
  ganhou a fase e a frase "As Fases 2 e 3 ficam na mesma série: da última rodada da Fase 2 para a
  primeira da Fase 3 com a mesma versão de codebook, a diferença mostra o efeito de a LLM passar a
  receber o codebook." Nada foi para o `InfoTooltip` do rodapé.
- **Testes**: `agreement-series.unit.test.ts` com 13 (7 novos + a varredura de exportações ampliada);
  `(tabs)/page.int.test.ts` com 5 novos (cena `phaseSeriesScene`: 1–2 na Fase 2, 3–4 na Fase 3, a 3
  com o Codebook v2 da 2, criada com `addCodebookVersion` + `addRound` direto, porque `roundWith`
  sempre cria versão nova). Nenhuma asserção existente mudou. Suíte: 75 arquivos, 1031 testes.
- **Conferência no navegador** feita com 2, 4 e 6 rodadas (divisória entre a última coluna da Fase 2
  e a primeira da Fase 3, rótulos com a largura exata das colunas da sua fase) e a 375px medida em
  iframe (nada da `Section` passa de 375). Cenas apagadas; `scores` vazia.

---

# Parte 2 — O cálculo puro de "o que mudou" e as palavras

**Objetivo:** `roundChanges` e `previousRoundOf` testados em unitário, e as frases prontas e
varridas, sem tocar em tela.

**Ler antes:** seções 1 a 6, `rounds.ts` (`RoundSummary`), `rounds/preconditions.ts`
(`roundInputSummary`), `quality-labels.ts` e `quality-labels.unit.test.ts` (o desenho da varredura
de palavras).

### 2.1 `(tabs)/rounds/round-changes.ts`

`RoundVersions`, `Change`, `RoundChanges`, `previousRoundOf`, `roundChanges` (D6). Importa
`PHASE_3` de `pipeline/preconditions.ts`. `RoundSummary` satisfaz `RoundVersions` sem adaptação.

### 2.2 `(tabs)/rounds/round-changes-labels.ts`

As constantes e funções de texto do D9. A frase de `ENTERS_PHASE_3_NOTE` tem de ser coerente com
`roundInputSummary(PHASE_3)`: "o codebook completo" com as mesmas palavras.

### 2.3 Testes da Parte 2

`round-changes.unit.test.ts`:

- [ ] **Só codebook**: v3 → v4, prompt igual, fase igual → `codebook.changed` verdadeiro,
      `prompt.changed` e `phase.changed` falsos, `codebookAndPrompt` falso, `entersPhase3` falso.
- [ ] **Só prompt**: o espelho.
- [ ] **Os dois**: `codebookAndPrompt` verdadeiro.
- [ ] **Nenhum**: tudo falso, e ainda assim devolve objeto (não `null`): a segunda rodada sempre diz
      que nada mudou.
- [ ] **Troca de fase**: última rodada da Fase 2 → primeira da Fase 3, mesma versão de codebook e de
      prompt → `phase` `{ changed: true, from: 2, to: 3 }`, `entersPhase3` verdadeiro,
      `codebookAndPrompt` falso.
- [ ] **Segunda rodada da Fase 3**: anterior também na Fase 3 → `entersPhase3` falso.
- [ ] **Retorno da Fase 4**: anterior na Fase 4, rodada na Fase 3 → `phase.changed` verdadeiro,
      `entersPhase3` falso (D6).
- [ ] **Primeira rodada**: `roundChanges(round, null)` é `null`.
- [ ] **`previousRoundOf`**: acha a de número imediatamente menor atravessando fases; devolve `null`
      para a primeira; funciona com o array fora de ordem e com números não contíguos (1, 2, 5 → a
      anterior da 5 é a 2).
- [ ] **`from`/`to`** carregam os números das duas rodadas mesmo quando não mudou.

`round-changes-labels.unit.test.ts`:

- [ ] Cada texto de linha diz as duas versões quando mudou e uma quando não mudou.
- [ ] `ENTERS_PHASE_3_NOTE` fala da forma de montar a entrada e do codebook completo.
- [ ] `CODEBOOK_AND_PROMPT_NOTICE` diz que a diferença não se atribui a um nem ao outro; a variante
      com entrada fala também da forma de montar a entrada.
- [ ] Varredura de palavras de juízo e de trava em todas as exportações de texto (D9).
- [ ] Nenhum texto menciona a Fase 4.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes.

### O que a Parte 3 herda

(preencher ao terminar: nomes finais das exportações, textos definitivos, números da suíte.)

---

# Parte 3 — "O que mudou" nas telas, e a varredura

**Objetivo:** o Administrador lê o que mudou na tela da rodada e na lista de rodadas; o Avaliador não;
nada trava. Fechar a issue.

**Ler antes:** seções 1 a 6, os dois "o que herda", `[roundId]/page.tsx`, `round-list.tsx`,
`rounds/page.tsx`, `app/components/ui/alert.tsx` e os testes `[roundId]/page.int.test.ts` ("o
Administrador lê o que a rodada mandou à LLM" e "o avaliador na mesma rodada não lê a fase").

### 3.1 `(tabs)/rounds/round-changes-note.tsx`

`RoundChangesNote({ changes })` (D8).

### 3.2 `[roundId]/page.tsx`

- `ReviewView` ganha `changes: RoundChanges | null`. Dentro da `transaction`, só para o Admin:
  `listRounds`, achar a rodada e a anterior, `roundChanges` (D11). No `empty` e para o Avaliador,
  `null`.
- Renderizar `<RoundChangesNote changes={changes} />` logo abaixo da linha de
  `roundInputSummary`, dentro do mesmo `isAdmin`, só quando `changes` não é `null`.

### 3.3 `round-list.tsx`

- Por card, `roundChanges(round, previousRoundOf(rounds, round))`; quando não é `null`, o
  `RoundChangesNote` entre a linha de "Aberta em … por …" e o `AgreementValue` (D7). Se o bloco
  completo pesar demais no card, o componente ganha uma prop `compact` que tira o cabeçalho e junta
  as três linhas numa só separada por " · ", mantendo aviso e frase da Fase 3.

### 3.4 Testes da Parte 3

Em `[roundId]/page.int.test.ts` (cena: projeto com rodadas encadeadas; `roundWith` provavelmente
precisa de uma variante que crie a rodada seguinte no **mesmo** projeto com versões novas de codebook
e/ou prompt — criar o helper aqui, no desenho de `roundWith`):

- [ ] **O aviso de codebook e prompt juntos aparece para o Administrador**: rodada 2 com Codebook e
      Prompt novos → o texto tem `CODEBOOK_AND_PROMPT_NOTICE` e as três linhas.
- [ ] **Só codebook**: sem o aviso, com a linha do codebook mudado e as de prompt e fase iguais.
- [ ] **Primeira rodada da Fase 3**: rodada 1 Fase 2 fechada, rodada 2 Fase 3 com as mesmas versões
      → `ENTERS_PHASE_3_NOTE` no texto, sem o aviso.
- [ ] **Primeira rodada do projeto**: `findElement(tree, RoundChangesNote)` é `null`, e nenhum texto
      "Em relação à rodada".
- [ ] **Rodada aberta**: o bloco aparece também com a rodada aberta (junto do `EmptyState`).
- [ ] **O Avaliador não vê**: o teste "o avaliador na mesma rodada não lê a fase nem o que foi à LLM"
      ganha a cena com codebook e prompt mudados e `findElement(tree, RoundChangesNote) === null`, sem
      o aviso no texto.

Em `(tabs)/rounds/page.int.test.ts`:

- [ ] **Na lista, a partir da segunda rodada**: três rodadas → o card da 1 sem `RoundChangesNote`,
      os da 2 e da 3 com, cada um em relação à anterior (confere os números no texto).
- [ ] **Nada trava (D10)**: numa cena em que a última rodada fechada mudou codebook e prompt juntos,
      `NewRound` recebe `blockers` vazio (com codebook e prompt completos), igual à cena sem mudança;
      com rodada aberta nas mesmas condições, as props de `CloseRound` e `GenerateResponses` não têm
      campo novo e nenhum botão tem `disabled` por causa do aviso.

### 3.5 O glossário

`docs/CONTEXT.md` já descreve a série entre fases e "cada rodada mostra o que mudou". Conferir se
precisa de meia frase no verbete **Rodada** ("a partir da segunda, diz o que mudou em relação à
anterior do projeto, atravessando fases"). Só mexer se a leitura atual deixar dúvida.

### 3.6 Varredura dos ACs

Percorrer a tabela da § 4 marcando cada linha com o teste que a prova. Marcar os checkboxes da issue
no GitHub só depois da suíte verde.

### 3.7 Conferência no navegador

Supabase local, `npm run dev:local`, `/dev/login`. Cena: rodada 1 (Fase 2, Codebook v1, Prompt v1),
rodada 2 (Fase 2, Codebook v2, Prompt v2), rodada 3 (Fase 3, Codebook v2, Prompt v2), rodada 4 aberta
(Fase 3, Codebook v3, Prompt v2). Conferir: na lista, o card da 1 sem bloco, o da 2 com o aviso, o da
3 com a frase da forma de montar a entrada e o da 4 só com o codebook; na tela `[roundId]` de cada
uma, o mesmo, abaixo da linha do que foi à LLM; logado como avaliador, nada disso; "Nova rodada" /
"Fechar rodada" habilitados; a 375px, o `Alert` quebra linha sem rolagem horizontal. **Apagar a
cena** depois (`scores` vazia).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, a tela conferida, e a tabela da § 4 toda
provada.

### O que esta Parte fechou

(preencher ao terminar: commits, números da suíte, divergências.)

---

## 7. Fica para depois (registrar, não construir)

- **Destacar a passagem Fase 2 → Fase 3 com o mesmo codebook na série** (ex.: uma frase no rodapé
  "da rodada 2 para a 3 só mudou a forma de montar a entrada"). Seria a leitura mais direta da
  história 15, mas é derivar comparação entre pontos, e a issue pede só fase e agrupamento. O `help`
  da `Section` já aponta para essa leitura.
- **"O que mudou" na série de Qualidade** e na série de ICR (um marcador por ponto). Não é AC.
- **Prévia na "Nova rodada"** ("a próxima rodada vai usar Codebook v4 e Prompt v3, os dois novos em
  relação à rodada 3"). Seria útil antes de gastar uma rodada, mas é outra tela e outra frase; se
  entrar, reaproveita `roundChanges` com a versão vigente no lugar da rodada nova.
- **Orientação pelo ICR** na tela da rodada: #76.
- **Fase e mudança no CSV**: #78 (a fase); "o que mudou" não vira coluna.
