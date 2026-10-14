# Plano 3 — Leitura da rodada: a célula por resposta

Série "Critério por Resposta", plano 3 de 4. Spec: `~/Desktop/spec-criterio-por-resposta-v2.md`
(fora do repo; seções 1 a 5 e 10 são o contexto comum, a 6.3 é a origem deste plano). Escrito em
2026-10-13 contra o `main` em `907184d`, **antes** de os Planos 1 e 2 serem implementados. Os nomes
que vêm deles são os propostos lá:

- do Plano 1 (D4, § 5.2): `Scope`, `isPerResponse`, `perResponseCriteria`, a opção
  `perResponseCriteria` de `addCodebookVersion`, `definitionId: string | null` em `CellFixture`,
  `addScore` e `addConsensusNote`, e os **descartes** de nota sem definição (D3) em
  `agreement.ts` (dois), `review.ts` e `consensus.ts`;
- do Plano 2 (D1, D2, D3): `CodebookCell.definition: D | null` com a célula por resposta no fim de
  `resolveCells`, `PER_RESPONSE_LABEL = 'Por resposta'` em `pipeline/criteria.ts` e
  `PER_RESPONSE_KEY = 'per_response'` em `evaluate/completeness.ts`.

**Antes da Parte 1, ler o § 6.6 do Plano 1 e o § 7.6 do Plano 2** ("O que o Plano N herda") e
corrigir aqui o que tiver mudado.

**Objetivo:** ICR, Qualidade, as duas matrizes, a revisão de discordâncias e as anotações de
consenso tratam a célula por resposta. Nenhuma tela cria critério por resposta ainda (Plano 4); a
conferência no navegador usa uma cena montada à mão (§ 8).

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Observações com a célula por resposta (ICR, Qualidade, Fase 4) e as duas matrizes com a linha e a coluna "Por resposta"; verbete *Concordância (ICR)* | `feat(rodadas): célula por resposta no ICR e nas matrizes` | |
| 2 | Anotação de consenso na célula por resposta, no servidor: action, leitura e chave | `feat(consenso): anotação na célula por resposta` | |
| 3 | Revisão de discordâncias: grupo "Por resposta" com notas, divergência e o formulário de consenso; verbete *Divergência* | `feat(revisão): grupo por resposta na revisão de discordâncias` | |

**Duas decisões ⚠** (D1 e D2), as duas antes da Parte 1. Perguntar as duas de uma vez antes de
editar código, mesmo que o pedido seja só "implemente a Parte 1".

Sem issue no GitHub: os commits não levam `Refs`/`Closes`.

---

## 1. Ponto de partida

Caminhos curtos são relativos a `app/projects/[id]/(tabs)/rounds/`.

| Peça | Onde | Nesta série |
|---|---|---|
| Observações | `agreement.ts`: `RoundObservation`/`ScoreRow` com `definitionId: string`, `toObservation` (`unitId` = `` `${resp}:${def}:${crit}` ``), `loadRoundObservations`, `loadProjectObservations` (os dois com o descarte do Plano 1) | Parte 1 |
| Matrizes | `agreement-matrix.ts`: `MatrixColumn` (`isGeneral`, `criteria: Map<definitionId, C>`), `MeasuredRow.definition: D`, `cellKey` privado, `matrixColumns` (gerais, depois específicos), `measuredMatrix`, `agreementMatrix`; `quality.ts` (`qualityMatrix` chama `measuredMatrix`) | Parte 1 |
| Tabelas | `agreement-matrix-table.tsx`, `quality-matrix-table.tsx`: linha por `row.definition.id`/`.title`, selo "Geral" na coluna, `title` do traço = `CELL_NOT_APPLICABLE_TITLE` | Parte 1 |
| Textos | `agreement-labels.ts` (`CELL_NOT_APPLICABLE_TITLE` ~27, `MATRIX_LEGEND` ~31), `quality-labels.ts` (`QUALITY_MATRIX_LEGEND` ~31) | Parte 1 |
| Consenso | `consensus-actions.ts` (`cellExists` ~68, parse ~108, `key` do delete ~154, upsert ~170), `consensus.ts` (`ConsensusNote`, `NOTE_COLUMNS`, `asNotes` com o descarte do Plano 1), `consensus-cells.ts` (`consensusCellKey`, `consensusByCell`) | Parte 2 |
| Revisão | `review-groups.ts` (`CellNote`, `ReviewGroup.definition: D`, `cellKey` privado, `reviewGroups`), `review.ts` (`loadResponseNotes`, com o descarte do Plano 1), `review-groups-list.tsx` (`Group`, `Cell`, `ConsensusCell`), `consensus-form.tsx` (`definitionId: string`), `divergence.ts` (`divergenceMeaning`, `DIVERGENCE_LEGEND`) | Parte 3 |
| Página da revisão | `[roundId]/page.tsx`: `reviewGroups(...)`, contagem de células e de "sem nota" pelos grupos | não muda |
| Testes | `agreement-matrix.unit`, `quality-matrix.unit`, `agreement-labels.unit`, `agreement.int`, `page.int`, `consensus-cells.unit`, `consensus.int`, `consensus-actions.int`, `review-groups.unit`, `divergence.unit`, `[roundId]/page.int` | as três Partes |

---

## 2. O que a revisão da spec achou

Achados desta revisão contra o código, além dos da seção 4 da spec. Os que mudam outro plano estão
marcados **→ Plano N** e repetidos no handoff (§ 7.9) e na spec (seção 4, itens 30 a 40).

1. **Os Planos 1 e 2 ainda não foram implementados.** Ver o aviso do topo.
2. **O apagar da anotação por resposta não apagaria nada.** O `key` do delete em
   `saveConsensusNote` (~154) usa `eq(consensusNotes.definitionId, definitionId)`. No Drizzle 0.45.2,
   `eq` gera `"definition_id" = $1` (`node_modules/drizzle-orm/sql/expressions/conditions.js`), e
   `= NULL` nunca é verdadeiro: salvar com o texto vazio devolveria "Anotação removida." e a linha
   ficaria. O tipo aceita `null` na coluna anulável, então o `tsc` não avisa. A Parte 2 troca por
   `isNull` quando a definição é nula (D6), com um teste que fica vermelho por esse motivo. O upsert
   não tem o problema: o alvo do `ON CONFLICT` usa a restrição `NULLS NOT DISTINCT` (spec, item 9).
3. **O traço "não aplicável" só sabe dizer um motivo.** `CELL_NOT_APPLICABLE_TITLE` é "critério
   específico de outra definição", e o teste `agreement-labels.unit` ~211 afirma `'outra
   definição'`. Na linha "Por resposta" e na coluna do critério por resposta o motivo é outro; as
   duas legendas (`MATRIX_LEGEND`, `QUALITY_MATRIX_LEGEND`) só explicam o de hoje. D2.
4. **A divergência extrema aponta para a definição.** `divergenceMeaning('extreme')` e
   `DIVERGENCE_LEGEND` dizem "costuma indicar definição ambígua … pede descrição mais precisa na
   definição". Na célula por resposta não há definição. D2.
5. **`QUALITY_POINTS` diz "Cada nota é uma célula (definição × critério)"** (`quality-labels.ts`
   ~24) no painel de Qualidade de toda rodada das Fases 3 e 4. Trocar aqui anunciaria um critério
   que ninguém consegue criar, pelo mesmo motivo do achado 6 do Plano 2. **→ Plano 4**, junto com o
   `NOTES_PER_RESPONSE_HELP`.
6. **Na ordem da spec, o formulário de consenso quebraria entre as Partes.** Se a revisão ganha o
   grupo "Por resposta" antes de o servidor aceitar a célula sem definição, o formulário desse grupo
   manda `definition_id` vazio e recebe "Anotação inválida" até a Parte seguinte. D1 inverte as
   Partes 2 e 3 da spec.
7. **As chaves internas são testadas pelo texto.** `consensus-cells.unit` afirma `'d1:c1'` em todos
   os casos. Trocar o formato (por exemplo, para o `cellKey` do formulário, `d1_c1`) mudaria
   asserções antigas sem mudar comportamento. D4 mantém o formato e só dá marcador ao nulo.
8. **Tudo o que vem depois das observações já ignora a definição.** `ordinalAlpha`
   (`lib/agreement.ts`, agrupa por `unitId`), `qualityOf`, `agreementPair`/`withoutExcluded`,
   `agreementSeries`, `qualitySeries`, `referenceComparison` (Fase 4) e o painel da visão geral
   (`(tabs)/page.tsx` ~228, `loadProjectObservations`) consomem `RoundObservation` sem ler
   `definitionId`. R17, R19 e R22 saem de tirar os dois descartes de `agreement.ts`; não há regra
   nova nesses módulos.
9. **`agreement.int` › "avaliação parcial vira dado faltante … sem nenhum null"** afirma que nenhum
   campo da observação é `null`. Continua verde (o codebook dele não tem critério por resposta) e
   continua certo: o teste é sobre dado faltante. Não estender esse teste ao PoC.
10. **Testes que leem a definição de linha ou de grupo** (não de célula; os de célula o Plano 2 já
    ajustou): `agreement-matrix.unit` ~238, `quality-matrix.unit` ~85, `review-groups.unit` ~56,
    `[roundId]/page.int` ~193 e ~524. Com `definition: D | null`, o `typecheck` aponta; edição
    mecânica (`?.`), sem asserção mudada.
11. **O Plano 2 deixa o título da célula de cena como `''`** em `page.int` e `[roundId]/page.int`
    (`cell.definition?.title ?? ''`, § 5.5 dele). Aqui passa a `?? PER_RESPONSE_LABEL`, para os
    helpers `note`/`cellOf`/`consensus` acharem a célula por resposta pelo rótulo da linha.
12. **O teste do Plano 1 em `consensus-actions.int`** (célula com definição num critério por
    resposta → `cell_missing`) já cobre uma das recusas da Parte 2; não duplicar.
13. **A página da revisão já conta a célula nova.** `[roundId]/page.tsx` soma `group.cells.length` e
    `ratedCells(groups)`: com o grupo por resposta, o "1 de 6 células diverge" e o "N células sem
    nota" do topo incluem a célula sem mudança na página.

---

## 3. Decisões

**D1 ⚠. Ordem das Partes** (achado 6). A spec põe a revisão na Parte 2 e o consenso na 3. Duas
saídas:

- **(a) recomendada, consenso no servidor antes da revisão**: a Parte 2 faz a action, a leitura e a
  chave aceitarem a célula sem definição; a Parte 3 mostra o grupo "Por resposta", já com o
  formulário funcionando. Entre as Partes, uma anotação por resposta pode existir no banco e não
  aparece em tela nenhuma (só com critério montado à mão).
- **(b) a ordem da spec, com descarte provisório**: a Parte 2 mostra o grupo sem o formulário de
  consenso, e a Parte 3 o acrescenta. Custa um descarte a mais, no idioma do D5 do Plano 2.

Recomendação: **(a)**. Nenhum descarte novo, e cada Parte fecha uma coisa inteira.

**D2 ⚠. Textos** (spec 7.1, a parte do Plano 3). Regra usada, a mesma do D2 do Plano 2: **texto
que só aparece quando existe critério por resposta entra aqui; texto que aparece em todo projeto
fica como está** (achado 5).

- **Rótulo da linha** nas duas matrizes e do grupo na revisão: `PER_RESPONSE_LABEL` ("Por
  resposta"). O cabeçalho da primeira coluna das matrizes continua "Definição".
- **Selo da coluna** do critério por resposta, no lugar onde o geral leva "Geral": `Badge` neutro
  com `PER_RESPONSE_LABEL`.
- **`title` do traço**, dois novos em `agreement-labels.ts`; o de hoje não muda:
  - na linha "Por resposta", colunas de específicos e gerais: `critério de definição, que não se
    avalia na resposta inteira`;
  - nas linhas das definições, coluna do critério por resposta: `critério por resposta, que se
    avalia na resposta inteira e não numa definição`.
- **Parágrafo a mais no "Como ler"** das duas matrizes, **só quando há a linha por resposta**:
  `A linha “Por resposta” traz os critérios que julgam a resposta inteira: uma nota por resposta,
  sem definição. Por isso o “—” aparece nela nas colunas dos critérios de definição, e nas linhas
  das definições na coluna do critério por resposta.` Os parágrafos de hoje não mudam.
- **Divergência extrema na célula por resposta** (`title` do selo e texto da célula sem nota):
  `As notas foram de Alto a Baixo na mesma célula: sem definição em jogo, costuma ser o próprio
  critério que admite leituras opostas, e pede descrição mais precisa nele.` (com `scaleLabel`, no
  molde do texto de hoje). Os outros quatro estados usam o texto de hoje, que vale também aqui.
- **Parágrafo a mais no "Como ler as divergências"**, só quando há o grupo por resposta: `No grupo
  “Por resposta” não há definição: ali a divergência extrema costuma apontar para o próprio
  critério, e pede descrição mais precisa nele.`
- **Glossário**: textos em § 5.6 e § 7.5.

**D3. Forma da matriz** (R18):

- `matrixColumns` acrescenta, **depois** dos gerais e dos específicos, uma coluna por critério por
  resposta (`perResponseCriteria`). `MatrixColumn` ganha `isPerResponse: boolean` (`isGeneral`
  continua; os dois falsos é específico) e `criteria` passa a `ReadonlyMap<string | null, C>`: a
  coluna por resposta mapeia `null` → critério; as outras, como hoje, o id da definição.
- `measuredMatrix` monta as linhas das definições e, **só se houver critério por resposta**, uma
  última linha com `definition: null` (`MeasuredRow.definition: D | null`, idem `MatrixRow`). A
  célula de cada linha é `column.criteria.get(definition?.id ?? null)`: ausente é `not_applicable`,
  como hoje. Isso dá os dois "não aplicável" de R18 sem regra nova.
- `MeasuredCell`/`MatrixCell` **não mudam** (os testes comparam `{ state: 'not_applicable' }` por
  igualdade). O motivo do traço sai da tabela: linha nula → `title` da linha; coluna
  `isPerResponse` → `title` da coluna; senão, o de hoje.
- Nas tabelas: título da linha `definition?.title ?? PER_RESPONSE_LABEL`, `key` `definition?.id ??
  PER_RESPONSE_KEY`.

**D4. Chaves.** O formato `:` fica; só o nulo ganha marcador, `PER_RESPONSE_KEY` de
`completeness.ts` (spec, item 7):

- `agreement.ts`: `unitId` = `` `${responseId}:${definitionId ?? PER_RESPONSE_KEY}:${criterionId}` ``;
- `cellKey` privado de `agreement-matrix.ts` e de `review-groups.ts`, e `consensusCellKey`
  exportado: recebem `definitionId: string | null` e fazem o mesmo.

Juntar as três funções numa só fica fora: mudaria import e nome sem mudar comportamento.

**D5. O grupo da revisão** (R20). `ReviewGroup.definition: D | null`; `reviewGroups` acrescenta,
depois dos grupos das definições e **só se houver critério por resposta**, um grupo com
`definition: null` e uma célula por critério por resposta (`isGeneral: false`), com a divergência
de `classifyDivergence` como as demais. `CellNote.definitionId: string | null`. Na tela: título
`PER_RESPONSE_LABEL`, sem o selo de tipo de definição; o texto "Esta definição não tem critério…"
continua só para definição (o grupo por resposta nunca é vazio).

**D6. A célula sem definição no consenso** (R21):

- **Formulário**: `ConsensusForm.definitionId: string | null`; o campo oculto manda `definitionId ??
  ''`. Vazio quer dizer "célula por resposta".
- **Parse**: `definition_id` vazio → `null`; senão tem que ser UUID (os outros quatro ids continuam
  exigindo UUID). Lixo continua dando "Anotação inválida".
- **`cellExists`**: sem definição, o critério tem que ser da versão **e** `isPerResponse`; com
  definição, como deixou o Plano 1 (a definição da versão, e o critério geral ou próprio dela).
- **Delete**: `definitionId === null ? isNull(consensusNotes.definitionId) : eq(...)` (achado 2).
  O upsert não muda.

**D7. Fase 4 e visão geral** (R22): sem código e sem teste próprio. O teste de
`loadProjectObservations` da Parte 1 é a prova, porque a leitura da Fase 4 e o painel da visão
geral montam tudo a partir dele (achado 8). Dizer isso no handoff.

---

## 4. Gotchas

- **Docker Desktop antes de tudo.**
- **`scores` inteira vazia antes do `npm test`**. Nas Partes 1 e 3, limpar a cena do navegador
  antes da suíte (§ 8), e não semear com a suíte rodando.
- **Não salvar o codebook da cena**: até o Plano 4, salvar descarta o critério por resposta.
- **TDD**: ler a **mensagem** de cada vermelho e contar quais asserções rodaram; asserções depois
  da primeira falha não rodaram (`it` separados, ou mutação depois do verde). Vermelho de import e
  `TypeError` de `null` não provam regra. O Vitest não confere tipos: os testes rodam com o `tsc`
  quebrado.
- **Testes de tela antes do código da matriz/do grupo**: com o código pronto e a tabela ainda não, a
  tabela quebra com *Cannot read properties of null* (vermelho que não prova nada). Escrever os
  casos de página primeiro, ver o vermelho por ausência do rótulo, e só então mexer.
- **`npm run typecheck` depois da última edição de teste.**
- **Antes de prever testes antigos editados**, buscar as frases que mudam ou ganham irmã:
  `outra definição`, `definição ambígua`, `descrição mais precisa na definição`,
  `CELL_NOT_APPLICABLE_TITLE`, `divergenceMeaning(`, `DIVERGENCE_LEGEND`, `consensusCellKey(`.
- **`markupTextOf` lê o balão do ⓘ e o corpo de `<details>` fechado**; o "Como ler" é um
  `<details>`: afirmar a presença do parágrafo pelo markup e a ausência com `glanceTextOf` só se o
  teste for sobre o que se vê fechado.
- **Sem comentários novos no código; sem `npx prettier`.**
- **Desfazer mutação por `cp`/`sed` inverso, nunca `git checkout`.**

---

## 5. Parte 1 — Observações e matrizes

**Antes de começar:** ler os handoffs dos Planos 1 e 2 e perguntar D1 e D2. Este texto assume D1 =
(a) e D2 como está.

**Ler antes:** `agreement.ts`, `agreement-matrix.ts`, as duas tabelas, `agreement-labels.ts`
(~20–90), `quality-labels.ts` (~15–45); `agreement-matrix.unit` e `quality-matrix.unit` até o
primeiro `describe`; `agreement.int` até o primeiro `it`; em `page.int`, `roundWith`, `note`,
`qualityMatrixScene` (~606) e os casos da matriz de Qualidade (~1887–1950).

### 5.1 Matriz (TDD, unitário) — `agreement-matrix.unit.test.ts` e `quality-matrix.unit.test.ts`

Nas fábricas: `criterion` já tem o tipo (Plano 1); acrescentar `perResponse(id, name)`; `score`
aceita `definitionId: string | null` e monta o `unitId` com `PER_RESPONSE_KEY` (D4). `describe`
novo, "a linha por resposta", com o PoC (cinco Queries, `Relevance` geral, `Diversity` por
resposta). Um `it` por caso:

- [ ] **Colunas**: `Relevance`, depois `Diversity`; `isPerResponse` `[false, true]`, `isGeneral`
      `[true, false]`; a coluna `Diversity` tem só a chave `null`.
- [ ] **Linhas**: seis, as cinco Queries e por último a de `definition: null`; cada uma com duas
      células.
- [ ] **Os dois "não aplicável" de R18**: nas cinco Queries, `Diversity` é `{ state:
      'not_applicable' }`; na linha por resposta, `Relevance` também.
- [ ] **A célula por resposta tem coeficiente**: notas por resposta de dois avaliadores com variação
      e acordo perfeito → `alpha` 1; com notas de definição discordantes ao lado, a célula por
      resposta continua 1 (não vaza), e a de `Relevance` da Query 1 não muda com as notas por
      resposta.
- [ ] **Nota sem definição num critério geral não cai em célula nenhuma**: todas as células da
      matriz ficam `unrated`.
- [ ] Em `quality-matrix.unit`: a linha por resposta traz a distribuição das notas por resposta
      (contagens exatas), e o par com e sem o marcado como nas outras células.

Vermelho esperado: a matriz tem cinco linhas e uma coluna, e `isPerResponse` é `undefined`
(vermelhos de asserção). Os casos de coeficiente e de distribuição quebram antes, ao procurar a
linha que não existe: só provam depois do verde; provar por mutação (devolver `undefined` na
`criteria.get(null)` da coluna por resposta; trocar `PER_RESPONSE_KEY` por `'null'` no
`cellKey`), e dizer no resumo quais casos foram provados assim. Os casos antigos verdes provam que
codebook sem critério por resposta não ganha linha nem coluna.

### 5.2 Observações (TDD, integração) — `agreement.int.test.ts`

`seedRound` aceita `perResponseCriteria` e repassa a `addCodebookVersion` (as células já saem com
`definitionId: null` desde o Plano 2). Cenário do PoC. Um `it` por caso:

- [ ] **`loadRoundObservations` traz a nota por resposta**: um avaliador, uma resposta → 6
      observações, uma só com `definitionId: null`, no `Diversity`; 6 unidades distintas.
- [ ] **Uma unidade por resposta** (R17): duas respostas → duas unidades do `Diversity`, diferentes
      entre si e de toda unidade de definição.
- [ ] **O ICR conta a célula por resposta** (R17): dois avaliadores, duas respostas, `Relevance`
      igual entre eles e com variação, `Diversity` em pontos opostos → `ordinalAlpha` das
      observações abaixo de 1 (sem as notas por resposta seria 1; afirmar os dois, filtrando).
- [ ] **A Qualidade conta a nota por resposta** (R19): `qualityOf` das observações tem `total` 6 e
      a contagem de Alto inclui a nota do `Diversity`.
- [ ] **`loadProjectObservations` também traz** (R22, D7).

Vermelho esperado: os dois descartes do Plano 1 → 5 observações (vermelhos de asserção pela
contagem). O do ICR falha pelo `alpha` 1.

### 5.3 Tabelas (TDD, integração) — `page.int.test.ts`

**Antes do código de § 5.4** (gotcha da tela). O título da célula de cena passa a `?? PER_RESPONSE_LABEL`
(achado 11). Cena: o PoC numa rodada fechada da Fase 3, dois avaliadores, duas respostas, com
notas em todas as células (no molde de `qualityMatrixScene`). Um `it` por caso:

- [ ] **Matriz de concordância**: no markup, a linha "Por resposta" vem depois de "Query 5"; a
      coluna `Diversity` tem o selo "Por resposta"; os traços da linha por resposta levam o `title`
      da linha e os da coluna `Diversity` nas Queries, o da coluna (contar as ocorrências de cada
      `title`, no molde do ~1941); o parágrafo novo está no "Como ler".
- [ ] **Matriz de Qualidade**: o mesmo, com a distribuição na célula por resposta.
- [ ] **Sem critério por resposta, nada novo**: na cena de `qualityMatrixScene`, o parágrafo novo e
      os dois `title` novos não aparecem.

Em `agreement-labels.unit`: os dois `title` novos aparecem no parágrafo novo, e nenhum deles é o
de hoje. Vermelho de import; a prova é a da página.

Vermelho esperado: "Por resposta" ausente do markup (asserção). As asserções de `title` e de
parágrafo só rodam depois do verde da primeira; o último caso é guarda de regressão (verde desde o
começo) e só prova depois do código: mutar o "só quando há linha por resposta" para sempre.

### 5.4 Código

Ordem: `agreement-matrix.ts` depois do vermelho de § 5.1 e de § 5.3; `agreement.ts` depois do de
§ 5.2.

- `agreement.ts`: `ScoreRow`/`RoundObservation` com `definitionId: string | null`; `unitId` (D4);
  remover os dois descartes do Plano 1.
- `agreement-matrix.ts`: D3 e D4. `quality.ts` não muda (o tipo vem de `MeasuredRow`).
- `agreement-labels.ts`: os dois `title` e o parágrafo (D2). `QUALITY_MATRIX_LEGEND` não muda; a
  tabela de Qualidade acrescenta o mesmo parágrafo.
- As duas tabelas: D3 (título, `key`, selo, `title` do traço) e o parágrafo condicional
  (`rows.some((row) => row.definition === null)`).

### 5.5 Testes antigos (só o tipo)

Os do achado 10 que são desta Parte: `agreement-matrix.unit` ~238 e `quality-matrix.unit` ~85
(`row.definition?.id`). Nenhuma asserção muda.

### 5.6 Docs

`docs/CONTEXT.md`, verbete **Concordância (ICR)** (tracked, entra no commit). Duas trocas:

- "A unidade de análise é resposta × célula: a mesma resposta avaliada em duas definições rende duas
  unidades, não uma." → acrescentar: "e a célula de um critério por resposta rende uma unidade por
  resposta."
- "**não aplicável** é o par definição × critério que não existe naquela versão — critério
  específico de outra definição —" → "… que não existe naquela versão — critério específico de
  outra definição, critério de definição na linha por resposta, ou critério por resposta na linha
  de uma definição —".

### 5.7 Conferência no navegador

Cena do § 8. No `tcc-dev-local`, aba Rodadas, rodada da cena em foco:

- matriz de concordância e de Qualidade com seis linhas, "Por resposta" por último, os traços nos
  lugares do exemplo da seção 9 da spec, o selo na coluna `Diversity`, o `title` certo em cada
  traço (ler por `javascript_tool`) e o parágrafo no "Como ler";
- o coeficiente da rodada e a Qualidade da rodada mudam com a cena (contam a célula por resposta);
- a 375 px, a tabela rola dentro do quadro, sem estourar a página.

Apagar a cena (§ 8) antes do `npm test`.

### 5.8 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -n "definitionId === null" "app/projects/[id]/(tabs)/rounds/agreement.ts"` não acha
  descarte.
- Conferência do § 5.7 feita, cena apagada.
- Testes antigos editados: os de § 5.5 e o título de cena do achado 11 em `page.int` (listar no
  handoff).

### 5.9 O que a Parte 2 herda

Feita em 2026-10-14, sem commit no momento da escrita.

- **D1 = (a) e D2 como está**, confirmadas pelo usuário antes do código.
- **Nomes finais** em `agreement-labels.ts`: `CELL_PER_RESPONSE_ROW_TITLE` (traço na linha por
  resposta), `CELL_PER_RESPONSE_COLUMN_TITLE` (traço na coluna por resposta),
  `MATRIX_PER_RESPONSE_LEGEND` (o parágrafo) e `cellNotApplicableTitle(isPerResponseRow,
  isPerResponseColumn)`, usada pelas duas tabelas (`Cell` recebe `notApplicableTitle`).
- **Correção do topo**: `agreement.ts` tinha **um** descarte (em `toObservation`, que serve aos dois
  loaders), como o handoff do Plano 1 já dizia. Removido; o `grep` de § 5.8 não acha nada.
- Matriz: `MatrixColumn.isPerResponse`, `criteria: ReadonlyMap<string | null, C>`,
  `MatrixRow`/`MeasuredRow.definition: D | null`; a linha nula só existe com coluna por resposta.
  `quality.ts` não mudou. Nenhum outro consumidor precisou de ajuste (`tsc` verde).
- **Testes novos**: `agreement-matrix.unit` › "a linha por resposta" (5 `it`), `quality-matrix.unit`
  › "a linha por resposta" (1), `agreement.int` › "a célula por resposta" (5), `page.int` (3:
  concordância, Qualidade, guarda sem critério por resposta), `agreement-labels.unit` (1).
- **Testes antigos editados** (só tipo/fábrica): `agreement-matrix.unit` e `quality-matrix.unit`
  (`score`/`ratings` aceitam `null` e montam o `unitId` com `PER_RESPONSE_KEY`; `row.definition?.id`
  em ~238 e ~85); `page.int`, título da célula de cena `?? PER_RESPONSE_LABEL` (achado 11);
  `agreement.int`, `seedRound` repassa `perResponseCriteria`. Nenhuma asserção mudou.
- **Vermelhos**: colunas, linhas e "nota sem definição num geral" por asserção; os 5 de
  `agreement.int` por contagem (5 em vez de 6; o do ICR por `units: 10`); os 2 de página por "Por
  resposta" ausente das linhas; o de rótulos, de import. "Não aplicável", coeficiente e Qualidade
  quebravam ao procurar a linha/coluna: provados por mutação depois do verde.
- **Mutações** (desfeitas por `cp`): coluna por resposta sem a chave `null` derruba colunas,
  coeficiente, "nota sem definição" e Qualidade; o geral também na linha nula derruba "não aplicável"
  e "nota sem definição"; o parágrafo sempre presente (em cada tabela) derruba a guarda; os dois
  `title` trocados derrubam os 2 de página. **O marcador do `cellKey` da matriz trocado por `'null'`
  não derruba nada**: a chave é interna e montada pela mesma função dos dois lados, então o marcador
  não é observável ali (só importa contra colisão com um id de definição, que é UUID).
- **Divergência**: o `agreement-labels.unit` não afirma que os dois `title` aparecem no parágrafo,
  porque o texto aprovado do parágrafo (D2) descreve os motivos com outras palavras; afirma que os
  `title` diferem entre si e do de hoje, e que o parágrafo cita "Por resposta", o traço, "critérios
  de definição" e "critério por resposta".
- **Conferência no navegador** com a cena do § 8 (receita sem mudança; o seed usou `resolveCells`
  para montar as 6 células): as duas matrizes com seis linhas e "Por resposta" por último, selo na
  coluna `Diversity`, os `title` certos em cada traço, o parágrafo no "Como ler" das duas; o
  coeficiente da rodada com 24 unidades (20 + 4) e a Qualidade com 48 notas (40 + 8); a 375 px
  (`iframe`) as tabelas (402 px) rolam dentro do quadro de 312 px e nada fora delas passa da
  largura. Cena apagada, `scores` vazia.
- R22/D7: sem código próprio; o teste de `loadProjectObservations` é a prova.

---

## 6. Parte 2 — Consenso no servidor

**Ler antes:** `consensus-actions.ts` inteiro, `consensus.ts`, `consensus-cells.ts`;
`consensus-actions.int` até o primeiro `it` e os casos ~314–456; `consensus.int` até o primeiro
`it` e "a ata é visível a quem não a escreveu" (~220); `consensus-cells.unit`.

### 6.1 Chave (TDD, unitário) — `consensus-cells.unit.test.ts`

`note()` aceita `definitionId: string | null`.

- [ ] A anotação por resposta fica em `consensusCellKey(null, 'c1')`, que é `per_response:c1`, e não
      se mistura com a de `d1:c1` do mesmo critério.

Vermelho esperado: a chave sai `null:c1` (asserção).

### 6.2 Leitura (TDD, integração) — `consensus.int.test.ts`

- [ ] `loadResponseConsensus` devolve a ata da célula por resposta (gravada por `addConsensusNote`
      com `definitionId: null`), com `definitionId: null`; `loadRoundConsensus` também.

Vermelho esperado: o descarte do Plano 1 → lista vazia.

### 6.3 Action (TDD, integração) — `consensus-actions.int.test.ts`

`scenario` aceita `perResponseCriteria` (critério por resposta `Diversity` ao lado de
`DUAS_CELULAS`, e um geral para as recusas); `saveForm` manda `cell.definitionId ?? ''`. Um `it`
por caso:

- [ ] **O Administrador grava ata na célula por resposta**: uma linha, `definitionId: null`,
      visibilidade compartilhada.
- [ ] **O Avaliador grava rascunho na célula por resposta**, com o próprio vínculo.
- [ ] **Salvar duas vezes edita no lugar**: uma linha só, texto novo (o upsert com `NULLS NOT
      DISTINCT`, spec item 9).
- [ ] **Texto vazio apaga a anotação por resposta** (achado 2).
- [ ] **Recusas** (`cell_missing`, nada gravado): `definition_id` vazio com critério geral; vazio
      com critério específico.
- [ ] **`definition_id` que não é UUID nem vazio** → "Anotação inválida".

Vermelho esperado: os quatro primeiros recebem "Anotação inválida" (`isUuid('')`), vermelho de
asserção. **O do apagar fica vermelho de novo depois do parse**: a action responde "removida" e a
linha continua (`eq` com `null`). É esse vermelho que prova o `isNull`; ler a mensagem e dizer no
resumo. As recusas também passam por "inválida" antes do parse: ler que a mensagem muda para a de
`cell_missing` depois dele. O último é guarda de regressão, verde desde o começo.

### 6.4 Código

- `consensus-cells.ts`: `consensusCellKey(definitionId: string | null, …)` com o marcador (D4).
- `consensus.ts`: `ConsensusNote.definitionId: string | null`; remover o descarte do Plano 1.
- `consensus-actions.ts`: D6 (parse, `cellExists`, delete). `type Cell` com `definitionId:
  string | null`.

`review-groups-list.tsx` continua passando `string` (o grupo por resposta ainda não existe): compila
sem mudança.

### 6.5 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -n "definitionId === null" "app/projects/[id]/(tabs)/rounds/consensus.ts"` não acha
  descarte.
- Testes antigos editados: `saveForm` e o `note()` de `consensus-cells.unit`, sem asserção mudada.
- Sem navegador: nenhuma tela mudou.

### 6.6 O que a Parte 3 herda

Feita em 2026-10-14, sem commit no momento da escrita.

- **Campo vazio**: `definition_id` vazio é a célula por resposta (`null`); qualquer outro valor tem
  que ser UUID, senão "Anotação inválida". O `ConsensusForm` da Parte 3 manda `definitionId ?? ''`.
- **`cellExists`**: a checagem da definição saiu para `definitionExists`, chamada só quando há
  definição; sem definição, o critério tem que ser da versão e `isPerResponse`. Com definição, como
  deixou o Plano 1.
- **Delete**: `isNull` quando a definição é nula. O upsert não mudou.
- **Leitura**: `ConsensusNote.definitionId: string | null`; `asNotes` sem o descarte (só filtra a
  visibilidade). `consensusCellKey(null, c)` é `per_response:c`; o formato `:` das chaves antigas
  não mudou.
- **O descarte que sobrou**: `review.ts` ~76, escrito `definitionId !== null && isScaleValue(...)`.
  O `grep "definitionId === null"` do § 7.7 não o acharia; a Parte 3 confere pelo `!== null`.
  Depois desta Parte, `consensus-actions.ts` tem dois `definitionId === null` que são regra (a
  escolha do `cellExists` e a do delete), não descarte.
- **Testes novos**: `consensus-cells.unit` (1), `consensus.int` (1: as duas leituras),
  `consensus-actions.int` › "a célula por resposta" (6).
- **Testes antigos editados**: `note()` de `consensus-cells.unit` aceita `null`; `scenario` de
  `consensus.int` aceita `perResponseCriteria`; `scenario` de `consensus-actions.int` aceita
  `generalCriteria`/`perResponseCriteria` e devolve o `codebook`. Nenhuma asserção mudou. O
  `saveForm` já mandava `cell.definitionId ?? ''` desde o Plano 1.
- **Vermelhos**: a chave por `null:c1`; a leitura por lista vazia; os quatro primeiros da action por
  "Anotação inválida" (`isUuid('')`, lido na mensagem). Depois do parse, **o do apagar ficou
  vermelho de novo**: a action respondeu "removida" e a linha continuou (`eq` com `null`); verde só
  com o `isNull`. A recusa passou de "inválida" para `cell_missing` depois do parse.
- **Mutações** (desfeitas por `cp`): `cellExists` sem definição devolvendo `true` derruba a recusa;
  sem a guarda do UUID na definição, o "não é UUID nem vazio" cai com erro do Postgres.
- `review-groups-list.tsx` compilou sem mudança (passa `string`).
- **Armadilha para § 7.2**: `[roundId]/page.int` ~210 ainda faz `consensusCellKey(cell.definitionId
  ?? '', …)`, herança do Plano 2. Com a chave aceitando `null`, o `?? ''` monta `:c` em vez de
  `per_response:c`, e o rascunho por resposta não seria achado. Trocar por `cell.definitionId`. Os
  dois `form.set('definition_id', cell.definitionId ?? '')` (`consensus-actions.int`,
  `phase-4-round.int`) ficam: vazio é o formato do campo.

---

## 7. Parte 3 — Revisão de discordâncias

**Ler antes:** `review-groups.ts`, `review.ts`, `review-groups-list.tsx`, `consensus-form.tsx`,
`divergence.ts`, `[roundId]/page.tsx` (~176–196); `review-groups.unit` até o primeiro `it`;
`divergence.unit`; em `[roundId]/page.int`, as funções de cena (~264–460) e os casos "mostra todas
as células…" (~460), "distingue divergência adjacente de extrema…" (~499), "a ata aparece…"
(~1412), "o formulário da ata só existe para o Administrador" (~1441) e "o próprio autor vê o seu
rascunho…" (~1628).

### 7.1 Grupos e textos (TDD, unitário) — `review-groups.unit.test.ts` e `divergence.unit.test.ts`

`note()` aceita `definitionId: string | null`; fábrica `perResponse`. Um `it` por caso:

- [ ] **O grupo por resposta vem por último**, com `definition: null` e uma célula por critério por
      resposta, `isGeneral: false`.
- [ ] **A divergência é calculada igual** (R20): adjacente, extrema e `single` na célula por
      resposta; o `divergent` do grupo, `divergentCells` e `ratedCells` contam a célula.
- [ ] **Não vaza**: a nota por resposta não aparece em grupo de definição, e a nota sem definição
      num critério geral é ignorada (no molde de "nota de uma célula que não existe…", ~125).
- [ ] Em `divergence.unit`: o sentido da extrema na célula por resposta (D2) cita o critério e não
      fala de definição; os outros quatro estados são iguais aos de hoje.

Vermelho esperado: o grupo não existe (asserção pelo número de grupos); os casos de divergência
quebram antes, ao procurar o grupo: provar por mutação depois do verde. O de `divergence.unit`
falha por igualdade se a função receber o parâmetro novo e ignorá-lo; se o parâmetro não existir,
é vermelho de tipo, que não conta: criar a assinatura antes de rodar.

### 7.2 Tela (TDD, integração) — `[roundId]/page.int.test.ts`

**Antes do código de § 7.3.** Título da célula de cena com `?? PER_RESPONSE_LABEL` (achado 11);
`cellNotesOf` e o `find` de ~524 com `?.` (achado 10). Cena: o PoC numa rodada fechada, dois
avaliadores, com divergência extrema no `Diversity` da primeira resposta. Um `it` por caso:

- [ ] **O grupo "Por resposta" vem depois da Query 5**, com o nome do critério, a nota e a
      justificativa de cada avaliador e o selo "Divergência extrema"; o topo diz `1 de 6 células
      diverge`.
- [ ] **O sentido da extrema** no `title` do selo é o da célula por resposta (D2), e o parágrafo
      novo está no "Como ler as divergências"; numa cena sem critério por resposta, nenhum dos
      dois.
- [ ] **O Avaliador da rodada também vê o grupo**, sem coeficiente.
- [ ] **A ata da célula por resposta aparece** (gravada por `addConsensusNote` com definição nula),
      com o autor; e o formulário do Administrador nesse grupo é um `ConsensusForm` com
      `definitionId: null`, cujo markup tem `name="definition_id" value=""`.
- [ ] **O rascunho por resposta do próprio Avaliador** volta preenchido (`mineOf` com
      `consensusCellKey(null, …)`).

Vermelho esperado: o grupo não existe; o descarte de `review.ts` some com as notas (asserção). Os
casos de consenso dependem do grupo: contar as asserções que rodaram.

### 7.3 Código

- `review-groups.ts`: D5 e D4.
- `review.ts`: remover o descarte do Plano 1; o tipo vem de `CellNote`.
- `divergence.ts`: o sentido da extrema por resposta (D2), por parâmetro de `divergenceMeaning` ou
  função irmã (decidir lendo); o parágrafo novo.
- `review-groups-list.tsx`: `Group` com o título por `PER_RESPONSE_LABEL` e sem selo de tipo;
  `Cell` e `ConsensusCell` com `definitionId: string | null` e o sentido certo da divergência; o
  parágrafo condicional (`groups.some((group) => group.definition === null)`).
- `consensus-form.tsx`: D6 (o campo oculto).
- `[roundId]/page.tsx`: nada (achado 13).

### 7.4 Testes antigos (só o tipo)

`review-groups.unit` ~56 (`group.definition?.id`) e os de § 7.2. Nenhuma asserção muda.

### 7.5 Docs

`docs/CONTEXT.md`, verbete **Divergência** (tracked, entra no commit). Depois de "costuma indicar
definição ambígua: duas pessoas leram coisas opostas no mesmo texto, com o mesmo codebook.",
acrescentar: "Na célula de um critério por resposta não há definição, e a divergência extrema
costuma apontar para o próprio critério."

*Revisão de discordâncias* e *Anotação de consenso* continuam verdadeiros ("todas as células",
"por célula de uma resposta").

### 7.6 Conferência no navegador

Cena do § 8, logado como o Administrador. Na revisão da rodada:

- o grupo "Por resposta" depois da Query 5, aberto na primeira resposta (tem divergência), com as
  notas, o selo e o `title` da extrema por resposta;
- registrar a ata na célula por resposta, editar, e apagar com o campo vazio: depois de apagar, a
  ata some da tela **e** do banco (`select count(*) from consensus_notes where definition_id is
  null`);
- a 375 px, o grupo não estoura a largura.

Apagar a cena antes do `npm test`.

### 7.7 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -rn "definitionId === null" "app/projects/[id]/(tabs)/rounds/" --include='*.ts' | grep -v test`
  não acha descarte de leitor (sobra só o que for regra, como a escolha do delete em D6).
- Conferência do § 7.6 feita, cena apagada.

### 7.8 Fecho

A Parte 3 fecha o Plano 3, não a série: sem `Closes`.

### 7.9 O que o Plano 4 herda

Parte 3 feita em 2026-10-14, sem commit no momento da escrita.

- Nenhum descarte de leitor sobrou na série; toda leitura da rodada trata a célula por resposta.
  O `grep` do § 7.7 (com `!== null` também) só acha regra: o sentido da divergência em
  `review-groups-list.tsx` e as escolhas de `consensus-actions.ts`.
- **Nomes finais**: `divergenceMeaning(kind, isPerResponse = false)` (parâmetro, não função irmã;
  só a extrema muda) e `DIVERGENCE_PER_RESPONSE_LEGEND` em `divergence.ts`. `reviewGroups` monta os
  grupos por uma função interna `group(definition | null, criteria)`; o grupo nulo só existe com
  critério por resposta. `ConsensusForm.definitionId: string | null`, campo oculto `?? ''`.
- **Testes novos**: `review-groups.unit` › "o grupo por resposta" (6), `divergence.unit` (3),
  `[roundId]/page.int` › "o grupo por resposta" (6).
- **Testes antigos editados** (só tipo): `review-groups.unit` (`note()` aceita `null`, `cellOf`
  aceita grupo ausente, `group.definition?.id`); `divergence.unit` ~95, `STATES.map(divergenceMeaning)`
  virou `map((state) => divergenceMeaning(state))` (o índice do `map` caía no parâmetro novo);
  `[roundId]/page.int`: título de cena `?? PER_RESPONSE_LABEL`, `cellNotesOf` e o `kindOf` de ~524
  com `?.`, `mineOf` com `consensusCellKey(cell.definitionId, …)`. Nenhuma asserção mudou.
- **Vermelhos**: o grupo por último pela contagem de grupos; a extrema por resposta por igualdade
  (a função ignorava o parâmetro); a legenda nova, de import; os 6 de página pela ausência de "Por
  resposta" (o da guarda, porque o texto novo ainda não existia). Divergência, adjacente e "não
  vaza" quebravam ao procurar o grupo; "nota sem definição num geral" verde desde o começo.
- **Mutações** (desfeitas por `cp`): `cellKey` ignorando a definição derruba "não vaza", "nota sem
  definição num geral" e dois antigos; o grupo nulo lendo outra chave derruba divergência,
  adjacente e "não vaza"; o parágrafo sempre presente derruba a guarda; o sentido sempre o de
  definição derruba o do `title`; o campo oculto com outro valor derruba o da ata.
- **Conferência no navegador** com a cena do § 8 (receita sem mudança): grupo "Por resposta" depois
  da Query 5, aberto, sem selo de tipo, "1 de 1 célula diverge", `title` da extrema por resposta,
  o parágrafo novo no "Como ler", topo "1 de 6 células diverge"; ata registrada, editada no lugar
  (uma linha) e apagada com o campo vazio (`count(*) … definition_id is null` = 0); a 375 px
  (`iframe`) nada do grupo passa de 375. Cena apagada, `scores` vazia.
- **→ Plano 4, textos que aparecem em todo projeto**: `QUALITY_POINTS` ("Cada nota é uma célula
  (definição × critério)", achado 5), além do `NOTES_PER_RESPONSE_HELP` que o Plano 2 deixou.
- A receita da cena do § 8, para a conferência do editor.
- "Não salvar o codebook da cena" deixa de valer só depois da Parte 1 do Plano 4.

---

## 8. Cena de conferência (Partes 1 e 3)

Por Vitest descartável (memória `vitest-como-runner-de-seed`), com a suíte parada e o banco sem
projetos antes de semear:

- o usuário do `/dev/login` como Administrador; projeto na Fase 3;
- codebook do PoC pelo `perResponseCriteria` do helper: `Query 1`…`Query 5` sem critério próprio,
  `Relevance` geral, `Diversity` por resposta, com descrição;
- rodada **fechada** da Fase 3 com quatro respostas (criadas em statements separados, pela ordem dos
  rótulos);
- dois avaliadores de teste (`Ana`, `Bruno`) com avaliação completa nas quatro respostas:
  `Relevance` quase sempre igual entre os dois, `Diversity` com uma extrema (Alto × Baixo) na
  primeira resposta, uma adjacente na segunda e acordo nas outras, para o coeficiente da célula por
  resposta sair calculável.

**Não salvar o codebook.** Depois: apagar na ordem da memória `cena-no-banco-quebra-int-test`
(`scores` → `consensus_notes` → `round_outliers` → `evaluations` → `responses` → `rounds` →
`projects` → `profiles` → `auth.users` de teste), apagar o arquivo de seed, conferir `scores` vazia
e só então rodar `npm test`.

---

## 9. Fora deste plano

- Editor, `parseCriteria`, leitura do codebook, entrada da LLM, `NOTES_PER_RESPONSE_HELP` e
  `QUALITY_POINTS` (Plano 4).
- Juntar as funções de chave de célula de `agreement-matrix.ts`, `review-groups.ts` e
  `consensus-cells.ts` (D4).
- Mudar o cabeçalho "Definição" das matrizes.
- A exportação CSV (spec 6.5).
