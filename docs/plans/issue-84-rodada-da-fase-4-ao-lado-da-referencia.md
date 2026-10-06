# Plano de implementação — Issue #84: "44 — Rodada da Fase 4 lida ao lado da rodada de referência"

Link: https://github.com/nicolasddr/tcc/issues/84
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 11 — só a parte do
painel da rodada —, 13, 14 e 22 — só a parte da leitura; seção "Leitura" e "Telas" de Decisões de
Implementação; NFR de Integridade "nada da comparação é gravado", de Desempenho e de Usabilidade "nenhuma
palavra de juízo sobre a Fase 4")
Blocked by: #82 ✅ e #83 ✅ (fechadas). Pode começar.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A comparação: função pura que acha a referência de uma rodada da Fase 4 e monta o par das duas, o bloco "Comparação com a rodada de referência" na tela de rodadas e a linha da referência na lista de rodadas | ✅ |
| 2 | A marca no painel: participação restrita às rodadas anteriores (pura), carregada só para o Administrador e só numa rodada da Fase 4, e a marca ao lado de cada avaliador no painel de concordância | ⬜ |
| 3 | As séries: a de ICR com a Fase 4 agrupada e o texto de ajuda novo; a de Qualidade cobrindo as Fases 3 e 4, com a fase em cada ponto e os rótulos ajustados; verificação no navegador e varredura dos ACs | ⬜ |

**Nenhuma ADR nova.** A regra está no glossário (`docs/CONTEXT.md`, verbete **Rodada de referência**:
"cada rodada da Fase 4 é lida ao lado da sua, com ICR e Qualidade das duas lado a lado e sem veredito";
"depois de um retorno à Fase 3 e de um novo avanço, as rodadas da passagem anterior continuam com a
referência delas") e na **emenda de 2026-10-02 da ADR 0004** (sem veredito; a marca de Outlier é a porta
para tirar quem já avaliou antes). A ADR 0011 (ICR invisível ao Avaliador) cobre o "só o Administrador
vê". Se algo divergir, emende a ADR em vez de improvisar no código.

**Sem migration e sem ação nova.** Tudo é leitura derivada das tabelas que já existem (`rounds.phase`,
`evaluations`, `scores`, `round_outliers`). Nada é gravado.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Rodada de referência | `(tabs)/rounds/reference-round.ts` (`referenceRoundOf(rounds, round)`: última fechada da Fase 3 com número menor; `projectReferenceRound(rounds)`: a do projeto) e o teste unitário (inclui "respeita as passagens anteriores pela Fase 4") | **sem mudança**. A comparação usa só `referenceRoundOf`, nunca `projectReferenceRound` (Parte 1) |
| Par de ICR | `(tabs)/rounds/agreement-pair.ts` (`agreementPair(observations, excluded)` → `{ all, withoutOutliers, excluded }`) | reaproveitado, sem segundo cálculo |
| Par de Qualidade | `(tabs)/rounds/quality.ts` (`qualityPair`, `hasQuality(phase)` = `phase >= 3`) | idem |
| Tela de rodadas | `(tabs)/rounds/page.tsx`: carrega `observations` e `outliers` **do projeto inteiro** só para o Administrador, monta os mapas `agreement` (todas as rodadas) e `quality` (Fase 3 em diante) e lê a **rodada em foco** (`focusRoundOf`: a aberta ou a última). Ordem dos blocos: Nova rodada / Gerar + Fechar → Concordância → orientação (só Fase 3) → Qualidade → Rodadas do projeto | ganha o bloco de comparação (Parte 1) e a participação (Parte 2) |
| Valores compactos | `agreement-panel.tsx` (`AgreementValue`, com `BandBadge` colorido) e `quality-panel.tsx` (`QualityValue`, já neutro). Os dois já mostram "com todos · sem os marcados como outlier" quando o par tem exclusão | reaproveitados no bloco (Parte 1, D3 ⚠) |
| Resumo da referência no avanço | `pipeline/last-round-summary.tsx` (`LastRoundSummary` com `reference?: VersionPair`: "Rodada de referência: rodada N · fechada em …", "Codebook na versão X e prompt na versão Y: são as versões que a Fase 4 vai testar") | modelo de texto; **não muda** |
| Lista de rodadas | `round-list.tsx` (`RoundList`: um `Card` por rodada com fase, versões, datas, "o que mudou", `AgreementValue`, `QualityValue`, "Abrir revisão") | ganha a linha da referência nas rodadas da Fase 4 (Parte 1, D2 ⚠) |
| Painel de concordância | `agreement-panel.tsx` (`AgreementPanel` → `EffortList`: um `li` por avaliador, chave `projectMemberId`, com `Badge` "outlier" e "desativado") | ganha a marca de participação (Parte 2) |
| Esforço | `agreement.ts` (`listEvaluatorEffort(roundId, projectId)` → `EvaluatorEffort { projectMemberId, name, status, submitted }`) | sem mudança; a chave `projectMemberId` casa com a da participação |
| Participação | `(tabs)/rounds/participation.ts` (`EvaluatorParticipation = Map<project_member_id, RoundTag[]>`, `loadEvaluatorParticipation(projectId, db)`, ordenada por `roundNumber`, todas as rodadas, inclusive a aberta) — **#83** | reaproveitada; a restrição a rodadas anteriores nasce aqui (Parte 2) |
| Rótulo | `app/projects/[id]/round-usage.ts` (`RoundTag`, `roundsLabel`, `participationLabel` → `avaliou nas rodadas 1 e 2 (Fase 2) e 3 (Fase 3)`), módulo neutro, sem banco — **#83** | reaproveitado (Parte 2) |
| Série de ICR | `agreement-series.ts` (`agreementSeries` já põe **todas** as rodadas com `phase`; `phaseRuns` agrupa por trecho consecutivo) e `agreement-series-chart.tsx` (colunas + linha tracejada entre fases + rótulo "Fase N" + lista agrupada com `h3`) | a Fase 4 **já aparece e já agrupa**; muda o `help` da seção na visão geral (Parte 3) |
| Série de Qualidade | `quality-series.ts` (`qualitySeries` filtra por `hasQuality`, então a Fase 4 **já entra**; `QualitySeriesPoint` **não tem** `phase`), `quality-series-list.tsx` (lista plana, sem fase) e `quality-labels.ts` (`QUALITY_SERIES_HINT`/`HELP`/`NOTE_SINGLE` falam em "rodada(s) da Fase 3" e "as rodadas da Fase 2 não entram") | ganha `phase`, agrupamento e rótulos (Parte 3) |
| Visão geral | `(tabs)/page.tsx` (seções "Concordância por rodada" com `help` que fala só das Fases 2 e 3, e "Qualidade por rodada"; `agreement` só carrega com `viewerIsAdmin`) | textos (Parte 3) |
| Testes vizinhos | `rounds/page.int.test.ts` (helpers `render`, `findElement`, `allTextOf`, `classNamesOf`, `markupTextOf`, `listOf`, `panelOf`; casos "a Qualidade não usa cor de juízo em nenhum elemento", "com alguém marcado, a Qualidade mostra os dois valores", "a área de rodadas do avaliador não fala de coeficiente nem de Qualidade"), `rounds/phase-4-round.int.test.ts` (cena da Fase 4 em ciclo sequencial), `(tabs)/page.int.test.ts` (`seriesOf`, `qualitySeriesOf`, "o Administrador vê a série de Qualidade com um ponto por rodada da Fase 3…"), `agreement-series.unit.test.ts`, `quality-series.unit.test.ts` ("só as rodadas da Fase 3 viram ponto"), `participation.int.test.ts`, `round-usage.unit.test.ts` | copiar helpers e espelhar os casos |

O que **já funciona** e só precisa de prova: a tela de uma rodada da Fase 4 já mostra ICR e Qualidade
da própria rodada (`hasQuality(4)` é verdade desde a #82), e a série de ICR já desenha os pontos da Fase
4 em grupo próprio.

O que **falta**, e esta fatia cria: o bloco de comparação, a referência nomeada na lista, a marca de
participação restrita no painel e a série de Qualidade que diz a fase de cada ponto, com os textos.

---

## 2. A regra, por extenso

### A referência de cada rodada da Fase 4

`referenceRoundOf(rounds, round)`: a última rodada **fechada** da **Fase 3** com número **menor** que o
da rodada. Nunca `projectReferenceRound`. Exemplo com retorno (a #86 ainda não existe; nos testes, as
rodadas são semeadas com a fase direto):

| Rodada | Fase | Estado | Referência |
|---|---|---|---|
| 1 | 3 | fechada | — |
| 2 | 4 | fechada | **1** |
| 3 | 3 | fechada | — |
| 4 | 4 | aberta ou fechada | **3** |

A rodada 2 continua comparada com a 1, mesmo depois de a 3 existir.

### O bloco de comparação

Aparece **logo abaixo** do bloco de Qualidade da rodada em foco, só quando ela é da Fase 4, e diz:

1. qual é a rodada de referência, quando fechou, e que ela validou o codebook na versão X e o prompt na
   versão Y;
2. lado a lado, a referência e esta rodada, cada uma com fase, versões, estado, o ICR e a Qualidade;
3. em cada lado, **independentemente**, se há marca de Outlier naquela rodada, os dois valores (com todos
   e sem os marcados), na ordem de sempre.

Não diz: melhor, pior, subiu, caiu, suficiente, replicou, generalizou, aprovada, reprovada; não calcula
diferença; não usa cor de faixa nem seta (D3 ⚠).

### A marca no painel

Só no painel de concordância de uma rodada **da Fase 4**: ao lado do nome de cada avaliador, `avaliou
nas rodadas …` com as rodadas **de número menor** que a rodada do painel (as avaliações dela mesma não
contam, inclusive com a rodada aberta). Quem não tem rodada anterior não tem marca. Nas Fases 2 e 3 o
painel não recebe marca. A consulta só roda quando quem vê é o Administrador **e** a rodada em foco é
da Fase 4.

### As séries

- **ICR**: uma série só, Fases 2, 3 e 4, um ponto por rodada, agrupada por trecho de fase (já é assim).
  Muda o texto de ajuda, que hoje só explica a passagem da Fase 2 para a 3.
- **Qualidade**: as rodadas da Fase 3 em diante (já é assim), agora com a fase de cada ponto e agrupada
  por trecho de fase, como a de ICR. Os rótulos deixam de dizer "rodada(s) da Fase 3".
- Nada é somado nem tirado a média entre rodadas, como hoje.

### Quem vê

Só o Administrador. O ramo do Avaliador na tela de rodadas retorna antes de montar qualquer bloco, e a
transação só carrega `observations`, `outliers` e (Parte 2) participação com `isAdmin`. A visão geral só
monta séries com `viewerIsAdmin`. Esta fatia não abre caminho novo para o Avaliador; só prova.

---

## 3. Decisões

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. A função pura da comparação.** Arquivo novo `(tabs)/rounds/reference-comparison.ts`, sem banco:

```ts
export type ComparedRound = {
  id: string
  roundNumber: number
  phase: number
  status: string
  closedAt: string | null
  codebookVersionNumber: number
  promptVersionNumber: number
  agreement: AgreementPair
  quality: QualityPair | null
}

export type ReferenceComparison =
  | { kind: 'not_phase_4' }
  | { kind: 'no_reference' }
  | { kind: 'compared'; round: ComparedRound; reference: ComparedRound }

export function referenceComparison(
  rounds: readonly RoundSummary[],
  round: RoundSummary,
  agreement: ReadonlyMap<string, AgreementPair>,
  quality: ReadonlyMap<string, QualityPair>,
): ReferenceComparison
```

Recebe os mapas que a página **já monta** (`agreement` de todas as rodadas, `quality` da Fase 3 em
diante) e só os consulta: é isso que garante "as mesmas funções de par" e "nenhum segundo cálculo". A
referência sai de `referenceRoundOf(rounds, round)`. `kind: 'not_phase_4'` deixa a página com um `if`
só. A lista de rodadas (D2) chama a mesma função por rodada.

**D2 ⚠. Onde a comparação aparece: bloco completo na rodada em foco e linha da referência na lista de
rodadas.** A tela de rodadas só lê em detalhe a rodada **em foco** (a aberta ou a última), e a rodada em
foco é sempre a última; para ela, `referenceRoundOf` e `projectReferenceRound` coincidem. Uma rodada da
Fase 4 **de uma passagem anterior** (a rodada 2 da tabela da § 2) nunca está em foco, e sem outro lugar
ela não seria comparada em tela nenhuma; o AC "comparada com a sua própria referência" ficaria provado
só no unitário. Recomendação: **os dois lugares**.

- Na rodada em foco, a seção "Comparação com a rodada de referência" (D4).
- Em cada `Card` de rodada da Fase 4 na lista "Rodadas do projeto", logo abaixo dos valores da própria
  rodada, uma linha `Rodada de referência: rodada 1 · Codebook v3 · Prompt v2` seguida do
  `AgreementValue` e do `QualityValue` **da referência**, no modo neutro de D3. Os valores da própria
  rodada já estão no `Card`, acima: o lado a lado é vertical, no mesmo cartão.

Alternativa: só na rodada em foco (mais simples; a passagem anterior fica sem leitura até a #86 decidir
mostrá-la na confirmação do retorno, que só mostra a **última** rodada da Fase 4).

**D3 ⚠. Bloco sem cor de faixa e sem diferença.** `AgreementValue` mostra um `BandBadge` colorido
(`boa` em verde, `questionável` em vermelho). Dentro do bloco, dois selos coloridos lado a lado leem
como veredito ("a Fase 4 ficou vermelha"). Recomendação:

- `AgreementValue` ganha `band?: boolean` (padrão `true`, sem mudar quem já usa); o bloco e a linha da
  lista (D2) passam `band={false}`. O número, o N e o rótulo "com todos / sem os marcados" continuam. A
  faixa da própria rodada continua visível no painel de Concordância, acima, como em qualquer fase.
- **Nenhuma diferença calculada** (nem "−0,12", nem "+5 p.p."): um número com sinal é uma seta escrita.
- `QualityValue` já é neutro; não muda.

Alternativa: manter o `BandBadge` (a faixa é referência de leitura do próprio ICR, não da comparação)
e só proibir palavras e setas.

**D4. O desenho e o texto do bloco.** Componente novo `(tabs)/rounds/reference-comparison.tsx` (Server
Component, sem estado), numa `Section`:

- título: `Comparação com a rodada de referência`;
- `hint`: `A rodada {N} ao lado da rodada {R}, a última fechada da Fase 3 antes dela.`;
- `help`: `A rodada de referência é a que validou as versões de codebook e de prompt que a Fase 4
  testa. Os dois lados vêm do mesmo cálculo da lista de rodadas, cada um com as suas notas e as suas
  marcas de outlier. A ferramenta não diz se a diferença basta: quem lê é você.`;
- uma frase no topo, no padrão de `LastRoundSummary`: `Rodada de referência: rodada {R}, fechada em
  {data}. Ela validou o codebook na versão {X} e o prompt na versão {Y}.`;
- duas colunas (`grid gap-3 sm:grid-cols-2`, empilham em 375 px), **referência à esquerda e esta rodada
  à direita** (ordem cronológica, como a série); cada coluna num `Card tone="subtle"` com `Rodada {n} ·
  Fase {f}`, `Codebook v{x} · Prompt v{y}`, `fechada em …` ou `Badge` "aberta", e embaixo
  `AgreementValue band={false}` e `QualityValue`.

As versões aparecem nos dois lados em vez de a frase afirmar "as mesmas": numa rodada aberta antes da
regra da #82 elas podem diferir, e a tela não deve mentir. Se o dono quiser outro texto, mudar aqui
antes da Parte 1; os testes leem as strings exportadas.

**D5. Rodada da Fase 4 sem referência.** Só acontece em dado anterior à #81/#82 (a abertura recusa com
`no_reference_round`). O bloco aparece com uma linha só: `Não há rodada fechada da Fase 3 antes da
rodada {N}, e por isso não há com o que comparar.` Na lista, nada.

**D6. A participação restrita: função pura num módulo neutro.** Arquivo novo
`(tabs)/rounds/participation-labels.ts` (sem `@/lib/db`, para o unitário não puxar o banco):

```ts
export function participationBefore(
  participation: ReadonlyMap<string, readonly RoundTag[]>,
  roundNumber: number,
): Record<string, string> // project_member_id → 'avaliou nas rodadas …'
```

Filtra `tag.roundNumber < roundNumber`, aplica `participationLabel` e omite quem fica sem rodada. A
chave é o vínculo, que casa direto com `EvaluatorEffort.projectMemberId` (sem a ponte por usuário da
#83). `participation.ts` não muda.

**D7. Onde a marca aparece no painel.** `AgreementPanel` ganha `participation?: Readonly<Record<string,
string>>` e repassa a `EffortList`; a marca é um `<Badge tone="neutral">` dentro do `span` do nome,
depois dos selos "outlier" e "desativado", com `className="whitespace-normal!"` (lição da #83: o
rótulo de três fases estoura em 375 px; `cx` não resolve conflito do Tailwind, usar o sufixo `!`).

**D8 ⚠. O texto de ajuda da marca no painel.** O título "Avaliações enviadas por avaliador" já tem um
`InfoTooltip` condicional (desativado). Proposta: quando houver `participation`, o tooltip passa a
existir e ganha, depois do texto de desativado (se houver):

> A marca "avaliou nas rodadas" mostra em quais rodadas anteriores a esta cada avaliador já enviou
> avaliação. Ela não impede ninguém de avaliar: para tirar do cálculo quem já tinha avaliado antes, use
> a marca de outlier nesta rodada.

Alternativa: sem texto (a página de membros já explica a marca desde a #83). Nenhuma palavra "novo" ou
"veterano" como veredito.

**D9 ⚠. A série de Qualidade com a fase e agrupada, e os textos das duas séries.**

- `QualitySeriesPoint` ganha `phase`. `phaseRuns` vira genérico (`<T extends { phase: number }>(points:
  readonly T[]) => { phase: number; points: T[] }[]`) e `PhaseRun` continua exportado para a série de
  ICR (sem mudar o comportamento; os unitários dela continuam verdes sem edição).
- `QualitySeriesList` agrupa como a lista da série de ICR: um `h3` "Fase N" por trecho, e cada ponto
  ganha `· Fase N` ao lado das versões.
- Textos propostos (`quality-labels.ts`):
  - `QUALITY_SERIES_HINT`: `A distribuição das notas de cada rodada das Fases 3 e 4, um ponto por
    rodada.`
  - `QUALITY_SERIES_HELP`: trocar "de uma rodada da Fase 3 inteira" por "de uma rodada inteira, da Fase
    3 ou da Fase 4"; manter "As rodadas da Fase 2 não entram"; acrescentar `Na Fase 4, cada ponto se lê
    ao lado da sua rodada de referência, na tela de rodadas.`
  - `QUALITY_SERIES_NOTE_SINGLE`: `… a próxima rodada da Fase 3 ou da Fase 4 rende o segundo ponto.`
- `help` da seção "Concordância por rodada" (visão geral), proposta:

  > Cada ponto traz a versão de codebook que a rodada fixou e a fase em que ela foi aberta. As Fases 2,
  > 3 e 4 ficam na mesma série. Da última rodada da Fase 2 para a primeira da Fase 3 com a mesma versão
  > de codebook, a diferença mostra o efeito de a LLM passar a receber o codebook. Na Fase 3, o codebook
  > refinado entre rodadas deve aparecer como concordância maior na rodada seguinte. Na Fase 4, codebook
  > e prompt não mudam: o que muda são os itens e os avaliadores, e cada rodada se lê ao lado da sua
  > rodada de referência.

Alternativa para a Qualidade: só a fase em cada ponto, sem agrupar.

**D10. Testes de página da tela de rodadas em arquivo novo.** `rounds/page.int.test.ts` tem 2.200
linhas e `phase-4-round.int.test.ts` é um ciclo sequencial com estado compartilhado. A comparação e a
marca vão para `(tabs)/rounds/phase-4-reading.int.test.ts`, com cenas próprias por caso (`inRollbackTx`
não serve aqui, porque a página abre a própria transação: seguir o padrão de `page.int.test.ts`, com
`cleanup` no `afterEach`) e os helpers copiados de `page.int.test.ts` (`render`, `findElement`,
`findSection`, `allTextOf`, `classNamesOf`, `markupTextOf`, `listOf`, `panelOf`). As séries ficam em
`(tabs)/page.int.test.ts`, ao lado das que já existem.

---

## 4. Fronteira com as fatias vizinhas

- **#85 (orientação e "o que mudou" na Fase 4)** é dona dos três textos de orientação da Fase 4
  (`hasReadingGuidance(4)` continua falso aqui) e da frase de entrada na Fase 4 em `round-changes`.
  Também é ela quem deve olhar o `help` da seção "Concordância na rodada N, fechada", que hoje diz "é
  com ela que se decide onde refinar o codebook antes da próxima rodada", errado na Fase 4 (§ 5). Aqui:
  **não mexa** em `reading-guidance*` nem em `round-changes*`.
- **#86 (retorno)** é dona do botão de voltar e da confirmação, que "mostra a última rodada fechada da
  Fase 4 ao lado da sua referência". Ela deve reusar `referenceComparison` (D1) e o componente de D4;
  deixar os dois exportados e sem dependência da página. Aqui: nenhuma frase sobre voltar.
- **#83 (fechada)**: `loadEvaluatorParticipation`, `participationLabel` e a página de membros **não
  mudam**.
- **Revisão de discordâncias** (`rounds/[roundId]/page.tsx`): não recebe comparação nem marca. Ela é
  alcançada pelo Avaliador e não mostra ICR.
- **Matriz por célula** (ICR e Qualidade): fora. A comparação é só do valor da rodada.

---

# Parte 1 — A comparação

**Objetivo:** numa rodada da Fase 4 em foco, o Administrador vê, logo abaixo da Qualidade, o bloco que
nomeia a rodada de referência e põe ICR e Qualidade das duas lado a lado, com o par com e sem os
marcados de cada lado; na lista de rodadas, cada rodada da Fase 4 nomeia a sua referência e traz os
valores dela; nada de juízo; o Avaliador não vê nada disso.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `rounds/page.tsx`, `reference-round.ts` e o unitário,
`agreement-pair.ts`, `quality.ts`, `agreement-panel.tsx` (`AgreementValue`, `BandBadge`),
`quality-panel.tsx` (`QualityValue`), `round-list.tsx`, `pipeline/last-round-summary.tsx`, e em
`rounds/page.int.test.ts` os helpers e os casos "a Qualidade não usa cor de juízo em nenhum elemento" e
"a área de rodadas do avaliador não fala de coeficiente nem de Qualidade".

**Confirmar antes de codar:** D2 ⚠ e D3 ⚠ (e o texto de D4, se o dono quiser mexer).

### 1.1 A função (TDD, unitário)

- [ ] `reference-comparison.unit.test.ts` primeiro, vê-lo falhar, depois `reference-comparison.ts`
      (D1). Casos:
  - **rodada da Fase 3 ou da Fase 2** → `not_phase_4`;
  - **Fase 4 sem Fase 3 fechada antes** (só a Fase 3 aberta, ou nenhuma) → `no_reference`;
  - **Fase 4 com referência** → `compared`, com `reference.roundNumber` certo e os pares lidos **dos
    mapas recebidos** (passar pares sentinela e conferir identidade com `toBe`, para provar que não há
    segundo cálculo);
  - **passagem anterior** (a tabela da § 2): a rodada 2 compara com a 1 e a rodada 4 com a 3;
  - **referência com outlier e rodada sem**: cada lado traz o seu par como veio (`withoutOutliers` num
    lado e `null` no outro);
  - **a rodada da Fase 4 aberta** compara normalmente (`status` e `closedAt: null` no lado dela).

### 1.2 O modo neutro de `AgreementValue` (D3, se confirmada)

- [ ] `band?: boolean` em `AgreementValue` e no `ValuePart` interno; com `false`, sem `BandBadge`.
      Quem já usa (lista, série, `LastRoundSummary`) não passa a prop e não muda.

### 1.3 O bloco e a lista (TDD, teste de página)

- [ ] Criar `rounds/phase-4-reading.int.test.ts` (D10). Cena-base por helper: projeto na Fase 4, Admin,
      três avaliadores, uma versão de codebook com uma definição e dois critérios, uma de prompt,
      rodada 1 da Fase 3 fechada e rodada 2 da Fase 4 (aberta ou fechada, por parâmetro), com notas que
      deem ICR calculável nas duas. Casos, vendo o vermelho antes do código:
  - **o bloco aparece logo abaixo da Qualidade** e nomeia a rodada 1, a data de fechamento e as
    versões que ela validou; a ordem dos blocos é Concordância → Qualidade → Comparação → Rodadas do
    projeto (usar `blockIndexOf`, como o teste da orientação);
  - **os dois lados trazem ICR e Qualidade** com os mesmos números da lista de rodadas (comparar com
    as props de `RoundList` para as duas rodadas);
  - **com outlier só na referência**: o lado da referência traz "com todos" e "sem os marcados como
    outlier", o lado da rodada 2 traz um valor só; **com outlier só na rodada 2**, o inverso; **com
    outlier nos dois**, os dois pares;
  - **referência certa depois de um retorno e de um novo avanço**: rodadas 1 (F3, fechada), 2 (F4,
    fechada), 3 (F3, fechada), 4 (F4, em foco). O bloco nomeia a 3; na lista, o `Card` da rodada 2
    nomeia a 1 e o da rodada 4 nomeia a 3 (D2);
  - **a rodada em foco da Fase 3** não mostra o bloco, e nenhum `Card` de Fase 2 ou 3 traz a linha da
    referência;
  - **rodada da Fase 4 sem referência** (semear só a rodada da Fase 4): o bloco mostra a frase de D5;
  - **varredura de juízo no bloco**: o texto renderizado (`renderToStaticMarkup` do componente) não
    contém `melhor`, `pior`, `suficiente`, `insuficiente`, `subiu`, `caiu`, `replic`, `generaliz`,
    `aprovad`, `reprovad`, `↑`, `↓`, `▲`, `▼`, `+`/`−` antes de número; e nenhuma classe contém
    `success`, `warning`, `danger` ou `brand` (espelhar "a Qualidade não usa cor de juízo"). Fazer o
    mesmo com a linha da referência no `Card` da lista;
  - **o Avaliador não vê comparação**: logado como avaliador da rodada 2, a árvore não tem
    `ReferenceComparison`, e o texto não traz "rodada de referência", "Concordância" nem "Qualidade"
    (o ramo do avaliador já retorna antes; o teste prova).
- [ ] `reference-comparison.tsx` (D4, D5) e, em `page.tsx`, depois da seção de Qualidade:
      `referenceComparison(rounds, focusRound, agreement, quality)` e a seção quando `kind !==
      'not_phase_4'`.
- [ ] `round-list.tsx`: `RoundList` recebe `rounds`, `agreement` e `quality` (já recebe) e chama
      `referenceComparison` por rodada; com `compared`, a linha da referência abaixo dos valores (D2).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Nenhum teste antigo editado (se algum for,
listar no commit e dizer por quê).

Commit sugerido: `feat(rodadas): rodada da fase 4 ao lado da rodada de referência`, com `Refs #84`.

### O que a Parte 2 herda

- **Decisões confirmadas pelo dono em 2026-10-06, antes do código:** D2 (bloco na rodada em foco **e**
  linha da referência na lista), D3 (`band={false}`, sem diferença calculada) e os textos de D4/D5 como
  estão no plano.
- **Nomes finais:**
  - `reference-comparison.ts`: `referenceComparison`, `ComparedRound`, `ReferenceComparison`, como em D1.
    Se o mapa não tiver a rodada, o ICR cai em `agreementPair([], ∅)` (na página não acontece).
  - `reference-comparison-labels.ts` (novo, não previsto): `REFERENCE_COMPARISON_TITLE`,
    `REFERENCE_COMPARISON_HELP`, `referenceComparisonHint(n, r)`, `referenceSentence(ref)`,
    `referenceLine(ref)`, `noReferenceMessage(n)`.
  - `reference-comparison-panel.tsx`: `ReferenceComparisonPanel({ roundNumber, comparison })` (só o
    corpo; a `Section` fica na página, para a #86 reusar o corpo num diálogo) e `ReferenceRoundLine({
    reference })`, a linha do `Card` da lista.
  - `AgreementValue` ganhou `band?: boolean` (padrão `true`).
- **Divergências do plano:**
  - O componente **não** se chama `reference-comparison.tsx`: com `reference-comparison.ts` ao lado, o
    import `./reference-comparison` ficaria ambíguo. Virou `reference-comparison-panel.tsx`
    (`ReferenceComparisonPanel`), e o teste procura esse tipo na árvore.
  - O painel recebe `roundNumber` além de `comparison`, porque a frase de D5 precisa do número e a
    variante `no_reference` de D1 não o carrega. Sem referência, a `Section` não tem `hint`.
  - Em `phase-4-reading.int.test.ts`, `blockIndexOf` ignora os filhos `null` do fragmento: na Fase 4 a
    orientação é `null` e ocupa uma posição entre Concordância e Qualidade.
- **TDD:** o unitário falhou primeiro por módulo inexistente; a identidade dos pares (`toBe`) e a
  referência por rodada foram provadas quebrando o código de propósito (2 casos vermelhos). O teste de
  página ficou 10/11 vermelho com o componente pronto e ainda não ligado; o caso "o Avaliador não vê
  comparação" é asserção negativa e passou antes do código (não conta como vermelho). A varredura de
  juízo foi conferida tirando `band={false}` do painel (fica vermelha).
- **Testes antigos:** nenhum editado. Suíte: 88 arquivos, 1.281 testes; lint e typecheck verdes.
- **Para a Parte 2:** `phase-4-reading.int.test.ts` já tem a cena `phase4Scene(admin, specs)` (Ana,
  Bruno e Carla avaliando todas as rodadas; Ana com `anaUser` para logar como avaliadora) e os helpers
  (`findAll`, `findSection`, `blockIndexOf`, `markupTextOf`, `classNamesOf`, `allTextOf`, `listOf`).
  Falta `panelOf` para ler as props de `AgreementPanel`. Tela não conferida no navegador nesta Parte
  (fica para a 2.3, que já pede o bloco em 375 px).

---

# Parte 2 — A marca no painel

**Objetivo:** no painel de concordância de uma rodada da Fase 4, cada avaliador com avaliação em rodada
anterior aparece com `avaliou nas rodadas …`, só com as rodadas de número menor; nas Fases 2 e 3 o
painel não tem marca; a consulta só roda para o Administrador numa rodada da Fase 4.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 2 herda", `participation.ts` e o teste,
`round-usage.ts` e o teste, `agreement-panel.tsx` (`EffortList`), `rounds/page.tsx` (a transação), e o
"o que fica para depois" da Parte 3 do plano da #83 (D6 aplicada no `Badge`).

**Confirmar antes de codar:** D8 ⚠.

### 2.1 A restrição (TDD, unitário)

- [ ] `participation-labels.unit.test.ts` primeiro, depois `participation-labels.ts` (D6). Casos:
  - **só as rodadas de número menor entram**: Ana com rodadas 1 (F2), 3 (F3) e 5 (F4), painel da
    rodada 5 → `avaliou nas rodadas 1 (Fase 2) e 3 (Fase 3)`;
  - **a própria rodada não conta**: Bia só com a rodada 5, painel da 5 → sem chave;
  - **rodada posterior não conta** (painel de uma rodada da Fase 4 antiga): Ana com 1, 2 e 4, painel da
    2 → `avaliou na rodada 1 (Fase 3)`;
  - **quem não tem rodada nenhuma** → sem chave;
  - **mapa vazio** → `{}`.

### 2.2 O painel (TDD, teste de página)

- [ ] Em `phase-4-reading.int.test.ts`, com `panelOf(tree)` lendo as props de `AgreementPanel`:
  - **na rodada da Fase 4, o veterano tem a marca e o novo não**: Ana avaliou a rodada 1 (F3) e a 2
    (F4, em foco); Carla só a 2 → `participation` é `{ [anaMember]: 'avaliou na rodada 1 (Fase 3)' }`;
    a avaliação da própria rodada 2 não aparece em ninguém;
  - **com a rodada da Fase 4 aberta**, o mesmo (a rodada aberta é a do painel e não conta);
  - **depois de um retorno e de um novo avanço** (rodadas 1 F3, 2 F4, 3 F3, 4 F4 em foco): a marca de
    Ana na rodada 4 lista `1 (Fase 3), 2 (Fase 4) e 3 (Fase 3)`;
  - **o Administrador-avaliador** aparece com a marca pelo vínculo de avaliador (usar o id devolvido
    por `addActiveEvaluator`, lição da #83);
  - **numa rodada em foco da Fase 3 e numa da Fase 2**, `participation` é `undefined`. Esta asserção
    negativa passa antes do código (a prop ainda não existe): **não conta como vermelho**; dizer isso no
    handoff;
  - **o Avaliador não vê marca**: logado como Ana, a árvore não tem `AgreementPanel` e o texto não traz
    "avaliou n".
- [ ] `rounds/page.tsx`: dentro da transação, `participation: isAdmin && focusRound?.phase === PHASE_4 ?
      await loadEvaluatorParticipation(projectId, tx) : null`; fora, `participationBefore(…,
      focusRound.roundNumber)` e passar a `AgreementPanel` só nesse caso.
- [ ] `agreement-panel.tsx`: prop `participation`, o `Badge` (D7) e o tooltip (D8, se confirmado).

### 2.3 Tela

- [ ] Conferir no navegador (memórias "Preview pane: faixa preta" e `/dev/login`), como Administrador,
      com a cena de retorno (rodadas 1 F3, 2 F4, 3 F3, 4 F4), e como Avaliador. Medir em 375 px dentro
      de iframe: a marca quebra linha sem empurrar a contagem "N avaliações enviadas"; o bloco de
      comparação da Parte 1 empilha as duas colunas. **Apagar a cena antes de `npm test`** (memória "cena
      no banco quebra int test").

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; tela conferida nos dois papéis.

Commit sugerido: `feat(rodadas): marca de participação no painel da rodada da fase 4`, com `Refs #84`.

### O que a Parte 3 herda

_(preencher ao fim da Parte 2)_

---

# Parte 3 — As séries

**Objetivo:** a série de ICR da visão geral mostra a Fase 4 agrupada e explica a Fase 4 no texto de
ajuda; a série de Qualidade cobre as Fases 3 e 4, diz a fase de cada ponto, agrupa por fase e deixa de
falar só em "rodadas da Fase 3"; a varredura confirma os ACs e os testes da issue.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 3 herda", `agreement-series.ts` e o unitário,
`agreement-series-chart.tsx`, `quality-series.ts` e o unitário, `quality-series-list.tsx`,
`quality-labels.ts`, `(tabs)/page.tsx` (seções das séries) e, em `(tabs)/page.int.test.ts`, `seriesOf`,
`qualitySeriesOf` e "o Administrador vê a série de Qualidade com um ponto por rodada da Fase 3…".

**Confirmar antes de codar:** D9 ⚠.

### 3.1 A série de Qualidade com a fase (TDD, unitário)

- [ ] `quality-series.unit.test.ts`:
  - **editado** (citar no commit) "só as rodadas da Fase 3 viram ponto" → "só as rodadas das Fases 3 e
    4 viram ponto", com rodadas das Fases 2, 3 e 4 na entrada: a da Fase 2 fica fora, as outras duas
    entram na ordem;
  - **novo**: cada ponto traz a fase da própria rodada. É este que fica vermelho antes do código (o
    filtro `hasQuality` já aceita a Fase 4, então o caso anterior pode passar de primeira; dizer isso
    no handoff);
  - **novo**: com o retorno (F3, F4, F3), `phaseRuns(qualitySeries(…))` dá três grupos, na ordem.
- [ ] `quality-series.ts`: `phase` no ponto. `agreement-series.ts`: `phaseRuns` genérico (D9). Os
      unitários de `phaseRuns` continuam sem edição.

### 3.2 As telas e os textos (TDD, teste de página)

- [ ] Em `(tabs)/page.int.test.ts`:
  - **a série de ICR mostra a Fase 4 agrupada**: rodadas 1 (F2), 2 e 3 (F3), 4 (F4) → `seriesOf` tem
    quatro pontos, e `phaseRuns` dos pontos dá `[2, 3, 4]`; o texto do gráfico traz "Fase 4" como
    cabeçalho de grupo. É teste de caracterização (já passa hoje): dizer no handoff;
  - **o help da série de ICR fala da Fase 4** (lido da prop `help` da `Section`, não do texto: lição do
    redesenho, `collectText` não lê prop);
  - **a série de Qualidade cobre as Fases 3 e 4**: as mesmas rodadas → `qualitySeriesOf` tem três
    pontos (2, 3 e 4), cada um com a sua fase; a lista renderizada agrupa com "Fase 3" e "Fase 4";
  - **os rótulos não dizem mais "rodada(s) da Fase 3" sozinhos**: `QUALITY_SERIES_HINT`, `HELP` e
    `NOTE_SINGLE` mencionam a Fase 4 (asserção sobre as strings exportadas);
  - **editado**, se o texto antigo estiver afirmado: "o Administrador vê a série de Qualidade com um
    ponto por rodada da Fase 3…" (citar no commit);
  - **o Avaliador não vê as séries com a Fase 4**: logado como avaliador num projeto com rodada da Fase
    4, `seriesOf` e `qualitySeriesOf` não existem na árvore.
- [ ] `quality-series-list.tsx` (agrupamento e `· Fase N`), `quality-labels.ts` e o `help` da seção
      "Concordância por rodada" em `(tabs)/page.tsx` (D9).

### 3.3 Tela

- [ ] Conferir a visão geral no navegador com a cena de retorno (F3, F4, F3, F4) e uma rodada da Fase
      2 antes: a série de ICR com quatro grupos e as linhas tracejadas entre eles; a de Qualidade com
      três grupos. 375 px em iframe. Apagar a cena antes da suíte.

### 3.4 Varredura dos ACs

- [ ] Tela da rodada da Fase 4 mostra ICR e Qualidade da rodada e o bloco → 1.3 (e o ICR/Qualidade da
      própria rodada já provados na #82).
- [ ] O bloco nomeia a referência e mostra ICR e Qualidade das duas lado a lado → 1.3.
- [ ] Com outlier em qualquer das duas, os valores com todos e sem os marcados → 1.1 e 1.3.
- [ ] Nenhuma palavra, cor ou seta de juízo no bloco → 1.3 (varredura).
- [ ] Rodada da Fase 4 de uma passagem anterior comparada com a sua referência → 1.1 e 1.3 (lista).
- [ ] No painel da Fase 4, a marca considera só rodadas anteriores → 2.1 e 2.2.
- [ ] A marca não aparece no painel das Fases 2 e 3 → 2.2.
- [ ] Série de ICR com a Fase 4 agrupada; série de Qualidade com as Fases 3 e 4 → 3.1 e 3.2.
- [ ] Nenhuma tela do Avaliador recebe comparação, marca ou números da referência → 1.3, 2.2 e 3.2; e
      `git diff 92d9c00 --stat` não toca `(tabs)/evaluate/` nem `rounds/[roundId]/`.
- [ ] Nada gravado → `git diff 92d9c00 --stat` não toca `actions.ts`, `lib/db/schema.ts` nem
      `supabase/migrations/`.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; telas conferidas; checkboxes da issue
conferidos com a varredura.

Commit sugerido: `feat(visao-geral): séries de ICR e de Qualidade com a fase 4`, com `Closes #84` no
corpo.

### O que fica para depois

_(preencher ao fim da Parte 3)_

---

## 5. Fica para depois (registrar, não construir)

- **`help` da seção "Concordância na rodada N, fechada"** na tela de rodadas diz "é com ela que se
  decide onde refinar o codebook antes da próxima rodada", o que é falso na Fase 4 (nada se refina).
  É texto de orientação: levar para a #85.
- **A confirmação do retorno (#86)** mostra a última rodada fechada da Fase 4 ao lado da sua referência:
  reusar `referenceComparison` e o componente de D4.
- **Comparar rodadas da Fase 4 entre si** além da série: fora do épico.
- **Matriz por célula ao lado da referência**: fora; se vier, é issue nova.

## 6. Deploy

Sem migration e sem `db push`. Antes do deploy, conferir que prod não está atrasado em schema (memória:
prod já atrasou duas vezes).
