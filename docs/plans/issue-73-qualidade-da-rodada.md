# Plano de implementação — Issue #73: "34 — Qualidade da rodada da Fase 3"

Link: https://github.com/nicolasddr/tcc/issues/73
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 9, 12, 13, 14, 25 na
parte da Qualidade, e 26)
Blocked by: #70 (**fechada**). `rounds.phase` existe, é gravada na criação e já chega em `Round`,
`OpenRound` e `RoundSummary`.

**A executar em 3 partes, uma por chat.** As seções 1 a 5 são o contexto comum. Quem pegar qualquer
Parte lê `AGENTS.md`, estas cinco seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | O cálculo puro e as palavras: distribuição, par com e sem outliers, formatação sem juízo | ☑ |
| 2 | A tela de rodadas: o bloco da Qualidade ao lado do ICR e a linha na lista de rodadas | ☑ |
| 3 | A visão geral, a prova de que o Avaliador não vê nada, e a varredura dos ACs | ☐ |

**Sem migration, sem ADR nova.** A Qualidade é derivada das notas na leitura, como o ICR: nenhuma
tabela, coluna ou cache (requisito não funcional do spec). As decisões já estão escritas: a **emenda
de 2026-09-22 da ADR 0004** (Qualidade só como distribuição, sem meta e sem "atinge") e a **emenda de
2026-09-22 da ADR 0011** (a Qualidade segue as regras de visibilidade e de outlier do ICR). O
glossário (`docs/CONTEXT.md`, verbete **Qualidade**) já descreve o comportamento final. Se algo
divergir, emenda-se a ADR, não se improvisa no código.

**Sem deploy especial.** Nada de `db push`: o schema não muda.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Notas da rodada | `(tabs)/rounds/agreement.ts` (`RoundObservation`, `loadProjectObservations`, `loadRoundObservations`) | **a entrada da Qualidade**. Cada observação é uma nota (avaliador × resposta × célula) com `value` já convertido para rank (3, 2, 1). Não muda |
| Par do ICR | `(tabs)/rounds/agreement-pair.ts` (`AgreementPair`, `agreementPair`, `withoutExcluded`) | o **desenho a copiar**. `withoutExcluded` é reaproveitado como está, para os dois números usarem o mesmo recorte |
| Marcas de outlier | `(tabs)/rounds/outliers.ts` (`loadProjectOutliers`, `loadRoundOutliers`) | já carregadas pelas duas páginas no ramo do Administrador. Nada novo a buscar |
| Escala | `(tabs)/evaluate/scale.ts` (`SCALE`, `scaleLabel`, `scaleRank`, `scaleTone`) | `SCALE` dá a ordem (Alto, Médio, Baixo), `scaleLabel` dá as palavras. **`scaleTone` não pode ser usado aqui** (§ 3, D5) |
| Painel do ICR | `(tabs)/rounds/agreement-panel.tsx` (`AgreementPanel`, `AgreementValue`) | vizinho do bloco novo. **Não muda** |
| Palavras do ICR | `(tabs)/rounds/agreement-labels.ts` | modelo de arquivo de palavras (constantes montadas a partir de rótulos, frases testadas). Não muda |
| Tela de rodadas | `(tabs)/rounds/page.tsx` | ganha a `Section` da Qualidade depois da de Concordância (Parte 2) |
| Lista de rodadas | `(tabs)/rounds/round-list.tsx` (`RoundList`) | ganha a linha da Qualidade abaixo de `AgreementValue`, só nas rodadas da Fase 3 (Parte 2) |
| Visão geral | `(tabs)/page.tsx` | ganha o bloco da Qualidade depois de "Concordância por rodada" (Parte 3) |
| Constantes de fase | `pipeline/preconditions.ts` (`PHASE_2`, `PHASE_3`) | usadas como estão |
| Card de número | `app/components/ui/stat.tsx` (`StatCard`, `ProgressBar`) | `StatCard` serve de moldura; `ProgressBar` **não** serve para as barras (usa `bg-brand`, § 3, D5) |
| Testes de página | `(tabs)/rounds/page.int.test.ts` (`roundWith`, `render`, `allTextOf`, `markupTextOf`, `findElement`), `(tabs)/page.int.test.ts`, `(tabs)/evaluate/page.int.test.ts` (`scenario`), `(tabs)/rounds/[roundId]/page.int.test.ts` | onde entram as provas de quem vê o quê |
| Helpers | `test/helpers.ts` (`addRound(..., { phase })`, `addEvaluation`, `addScore`, `addOutlier`) | nada novo precisa nascer |

O que **falta** e esta fatia cria: o módulo puro da Qualidade, as palavras dela, o bloco na tela de
rodadas e na visão geral, e a linha na lista de rodadas.

---

## 2. A fatia por extenso

### O que é a Qualidade

A distribuição das **notas** de uma rodada entre Alto, Médio e Baixo, como porcentagem, com a
contagem ao lado. O denominador é o número de notas da rodada: uma nota é uma célula
(definição × critério) avaliada por um avaliador numa resposta. Não é o número de respostas nem o de
avaliações, e a tela diz qual é ("N notas").

A Qualidade sai das **mesmas observações** que o ICR já carrega (`loadProjectObservations`). Por isso
a fatia não escreve nenhuma consulta nova: a página já tem os dados, e o que muda é quando ela os
transforma em Qualidade.

### O que a ferramenta não diz

Não diz se a Qualidade está boa. Nenhuma faixa, nenhuma meta, nenhuma palavra de juízo ("boa",
"ruim", "aprovada", "suficiente", "atinge"), nenhuma cor que signifique isso. Os três pontos da
escala aparecem com o mesmo peso visual, na mesma cor, na mesma ordem da escala. É a diferença
essencial em relação ao ICR, que tem régua da literatura (ADR 0004): a Qualidade não tem, e qualquer
régua embutida seria a ferramenta julgando uma tarefa que ela não conhece (ADR 0005).

A orientação de leitura ("com o ICR baixo, a Qualidade ainda não é confiável") **não é desta fatia**:
é a #76. Aqui o bloco só mostra os números e explica o que eles são.

### Quem vê, e onde

Só o Administrador, só em rodada da Fase 3, e só onde o ICR já aparece para ele:

| Tela | O que ganha | Quem vê |
|---|---|---|
| Rodadas (`(tabs)/rounds/page.tsx`), rodada em foco | `Section` "Qualidade na rodada N", logo depois da de Concordância, bloco separado | Administrador, se a rodada em foco é da Fase 3 |
| Rodadas, lista | linha compacta abaixo do ICR de cada rodada da Fase 3 | Administrador |
| Visão geral (`(tabs)/page.tsx`) | `Section` "Qualidade na rodada N", logo depois de "Concordância por rodada" | Administrador, se a rodada em foco é da Fase 3 |
| Revisão (`rounds/[roundId]`) | **nada**: o ICR também não aparece lá (#64) | ninguém |
| Avaliação (`evaluate`) | **nada**, e a tela continua idêntica nas Fases 2 e 3 | ninguém |

A invisibilidade para o Avaliador é **estrutural**, como a do ICR: as duas páginas já só carregam as
observações no ramo do Administrador, e a tela de rodadas do Avaliador retorna antes de qualquer
cálculo. A Qualidade é calculada depois desse ponto, então não existe caminho por onde ela chegaria
ao Avaliador, nem escondida no payload.

### Outliers

Com alguém marcado na rodada, aparecem juntos o valor com todos e o valor sem os marcados, o com todos
primeiro, exatamente como o par do ICR (#65). Sem marca, um valor só, sem sugerir que falta algo. O
recorte é o mesmo `withoutExcluded` do ICR, sobre o mesmo conjunto de marcas ativas: os dois números
nunca podem discordar sobre quem saiu.

---

## 3. Decisões desta fatia

**D1. Um módulo puro, `(tabs)/rounds/quality.ts`, ao lado de `agreement-pair.ts`.** Recebe
`readonly RoundObservation[]` e devolve a distribuição. Sem React, sem `@/lib/db`. O rank da
observação volta a ser ponto da escala comparando com `scaleRank(value)` para cada `value` de
`SCALE`; nenhuma função nova em `scale.ts`.

**D2. A forma do valor distingue "sem nota" de "0%".**

```ts
export type QualityLevel = { value: ScaleValue; count: number; share: number }

export type Quality =
  | { rated: false; total: 0 }
  | { rated: true; total: number; levels: QualityLevel[] }
```

`levels` sempre traz os três pontos, na ordem de `SCALE`, inclusive com `count: 0` quando há notas
mas nenhuma naquele ponto ("Baixo 0% · 0 notas" é informação verdadeira). `share` é a fração exata
(`count / total`), e a formatação mora nas palavras (D4). Rodada sem nota é `rated: false`, e é a
tela que diz "ainda não há notas", nunca 0% (AC). Com isso é impossível desenhar 0% para uma rodada
vazia por descuido: não há `levels` para desenhar.

**D3. O par copia o desenho do par do ICR.**

```ts
export type QualityPair = {
  all: Quality
  withoutOutliers: Quality | null
  excluded: number
}

export function qualityPair(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): QualityPair
```

`withoutOutliers` é `null` quando `excluded.size === 0`, e aí a tela mostra um valor só. Quando todas
as notas eram de marcados, `withoutOutliers` é `{ rated: false }`, e a tela diz que não sobra nota
depois da exclusão, ao lado do valor com todos, que continua lá. `all` não é opcional em lugar nenhum.

**D4. As palavras moram em `(tabs)/rounds/quality-labels.ts`**, no espírito de `agreement-labels.ts`:

- `QUALITY_LABEL = 'Qualidade'`
- `QUALITY_UNRATED` (rodada sem nota) e `QUALITY_UNRATED_WITHOUT_OUTLIERS` (sobrou nenhuma nota
  depois da exclusão)
- `QUALITY_HELP`: o que o número é (distribuição das notas da rodada entre os três pontos da
  escala), qual é o denominador (notas, e não respostas), e que a ferramenta não define meta nem diz
  se o valor basta. **Sem** orientação de leitura pelo ICR, que é da #76.
- `formatShare(share: number): string` → porcentagem em pt-BR com no máximo uma casa decimal
  (`'62,5%'`, `'100%'`, `'0%'`). A soma arredondada pode não dar 100: é por isso que a contagem
  vai ao lado, e o `QUALITY_HELP` diz isso em meia frase.
- `qualityTotal(total: number)` → `plural(total, 'nota', 'notas')`.
- Reaproveitar `AGREEMENT_ALL_LABEL` e `AGREEMENT_WITHOUT_OUTLIERS_LABEL` de `agreement-labels.ts`
  para os rótulos do par, em vez de criar outros: "com todos" tem de ser a mesma expressão nos dois
  números.

**D5. Nenhuma cor de juízo, com prova.** O bloco não usa `scaleTone`, não usa `Badge` com tom
`success`/`warning`/`danger`, e não usa `ProgressBar` (que pinta em `bg-brand`, a cor de ação da
aplicação). As barras são um `div` por nível, **a mesma cor neutra para os três** (conferir o token
em `app/globals.css`; algo como `bg-faint` ou `bg-line`), com `aria-hidden` porque o texto ao lado já
diz tudo. A prova é teste de página (Parte 2): nenhum elemento dentro do bloco tem classe de tom de
juízo. Na tela do Avaliador `scaleTone` continua existindo, e é lá que a cor faz sentido: é o ponto
que ele está escolhendo, não um veredito sobre a LLM.

**D6. Um predicado só decide se a rodada tem Qualidade.**

```ts
export function hasQuality(phase: number): boolean  // phase >= PHASE_3
```

Em `quality.ts`. É a única comparação de fase da fatia, e as duas páginas e a lista passam por ela.
`>= PHASE_3` segue a convenção da #70 (a composição da Fase 3 vale para "fase 3 ou maior"); rodada
da Fase 4 não existe até o épico dela (a #77 recusa abrir), e quem construir a Fase 4 muda uma linha
se a decisão for outra.

**D7. A rodada em foco tem uma regra só, e ela vira função.** A tela de rodadas escolhe hoje, inline,
`rounds.find(isOpen) ?? rounds[rounds.length - 1] ?? null`. A visão geral precisa da mesma regra para
saber de qual rodada mostrar a Qualidade. Extrair para `rounds.ts`:

```ts
export function focusRoundOf<T extends { status: string }>(rounds: readonly T[]): T | null
```

e usar nas duas páginas. Assim o bloco da visão geral e o da tela de rodadas falam sempre da mesma
rodada.

**D8. "Só busca e calcula quando..." é garantido pelo fluxo da página.** Nenhuma consulta nova nasce:
as observações e as marcas já vêm do ramo do Administrador. O que a fatia controla é o cálculo:

- tela de rodadas: o `Map<string, QualityPair>` da lista só recebe rodadas com `hasQuality(round.phase)`,
  e o par da rodada em foco só é calculado se `hasQuality(focusRound.phase)`;
- visão geral: idem para a rodada em foco;
- ramo do Avaliador: o `return` antecipado da tela de rodadas continua antes de tudo isso; na visão
  geral, `agreement` é `null` para quem não é Administrador, e o cálculo depende dele.

A prova é por props (Parte 2 e 3): numa rodada da Fase 2 o componente da Qualidade não existe na
árvore e o `Map` não tem a chave da rodada.

**D9. Componentes em `(tabs)/rounds/quality-panel.tsx`**, servidor, ao lado de `agreement-panel.tsx`:

```ts
QualityPanel(props: { pair: QualityPair })
QualityValue(props: { pair: QualityPair })
```

- `QualityPanel`: sem par, um `StatCard` com rótulo `QUALITY_LABEL`, o total de notas como valor
  (`qualityTotal`) e, dentro, as três linhas "Alto · 62,5% · 5 notas" com a barra neutra. Com par, dois
  cards em `sm:grid-cols-2`, o com todos **primeiro**, e o `OUTLIER_PAIR_SUMMARY` embaixo (a frase
  que já diz que os dois saem do mesmo dado e que o com todos continua sendo o resultado). A lista de
  quem saiu e por quê **não** se repete aqui: ela já está no painel do ICR, logo acima.
- `QualityValue`: uma linha, no desenho de `AgreementValue` — "Qualidade: Alto 62,5% (5) · Médio 25%
  (2) · Baixo 12,5% (1)", e com par, a segunda metade com o rótulo curto. Sem nota: "Qualidade: ainda
  não há notas". É o que a lista de rodadas usa, e é o que a #74 (série) e a #77 (confirmação do
  avanço) vão reaproveitar.

**D10. A tela de avaliação não muda, e isso é provado, não presumido.** Ela já não diz a fase nem que
a LLM recebeu o codebook (a #70 e a #71 cuidaram disso). A fatia só acrescenta testes que travam o
comportamento: a mesma cena renderizada com projeto e rodada nas Fases 2 e 3 dá o mesmo texto
(Parte 3).

---

## 4. Fronteira com as fatias vizinhas

**#74 (Qualidade por célula e série)** é dona da matriz de Qualidade e da série entre rodadas da Fase
3. Esta fatia não mexe em `agreement-matrix*` nem em `agreement-series*`, e deixa prontos para ela
`Quality`, `qualityPair`, `hasQuality` e `QualityValue`. A série da visão geral continua sendo só de
ICR até lá.

**#76 (orientação pelo ICR)** é dona do texto que diz para onde olhar. `QUALITY_HELP` diz o que o
número é, e **não** diz quando ele é confiável nem o que fazer com ele.

**#77 (avanço da Fase 3 para a 4)** é dona da confirmação com ICR e Qualidade da última rodada da Fase
3, e do recorte de rodadas por fase no painel de avanço. Esta fatia **não** toca
`pipeline/phase-2-checklist.tsx` (`LastRoundSummary`), mesmo que num projeto na Fase 3 ele mostre
hoje uma rodada da Fase 3 como "última rodada fechada": corrigir esse recorte é AC da #77.

**#78 (CSV)** é dona da comparação de Qualidade entre as Fases 2 e 3 por fora da ferramenta. Nada de
exportação aqui.

**#62/#65 (ICR e par)**: `lib/agreement.ts`, `agreement-pair.ts` e `agreement-panel.tsx` **não
mudam**. A Qualidade é vizinha do ICR, e não parte dele: nenhum componente de ICR passa a receber
Qualidade, para que os dois continuem separáveis na tela e no código (AC "separada dele").

---

## 5. Gotchas herdados

- **Cena no banco quebra teste de integração**: se a conferência no navegador deixar notas no banco
  local, `scores` precisa ficar vazia antes de `npm test`.
- **Sem comentários no código** e **sem Prettier**: o repositório não comenta código novo, e
  `npx prettier` reformata o arquivo inteiro. A explicação vai no commit e no "o que herda".
- **Palavras proibidas na tela do Avaliador**: os testes já varrem "Krippendorff", "ICR", "Alpha",
  "Concordância", "Fase" e "LLM" no texto e nos `title`. Acrescentar "Qualidade" e "%" à varredura
  nas telas do Avaliador (Parte 3).
- **Captura do preview**: se a tela sair com a faixa preta, ver a nota de memória sobre o preview
  pane (`resize_window`, `get_page_text`).

---

# Parte 1 — O cálculo puro e as palavras

**Objetivo:** `quality.ts` e `quality-labels.ts` com testes unitários. Nenhuma tela muda.

**Ler antes:** `AGENTS.md`, as seções 1 a 5, `(tabs)/rounds/agreement-pair.ts`,
`(tabs)/rounds/agreement.ts` (tipo `RoundObservation`), `(tabs)/evaluate/scale.ts`,
`(tabs)/rounds/agreement-labels.ts` e o teste dele, e `lib/plural.ts`.

### 1.1 `(tabs)/rounds/quality.ts`

```ts
export type QualityLevel = { value: ScaleValue; count: number; share: number }
export type Quality =
  | { rated: false; total: 0 }
  | { rated: true; total: number; levels: QualityLevel[] }
export type QualityPair = { all: Quality; withoutOutliers: Quality | null; excluded: number }

export function hasQuality(phase: number): boolean
export function qualityOf(observations: readonly RoundObservation[]): Quality
export function qualityPair(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): QualityPair
```

- `qualityOf`: conta por ponto de `SCALE` comparando `observation.value` com `scaleRank(value)`.
  `total` é o número de observações. Zero observações → `{ rated: false, total: 0 }`.
- `qualityPair`: `withoutExcluded` importado de `agreement-pair.ts`, **não** reescrito.
- `hasQuality`: `phase >= PHASE_3`, importando de `../../pipeline/preconditions`.

### 1.2 `(tabs)/rounds/quality-labels.ts`

As constantes e funções do D4. `QUALITY_HELP` montado a partir das constantes, como
`OUTLIER_PAIR_HINT`.

### 1.3 Testes da Parte 1

`(tabs)/rounds/quality.unit.test.ts`:

- [ ] **Porcentagens e contagens corretas**: 5 Alto, 2 Médio, 1 Baixo dão `total: 8`, contagens
      5/2/1 e `share` 0,625/0,25/0,125, nessa ordem.
- [ ] **Os três pontos aparecem sempre, na ordem da escala**: só notas em Alto dão Médio e Baixo com
      `count: 0` e `share: 0`.
- [ ] **Rodada sem nota não é 0%**: `qualityOf([])` é `{ rated: false, total: 0 }`, sem `levels`.
- [ ] **A unidade é a nota**: duas respostas × duas células × dois avaliadores dão `total: 8`.
- [ ] **Sem marca, um valor só**: `qualityPair(obs, new Set())` tem `withoutOutliers: null` e `all`
      igual a `qualityOf(obs)`.
- [ ] **Com marca, os dois**, e `all` idêntico a `qualityOf(obs)` sem filtro — a asserção que prova
      que o valor com todos não foi substituído; `withoutOutliers` conta só as notas dos não marcados.
- [ ] **Marcar todo mundo** dá `withoutOutliers` `rated: false`, com `all` intacto.
- [ ] **Mesmo recorte do ICR**: para o mesmo conjunto de marcas, o `total` de `withoutOutliers` é o
      número de observações de `withoutExcluded` usado por `agreementPair`.
- [ ] **`hasQuality`**: falso para 1 e 2, verdadeiro para 3.

`(tabs)/rounds/quality-labels.unit.test.ts`:

- [ ] `formatShare`: `0.625` → `'62,5%'`, `1` → `'100%'`, `0` → `'0%'`, `1/3` → `'33,3%'`.
- [ ] **Nenhuma palavra de juízo**: nenhuma constante exportada contém "boa", "bom", "ruim",
      "aprovad", "reprovad", "meta", "atinge", "suficiente", "adequad" (varrer os valores string do
      módulo, para que uma constante nova entre na varredura sem ninguém lembrar).
- [ ] `QUALITY_HELP` não fala de ICR nem de faixa (é a #76 que orienta).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Nenhuma tela mudou.

### O que a Parte 2 herda

- `(tabs)/rounds/quality.ts` exporta `QualityLevel`, `Quality`, `QualityPair`, `hasQuality`,
  `qualityOf` e `qualityPair`, com as assinaturas de 1.1. Importa `PHASE_3` de
  `../../pipeline/preconditions` e `withoutExcluded` de `./agreement-pair`, sem reescrevê-lo.
- `(tabs)/rounds/quality-labels.ts` exporta `QUALITY_LABEL` (`'Qualidade'`), `QUALITY_UNRATED`
  (`'ainda não há notas'`), `QUALITY_UNRATED_WITHOUT_OUTLIERS` (`'não sobra nota depois da
  exclusão'`), `QUALITY_HELP`, `formatShare` e `qualityTotal`. As duas frases de "sem nota" estão em
  minúscula, como `NOT_CALCULABLE_LABEL`, para servir tanto de valor de card quanto de fim de linha
  ("Qualidade: ainda não há notas").
- **Divergência de redação**: o D4 pede que o `QUALITY_HELP` diga que a ferramenta "não define meta",
  mas "meta" está na varredura de palavras de juízo. O texto diz "não fixa um alvo para essa
  distribuição nem diz se o valor basta". Quem acrescentar frase nova ao módulo não pode usar
  "meta" (nem "metade", que casa como substring).
- A varredura de palavras de juízo lê todo valor `string` exportado de `quality-labels.ts`: constante
  nova entra nela sozinha. Funções (`formatShare`, `qualityTotal`) ficam de fora.
- `formatShare` usa `Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })` sobre `share * 100`.
- `AGREEMENT_ALL_LABEL` e `AGREEMENT_WITHOUT_OUTLIERS_LABEL` **não** foram reexportados: a Parte 2
  importa direto de `agreement-labels.ts`.
- Nenhuma tela mudou. `npm run lint`, `npm run typecheck` e `npm test` (73 arquivos, 971 testes)
  verdes.

---

# Parte 2 — A tela de rodadas

**Objetivo:** o Administrador vê a Qualidade da rodada em foco num bloco separado, ao lado do ICR, e
uma linha dela em cada rodada da Fase 3 da lista.

**Ler antes:** seções 1 a 5, o "o que herda" da Parte 1, `(tabs)/rounds/page.tsx`,
`agreement-panel.tsx`, `round-list.tsx`, `rounds.ts`, `app/components/ui/stat.tsx`, `badge.tsx` e
`app/globals.css` (tokens de cor), e em `(tabs)/rounds/page.int.test.ts` os helpers `roundWith`,
`render`, `findElement` e os testes do par de outliers (≈ linha 701).

### 2.1 `rounds.ts`: `focusRoundOf`

A função do D7. Trocar a expressão inline de `(tabs)/rounds/page.tsx` por ela. Nenhum comportamento
muda: os testes existentes da rodada em foco precisam passar sem mexer em asserção.

### 2.2 `(tabs)/rounds/quality-panel.tsx`

`QualityPanel` e `QualityValue` como no D9. Conferir, antes de escolher a cor da barra, que o token
não é usado como cor de estado em outro lugar (D5).

### 2.3 `(tabs)/rounds/page.tsx`

- Depois de montar `agreement`, montar `quality: Map<string, QualityPair>` só com as rodadas em que
  `hasQuality(round.phase)`, usando as **mesmas** `observations` e `outliers` do ICR.
- Nova `Section`, logo depois da de Concordância e só quando `focusRound && hasQuality(focusRound.phase)`:
  - título `Qualidade na rodada N` (com ", fechada" quando for o caso, espelhando a de Concordância);
  - `hint` curto: a distribuição das notas da rodada entre Alto, Médio e Baixo;
  - `help`: `QUALITY_HELP`;
  - conteúdo: `<QualityPanel pair={quality.get(focusRound.id)!} />`.
- `RoundList` recebe `quality` e passa adiante.

### 2.4 `round-list.tsx`

Abaixo de `AgreementValue`, `quality.has(round.id) ? <QualityValue pair={...} /> : null`. A lista não
decide fase: quem decide é quem monta o `Map` (D8).

### 2.5 Testes da Parte 2

Em `(tabs)/rounds/page.int.test.ts`. `roundWith` ganha `phase` opcional (default `PHASE_2`, para os
testes existentes não mudarem), passando para `addRound` e para `createProject`.

- [ ] **O Administrador vê a Qualidade numa rodada da Fase 3**: com notas 5/2/1, o `QualityPanel` está
      na árvore com `pair.all` batendo com as contagens, e o texto tem "62,5%", "25%", "12,5%" e as
      contagens.
- [ ] **E não vê numa da Fase 2**: mesma cena com `phase: PHASE_2`, e `findElement(tree, QualityPanel)`
      é `null`, `list.quality` não tem a chave da rodada e o texto não contém "Qualidade". O painel do
      ICR continua lá.
- [ ] **Bloco separado do ICR**: `QualityPanel` não está dentro da `Section` de Concordância, e
      `AgreementPanel` não recebe nenhuma prop de Qualidade.
- [ ] **Rodada da Fase 3 sem nota**: o bloco diz `QUALITY_UNRATED` e o texto não contém "0%".
- [ ] **Com outlier marcado, os dois valores**, o com todos primeiro; sem marca, um só
      (`withoutOutliers` nulo e um card).
- [ ] **Nenhuma cor de juízo**: nenhum elemento dentro do `QualityPanel` usa `Badge` com tom
      `success`/`warning`/`danger` nem classe com `success`, `warning` ou `danger` (varrer
      `className` da subárvore).
- [ ] **A lista mostra a Qualidade só nas rodadas da Fase 3**: um projeto com uma rodada fechada da
      Fase 2 e uma da Fase 3; o `Map` tem só a da Fase 3.
- [ ] **O Avaliador não vê**: numa rodada da Fase 3 fechada em que ele avaliou, o texto da área de
      rodadas dele não contém "Qualidade" nem "%" (acrescentar ao teste de "não fala de coeficiente").

### 2.6 Conferência no navegador

Supabase local e `npm run dev:local`, `/dev/login`. Uma cena com uma rodada fechada da Fase 2 e uma da
Fase 3 com notas de dois avaliadores, e um terceiro marcado como outlier. Conferir: o bloco só na
rodada da Fase 3, os dois cards com o com todos primeiro, as barras da mesma cor, a linha na lista, e
o celular (375px) sem rolagem horizontal. **Apagar a cena** depois (`scores` vazia).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, e a tela conferida.

### O que a Parte 3 herda

- `rounds.ts` exporta `focusRoundOf(rounds)`, e a tela de rodadas já usa. A visão geral chama a
  mesma função sobre `agreement.rounds`.
- `quality-panel.tsx` exporta `QualityPanel({ pair })` e `QualityValue({ pair })`. O painel, sem
  par, é um `StatCard` só (rótulo `Qualidade`, valor "N notas" ou `QUALITY_UNRATED`, e as três
  linhas "Alto" / "62,5% · 5 notas" com barra); com par, dois cards em `sm:grid-cols-2` com os
  rótulos `Qualidade — com todos` e `Qualidade — sem os marcados como outlier`, o segundo com
  "N avaliador(es) fora" de dica, e `OUTLIER_PAIR_SUMMARY` embaixo (sem o `InfoTooltip` do
  `OUTLIER_PAIR_HINT`, que já está no painel do ICR logo acima).
- A barra é trilho `bg-line` com preenchimento `bg-faint`, a mesma para os três pontos, com
  `aria-hidden`. `bg-faint` não era usado como fundo em lugar nenhum, então não carrega sentido de
  estado.
- `QualityValue` escreve "Qualidade: Alto 62,5% (5) · Médio 25% (2) · Baixo 12,5% (1)" e o total
  ("8 notas") num `span` ao lado, no desenho de `AgreementValue`; com par, "Qualidade com todos:
  …" e "sem os marcados como outlier: …".
- Na tela de rodadas, `quality: Map<string, QualityPair>` só tem as rodadas com
  `hasQuality(round.phase)`, e a `Section` "Qualidade na rodada N[, fechada]" aparece quando a
  rodada em foco está nesse `Map`, com `hint` "A distribuição das notas desta rodada entre Alto,
  Médio e Baixo." e `help` `QUALITY_HELP`. A visão geral deve usar o mesmo `hint` e o mesmo `help`.
- `RoundList` ganhou a prop obrigatória `quality`.
- Em `(tabs)/rounds/page.int.test.ts`: `roundWith` aceita `phase` (default `PHASE_2`, e grava no
  projeto e na rodada); `qualityScene(admin, phase)` monta a rodada fechada com 5/2/1 (Ana e
  Bruno, quatro respostas, uma célula); `qualityPanelOf`, `qualityTextOf` e `classNamesOf` (varre
  os `class` do markup) estão lá para copiar. O teste do Avaliador "não fala de coeficiente nem de
  Qualidade" já roda numa rodada da Fase 3 e varre "Qualidade" e "%".
- A varredura de cor proíbe `success`, `warning`, `danger` e também `brand` nas classes do painel e
  da linha da lista.
- Conferido no navegador (cena com rodada 1 da Fase 2 e rodada 2 da Fase 3, Carla marcada): bloco
  só na rodada da Fase 3, logo depois da Concordância, os dois cards com o com todos primeiro, as
  seis barras com a mesma cor, a linha só na rodada da Fase 3 da lista, e a 375px os cards
  empilhados sem nada passando da largura. O screenshot saiu preto (painel), então a prova foi por
  DOM. Cena apagada, `scores` vazia.
- `npm run lint`, `npm run typecheck` e `npm test` (73 arquivos, 979 testes) verdes.

---

# Parte 3 — A visão geral, as telas do Avaliador e a varredura

**Objetivo:** a Qualidade na visão geral do projeto, e a prova de que nenhuma tela do Avaliador
mostra Qualidade nem diz a fase. Depois, a varredura dos ACs.

**Ler antes:** seções 1 a 5, os dois "o que herda", `(tabs)/page.tsx`, `(tabs)/page.int.test.ts`,
`(tabs)/evaluate/page.tsx` e o helper `scenario` de `(tabs)/evaluate/page.int.test.ts`, e
`(tabs)/rounds/[roundId]/page.int.test.ts`.

### 3.1 `(tabs)/page.tsx`

- Com `agreement` carregado (ramo do Administrador), `const focus = focusRoundOf(agreement.rounds)`.
- Se `focus && hasQuality(focus.phase)`: `qualityPair(agreement.observations.get(focus.id) ?? [],
  agreement.outliers.get(focus.id) ?? new Set())`.
- Nova `Section` "Qualidade na rodada N" logo depois de "Concordância por rodada", com o mesmo
  `QualityPanel` e o mesmo `help` da tela de rodadas, e um `OpenLink` "Abrir rodadas" para onde está
  o ICR da mesma rodada por extenso.
- `Phase2Checklist` **não** muda (§ 4, #77).

### 3.2 Testes da Parte 3

`(tabs)/page.int.test.ts`:

- [ ] **O Administrador vê a Qualidade na visão geral** quando a rodada em foco é da Fase 3, com os
      mesmos valores que a tela de rodadas mostra para a mesma rodada.
- [ ] **E não vê** quando a rodada em foco é da Fase 2, mesmo com o projeto já na Fase 3 (a fase que
      decide é a da rodada).
- [ ] **O Avaliador não vê** a Qualidade na visão geral, com rodada da Fase 3 aberta e depois de
      fechada: texto sem "Qualidade" nem "%", e `QualityPanel` fora da árvore.

`(tabs)/evaluate/page.int.test.ts` (`scenario` ganha a fase da rodada, se ainda não tiver):

- [ ] **A tela de avaliação é igual nas Fases 2 e 3**: a mesma cena (mesmo nome de projeto, mesmo
      codebook, prompt, item e resposta) com projeto e rodada na Fase 2 e depois na 3 renderiza o
      mesmo texto (`allTextOf` das duas árvores iguais; normalizar ids se algum vazar para o texto).
- [ ] **A tela de avaliação da Fase 3 não diz a fase nem que a LLM recebeu o codebook**: sem "Fase",
      "codebook completo", "LLM", "Qualidade" nem "%". Vale também para o Administrador-avaliador.

`(tabs)/rounds/[roundId]/page.int.test.ts`:

- [ ] **A revisão de uma rodada da Fase 3 fechada não mostra Qualidade** ao Avaliador, e a nota
      continua aparecendo uma a uma, sem porcentagem (história 14).

### 3.3 O glossário

Conferir o verbete **Qualidade** de `docs/CONTEXT.md` palavra por palavra contra o que ficou na tela:
distribuição, sem veredito, invisível ao Avaliador, par com e sem outliers, só na Fase 3. A frase "na
rodada inteira, por célula e na série" descreve o épico, e as duas últimas partes são da #74: não
mudar. Se algo divergir, o código está errado ou a decisão mudou e merece emenda.

### 3.4 Varredura dos ACs

| AC do issue | Onde está provado |
|---|---|
| Na Fase 3, o Administrador vê porcentagem e contagem de Alto, Médio e Baixo, ao lado do ICR e separada dele | § 2.5 (vê, bloco separado) + § 3.2 (visão geral) |
| Calculada na leitura, nada gravado | § 2 (sem migration, sem consulta nova) + § 1.3 (função pura) |
| Nenhum texto ou cor de juízo | § 1.3 (varredura das palavras) + § 2.5 (varredura das classes) |
| Com outlier, os dois valores juntos; sem marca, um só | § 1.3 + § 2.5 |
| Rodada sem nota diz que não há notas, não 0% | § 1.3 (`rated: false`) + § 2.5 |
| Rodadas da Fase 2 não mostram Qualidade | § 2.5 (tela e lista) + § 3.2 (visão geral) |
| Só busca e calcula na Fase 3 e para o Administrador | D8 + § 2.5 (`Map` sem a rodada da Fase 2) + § 3.2 |
| Nenhuma tela do Avaliador mostra Qualidade; a avaliação não diz a fase nem que a LLM recebeu o codebook | § 2.5 + § 3.2 (visão geral, avaliação, revisão) |

Anotar no comentário de fechamento da issue o commit de cada Parte.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, os oito ACs conferidos um a um, e a visão
geral conferida no navegador com a mesma cena da Parte 2 (apagada depois).

### O que esta Parte fechou

(a preencher)

---

## 6. Fica para depois (registrar, não construir)

- **Qualidade por célula e série da Fase 3**: #74, que já recebe `Quality`, `qualityPair`,
  `hasQuality` e `QualityValue` prontos.
- **Orientação pelo ICR** ao lado da Qualidade: #76.
- **Qualidade na confirmação do avanço para a Fase 4** e o recorte de rodadas por fase no painel de
  avanço: #77.
- **Comparação de Qualidade entre as Fases 2 e 3**: pelo CSV, #78.
