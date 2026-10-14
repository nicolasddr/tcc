# Plano 2 — Avaliação: a célula por resposta

Série "Critério por Resposta", plano 2 de 4. Spec: `~/Desktop/spec-criterio-por-resposta-v2.md`
(fora do repo; seções 1 a 5 e 10 são o contexto comum, a 6.2 é a origem deste plano). Escrito em
2026-10-13 contra o `main` em `907184d`, **antes** de o Plano 1 ser implementado: os nomes que vêm
dele (`Scope`, `isPerResponse`, `perResponseCriteria`, a opção `perResponseCriteria` das fixtures,
`CellFixture.definitionId: string | null`) são os do D4 e do § 5.2 do Plano 1. **Antes da Parte 1,
ler o § 6.6 do Plano 1** ("O que o Plano 2 herda") e corrigir aqui o que tiver mudado.

**Objetivo:** o Avaliador dá nota ao critério por resposta, e o servidor grava e exige essa nota.
Nenhuma tela cria critério por resposta ainda (Plano 4); a conferência no navegador usa uma cena
montada à mão.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Domínio: a célula por resposta em `resolveCells`, a conta de notas (R3), a completude e a mensagem; descartes provisórios no envio e no formulário | `feat(avaliação): célula por resposta no domínio` | |
| 2 | Envio e leitura: `submitEvaluation` grava e exige a nota por resposta, `loadEvaluationOf` a devolve; verbete *Nota* | `feat(avaliação): nota por resposta no envio` | |
| 3 | Formulário: grupo "Por resposta" na avaliação em curso e na enviada; conferência no navegador | `feat(avaliação): grupo por resposta no formulário` | |

**Duas decisões ⚠** (D1 e D2), as duas antes da Parte 1. Perguntar as duas de uma vez antes de
editar código, mesmo que o pedido seja só "implemente a Parte 1".

Sem issue no GitHub: os commits não levam `Refs`/`Closes`.

---

## 1. Ponto de partida

Caminhos curtos são relativos a `app/projects/[id]/`.

| Peça | Onde | Nesta série |
|---|---|---|
| Células | `pipeline/criteria.ts`: `CodebookCell<D, C> = { definition: D; criterion: C; isGeneral }`, `resolveCells` (só definição × critério), `notesPerResponse` (= `resolveCells(...).length`), `notesPerResponseFormula`, `NOTES_PER_RESPONSE_HELP` | Parte 1 |
| Completude | `(tabs)/evaluate/completeness.ts`: `CellKey`/`Answer` com `definitionId: string`, `cellKey` = `${def}_${crit}`, `keyOfCell` (privado), `definitionsIncomplete`, `isComplete`, `incompleteMessage(titles)` | Parte 1 |
| Envio | `(tabs)/evaluate/actions.ts`: `submitEvaluation` (~115 percorre `resolveCells`, lê `score_${key}`/`justification_${key}`, `definitionsIncomplete`, insert em `scores`) | Parte 1 descarta; Parte 2 trata |
| Leitura | `(tabs)/evaluate/evaluation.ts`: `EvaluationScore.definitionId: string`, `loadEvaluationOf` (com o descarte do Plano 1, D3) | Parte 2 |
| Formulário | `(tabs)/evaluate/evaluation-form.tsx`: `keyOf`, `groupByDefinition`, `storedValues`/`storedJustifications` por `cellKey(score)`, modo leitura e modo em curso, um `Card` por definição | Parte 1 descarta; Parte 3 trata |
| Página | `(tabs)/evaluate/page.tsx`: passa `resolveCells(...)` ao formulário; `help` da `Section` (~153) | não muda (D6) |
| Testes | `pipeline/criteria.unit.test.ts`, `evaluate/completeness.unit.test.ts`, `evaluate/actions.int.test.ts`, `evaluate/page.int.test.ts` | as três Partes |

---

## 2. O que a revisão da spec achou

Achados desta revisão contra o código, além dos da seção 4 da spec. Os que mudam outro plano estão
marcados **→ Plano N** e repetidos nos handoffs (§ 5.7, § 7.6) e na spec (seção 4, itens 21 a 29).

1. **O Plano 1 ainda não foi implementado.** Este plano usa os nomes que ele propõe; ver o aviso do
   topo.
2. **Dezenove arquivos de teste leem `cell.definition.*` de `resolveCells`.** Com
   `definition: D | null` (D1), o `typecheck` aponta todos. A maioria monta fixture de avaliação:
   `resolveCells(...).map((cell) => ({ definitionId: cell.definition.id, ... }))`. Lista em § 5.5.
   Edição mecânica, sem asserção mudada.
3. **`evaluate/actions.int.test.ts` monta a chave do formulário à mão**: `form()` (~146) faz
   `` `${cell.definitionId}_${cell.criterionId}` ``. Com definição nula isso dá `null_<id>`, e não a
   chave que o servidor lê. A Parte 2 troca por `cellKey`; o mesmo vale para o `justification_` do
   teste "a justificativa vazia grava null" (~394).
4. **O Plano 1 deixa um teste que este plano inverte**: § 6.1 do Plano 1, "`resolveCells` não gera
   célula para ele (até o Plano 2)". É o primeiro vermelho da Parte 1.
5. **A ajuda da página de avaliação está no limite**: o teste "o cabeçalho diz em nome de quem a
   avaliação está sendo feita" (`evaluate/page.int.test.ts` ~780) exige até 25 palavras, e a frase
   já tem 24 com um nome de duas palavras. Não cabe mencionar o critério por resposta (D6).
6. **`NOTES_PER_RESPONSE_HELP` aparece no codebook de todo projeto** (`criteria-summary.tsx`). Trocar
   o texto aqui anunciaria, por dois planos, um critério que ninguém consegue criar. Hoje a frase
   ("e não uma nota por resposta") só fica errada quando existe critério por resposta, e isso só
   acontece pela ferramenta a partir do Plano 4. Decisão D2. **→ Plano 4.**
7. **Sem descarte, a Parte 1 mudaria o envio em silêncio.** `submitEvaluation` percorre
   `resolveCells`: assim que a célula por resposta existe, o servidor lê o campo dela e manda a nota
   ao insert, com valor vazio quando falta (o CHECK da escala lança 23514, e o Avaliador vê erro 500
   em vez da mensagem). O formulário não compila sem tratar o grupo de definição nula. Por isso a
   Parte 1 descarta a célula por resposta nos dois consumidores (D5), e cada Parte seguinte remove o
   descarte do seu com o teste vermelho.
8. **Entre a Parte 2 e a Parte 3, o servidor exige uma nota que o formulário ainda não mostra.** Só
   acontece com critério por resposta montado à mão; nenhum projeto real chega lá até o Plano 4.
9. **R11, "campo de célula inexistente não vira nota", continua estrutural**: o servidor percorre as
   células resolvidas e só lê os campos delas. Com a FK composta do Plano 1 (D2 (a′)), um campo
   estranho que chegasse ao insert daria 23503 e erro 500, e não uma recusa amigável; o teste da
   Parte 2 afirma o envio aceito e as notas exatas.
10. **A ordem da leitura bate com a das células**: `loadEvaluationOf` ordena por
    `asc(scores.definitionId)`, e no Postgres `ASC` põe o nulo por último, como `resolveCells` (D3).
    O formulário não depende da ordem (indexa por `cellKey`), então nada a fazer.

---

## 3. Decisões

**D1 ⚠. Como a célula por resposta entra no domínio.** Duas opções:

- **(a) recomendada, `resolveCells` gera todas as células**: `CodebookCell.definition` passa a
  `D | null`, e `resolveCells` acrescenta, depois das células das definições, uma célula por
  critério por resposta, com `definition: null` e `isGeneral: false`. É o que R9 pede, e o `tsc`
  aponta todo consumidor que lê a definição (o mesmo argumento do D4 do Plano 1). Custo: os
  dezenove testes do achado 2, edição mecânica.
- **(b) função separada**: `resolveCells` continua só com as definições, e uma função nova
  (`evaluationCells`) junta as duas listas. Nenhum teste antigo muda, mas quem usar `resolveCells`
  onde precisava da lista inteira esquece a célula por resposta em silêncio: é o risco que o item 1
  da seção 4 da spec descreve, num lugar novo.

Recomendação: **(a)**.

**D2 ⚠. Textos** (spec 7.1, a parte do Plano 2):

- **Grupo do formulário:** "Por resposta", como no exemplo da seção 9 da spec, sem descrição de
  grupo (a descrição do critério já aparece abaixo do nome). A constante fica em
  `pipeline/criteria.ts` como `PER_RESPONSE_LABEL`, para o Plano 3 reusar na linha das matrizes e no
  grupo da revisão.
- **Mensagem de avaliação incompleta** (`incompleteMessage`): a forma de hoje não muda quando só
  faltam definições. Formas novas:
  - só critério por resposta, um: `O critério por resposta “Diversity” ainda está sem nota. Dê uma
    nota nele para enviar a avaliação.`
  - só critério por resposta, vários: `Os critérios por resposta “Diversity” e “Cobertura” ainda
    estão sem nota. Dê uma nota em cada um para enviar a avaliação.`
  - os dois: `A definição “Query 1” ainda tem critério sem nota, e o critério por resposta
    “Diversity” também. Dê uma nota em cada critério para enviar a avaliação.` (no plural: `As
    definições … ainda têm critério sem nota, e os critérios por resposta … também.`)
- **`NOTES_PER_RESPONSE_HELP`**: recomendação, **deixar para o Plano 4** (achado 6), na Parte 2 dele,
  junto com o `criteria-summary.tsx`, que é onde o ⓘ aparece. Texto proposto para lá, 24 palavras
  (o teste exige até 25): `Cada critério geral vira uma nota em cada definição; cada critério por
  resposta, uma nota só. É o esforço do avaliador a cada resposta.` Se o usuário preferir agora, a
  Parte 1 troca o texto e edita o teste `o ⓘ do card fica em até 25 palavras…`
  (`criteria.unit.test.ts` ~198), que afirma `'e não uma nota por resposta'`.

**D3. A chave da célula por resposta.** `cellKey({ definitionId: null, criterionId })` devolve
`per_response_<criterionId>`; o marcador é a constante `PER_RESPONSE_KEY = 'per_response'` em
`completeness.ts`. Não colide com chave de definição, porque `definitionId` é sempre UUID. Os campos
do formulário ficam `score_per_response_<id>` e `justification_per_response_<id>`. Ninguém
decodifica a chave de volta (conferido: não há parser), então basta ela ser única.

**D4. A célula por resposta não depende de definição.** `resolveCells([], [porResposta])` devolve uma
célula, e `notesPerResponse` conta 1. Nenhum Avaliador chega a isso: rodada só abre com codebook
completo, e R4 exige definição coberta. O teste antigo "sem definição ou sem critério, não há nota
nenhuma" (com critério geral) continua valendo.

**D5. Descartes provisórios** (achado 7), no idioma do D3 do Plano 1. Guarda de tipo em
`pipeline/criteria.ts`:

```ts
export type DefinitionCell<D, C> = CodebookCell<D, C> & { definition: D }

export function isDefinitionCell<D, C>(cell: CodebookCell<D, C>): cell is DefinitionCell<D, C>
```

Na Parte 1, `submitEvaluation` e `EvaluationForm` filtram `resolveCells(...)` por ela, e o resto dos
dois arquivos continua igual. A Parte 2 remove o filtro do envio; a Parte 3, o do formulário. Se a
guarda ficar sem uso no fim da Parte 3 (`grep -rn isDefinitionCell app`), sai também.

**D6. A ajuda da página de avaliação não muda** (achado 5). "Cada critério de cada definição do
codebook desta rodada recebe nota" continua verdadeira, e o formulário já diz "Dê uma nota em cada
critério".

**D7. Nomes novos em `completeness.ts`:**

```ts
export const PER_RESPONSE_KEY = 'per_response'

export type CellKey = { definitionId: string | null; criterionId: string }

export type Cell<D, C extends { id: string } = { id: string }> = {
  definition: D | null
  criterion: C
}

export function cellKeyOf(cell: Cell<{ id: string }>): string
export function perResponseIncomplete<C extends { id: string; name: string }>(
  cells: readonly Cell<unknown, C>[],
  answers: readonly Answer[],
): C[]
export function incompleteMessage(
  titles: readonly string[],
  criteria: readonly string[] = [],
): string
```

`Answer.definitionId` passa a `string | null`. `cellKeyOf` é o `keyOfCell` de hoje, exportado: o
`keyOf` do formulário e o `cellKey({ definitionId: cell.definition.id, ... })` do envio passam a
chamá-lo, e o tratamento do nulo fica num lugar só. `definitionsIncomplete` pula a célula sem
definição. No envio, o desfecho `incomplete` ganha `criteria: string[]`.

---

## 4. Gotchas

- **Docker Desktop antes de tudo.**
- **`scores` inteira vazia antes do `npm test`** (`evaluate/actions.int.test.ts` afirma isso). Na
  Parte 3, limpar a cena do navegador antes da suíte (§ 7.3).
- **Não salvar o codebook da cena**: até o Plano 4, salvar descarta o critério por resposta montado
  à mão (achado 8 do Plano 1).
- **TDD**: ler a **mensagem** de cada vermelho e contar quais asserções rodaram; asserções depois da
  primeira falha não rodaram (`it` separados, ou mutação depois do verde). O vermelho de tipo não
  conta: o Vitest não confere tipos, então os testes rodam mesmo com o `tsc` quebrado.
- **`npm run typecheck` depois da última edição de teste.**
- **Antes de prever testes antigos editados**, buscar a frase que sai: `ainda tem critério sem nota`,
  `ainda têm critério`, `Dê uma nota em cada critério` (achado 5 e
  `evaluate/page.int.test.ts` ~473), `de .* notas`.
- **Sem comentários novos no código; sem `npx prettier`.**
- **Desfazer mutação por `cp`/`sed` inverso, nunca `git checkout`.**

---

## 5. Parte 1 — Domínio

**Antes de começar:** ler o § 6.6 do Plano 1 e perguntar D1 e D2. Este texto assume D1 = (a) e o
ⓘ do card no Plano 4.

**Ler antes:** `pipeline/criteria.ts` e `criteria.unit.test.ts` (já com o tipo, desde o Plano 1),
`evaluate/completeness.ts` e `completeness.unit.test.ts`, `evaluate/actions.ts` (~110–145),
`evaluate/evaluation-form.tsx` (`keyOf`, `groupByDefinition`, o começo de `EvaluationForm`).

### 5.1 Células e conta (TDD, unitário) — `pipeline/criteria.unit.test.ts`

Fábrica do critério por resposta com o tipo explícito (o Plano 1 já a criou para o `describe` "o
critério por resposta"). Casos, cada um num `it`:

- [ ] **Inverter o teste do Plano 1** (achado 4): `resolveCells` gera **uma** célula para o critério
      por resposta, com `definition: null` e `isGeneral: false`.
- [ ] **Ordem e PoC**: cinco definições, um geral, um por resposta → seis células; as cinco primeiras
      são as definições com o geral, a última é a por resposta.
- [ ] **D4**: sem definição, o critério por resposta ainda gera a célula dele.
- [ ] **`notesPerResponse` (R3)**: o PoC dá 6; `notesPerResponse([], [porResposta])` dá 1.
- [ ] **`notesPerResponseFormula` (R3)**, igualdade exata:
  - PoC: `5 definições × 1 critério geral + 1 por resposta`;
  - com específico: `2 definições × 1 critério geral + 1 específico + 2 por resposta`;
  - sem geral: `1 critério específico + 1 por resposta`;
  - só por resposta: `1 critério por resposta` e `2 critérios por resposta`.
  O caso do D5 do Plano 1 ("não diz específico") vira a igualdade exata do PoC.
- [ ] `isDefinitionCell` separa as duas.

Vermelho esperado: a célula por resposta não existe (os de `resolveCells` e `notesPerResponse` dão
contagem errada) e a fórmula omite o termo. O de `isDefinitionCell` é vermelho de import: provar por
mutação depois do verde. Os casos antigos verdes provam que as células das definições não mudaram.

### 5.2 Completude (TDD, unitário) — `evaluate/completeness.unit.test.ts`

**Depois** do verde de § 5.1 (o código de `criteria.ts` de § 5.3 vem antes deste passo, para as
células de teste já trazerem a célula por resposta). `describe` novo, com o seu próprio `criteria`
(as duas definições do arquivo, `Aderência` geral e `Diversity` por resposta): **não** acrescentar
o `Diversity` ao `criteria` compartilhado, senão os casos antigos quebram junto e deixam de provar
que nada mais mudou. Casos:

- [ ] `cellKey({ definitionId: null, criterionId: 'p1' })` é `per_response_p1`, e não `null_p1`.
- [ ] Sem a nota por resposta: `isComplete` falso, `definitionsIncomplete` vazio,
      `perResponseIncomplete` devolve `[Diversity]`.
- [ ] Com todas as notas: completo, e as duas listas vazias.
- [ ] Nota fora da escala na célula por resposta não conta.
- [ ] `incompleteMessage`: as três formas do D2, singular e plural; as duas formas antigas, iguais.

Vermelho esperado: a chave sai `null_p1` e as mensagens novas falham por igualdade (vermelhos de
asserção). Os casos de `isComplete`/`definitionsIncomplete` com a célula por resposta **quebram**
antes da asserção (`keyOfCell` lê `cell.definition.id` de `null`: *Cannot read properties of
null*), e `perResponseIncomplete` é vermelho de import: nenhum desses prova a regra. Provar por
mutação depois do verde, uma linha por vez (tirar o `continue` da célula sem definição em
`definitionsIncomplete`; devolver `[]` em `perResponseIncomplete`), e dizer isso no resumo.

### 5.3 Código

Ordem: `criteria.ts` logo depois do vermelho de § 5.1; `completeness.ts` depois do vermelho de
§ 5.2.

- `pipeline/criteria.ts`: `CodebookCell.definition: D | null`; `resolveCells` acrescenta
  `perResponseCriteria(criteria)` depois das definições; `DefinitionCell`/`isDefinitionCell` (D5);
  `PER_RESPONSE_LABEL` (D2); `notesPerResponseFormula` com o termo `+ N por resposta` (e
  `N critério(s) por resposta` quando não há geral nem específico).
- `evaluate/completeness.ts`: D3 e D7.

### 5.4 Descartes (D5)

- `evaluate/actions.ts`: `const cells = resolveCells(...).filter(isDefinitionCell)`. Nada mais muda.
- `evaluate/evaluation-form.tsx`: o mesmo filtro no começo de `EvaluationForm`, e o tipo local
  `Cell` passa a `DefinitionCell<CodebookDefinition, CodebookCriterion>` (a prop `cells` continua
  `CodebookCell`); `keyOf` passa a `cellKeyOf`. `storedValues`/`storedJustifications` já aceitam a
  definição nula pelo tipo de `CellKey`.

### 5.5 Testes antigos (só o tipo)

O `tsc` aponta. Nos ids, `cell.definition?.id ?? null` (o `CellFixture` aceita nulo desde o Plano
1); onde um tipo local exige `string` (`type Cell` de `evaluate/actions.int.test.ts`, `Cell` de
`rounds/agreement.int.test.ts`), alargar o tipo. Nos títulos (`rounds/page.int.test.ts`,
`rounds/[roundId]/page.int.test.ts`), `cell.definition?.title ?? ''`, ou o que o tipo local pedir: o
rótulo da linha é do Plano 3. Os conhecidos, pelo `grep` de `.definition.` depois de `resolveCells`:

- `pipeline/`: `criteria.unit`, `actions.int`, `advance-phase-2.int`, `advance-phase-3.int`,
  `return-phase-3.int`;
- `(tabs)/`: `page.int`, `phase-4-return.int`;
- `(tabs)/evaluate/`: `actions.int`, `completeness.unit`, `page.int`;
- `(tabs)/rounds/`: `actions.int`, `agreement.int`, `agreement-outliers.int`, `consensus.int`,
  `consensus-actions.int`, `page.int`, `phase-4-reading.int`, `phase-4-round.int`,
  `[roundId]/page.int`.

Nenhuma asserção muda: nenhum desses codebooks tem critério por resposta. `agreement-matrix.unit`,
`quality-matrix.unit` e `review-groups.unit` leem `.definition.` de outras estruturas (linhas de
matriz), não de células: não mexer.

### 5.6 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -rn "isDefinitionCell" app` acha só a definição, o envio e o formulário.
- Nenhuma tela mudou: os testes de página verdes bastam, sem navegador.
- Testes antigos editados: os de § 5.5, sem asserção alterada, e o invertido do achado 4 (listar no
  handoff).

### 5.7 O que a Parte 2 herda

Feita em 2026-10-14, sem commit no momento da escrita. `npm run lint`, `npm run typecheck` e
`npm test` (108 arquivos, 1601 testes) verdes.

- **D1 = (a) e D2 = textos do plano, ⓘ do card no Plano 4**, confirmadas pelo usuário antes do
  código.
- **Nomes finais**, como no D5 e no D7: `DefinitionCell`, `isDefinitionCell` e `PER_RESPONSE_LABEL`
  em `pipeline/criteria.ts` (o rótulo ainda sem uso); `PER_RESPONSE_KEY`, `CellKey`, `Cell<D, C>`,
  `cellKeyOf` (o `keyOfCell` privado saiu), `perResponseIncomplete` e
  `incompleteMessage(titles, criteria = [])` em `completeness.ts`. `Answer.definitionId` é
  `string | null`.
- **Descartes**: `evaluate/actions.ts` (~115, `resolveCells(...).filter(isDefinitionCell)`; a chave
  ainda é `cellKey({ definitionId: cell.definition.id, ... })`, a Parte 2 troca por `cellKeyOf`);
  `evaluate/evaluation-form.tsx` (a prop virou `cells: codebookCells`, e
  `const cells = codebookCells.filter(isDefinitionCell)` no começo de `EvaluationForm`; o `keyOf`
  local saiu, os usos chamam `cellKeyOf`).
- **Testes novos**: em `criteria.unit.test.ts`, 8 `it` no `describe` "o critério por resposta"
  (PoC, D4, conta 6 e 1, três de fórmula, `isDefinitionCell`); em `completeness.unit.test.ts`, o
  `describe` "a célula do critério por resposta" (11 `it`).
- **Testes antigos editados**:
  - invertido (achado 4): "ainda não gera célula de definição" virou "gera uma célula só, sem
    definição e fora dos gerais";
  - o do D5 do Plano 1 ("não entra como específico na conta mostrada no card") passou ao PoC de
    cinco definições, com a igualdade `5 definições × 1 critério geral + 1 por resposta`;
  - só tipo, sem asserção mudada: os 19 de § 5.5, mais o `answer()` de `completeness.unit`
    (aceita `null`); `type Cell` alargado em 9 arquivos e `SceneCell` em 2.
- **Vermelhos**: § 5.1, 10 lidos, todos pelo motivo previsto (o de `isDefinitionCell` de import; no
  do PoC, as asserções depois do `toHaveLength` não rodaram). Provados por mutação depois do verde:
  ordem invertida das células (3 vermelhos), a célula por resposta com definição (o PoC cai no
  `toBeNull`), `isDefinitionCell` sempre verdadeiro. § 5.2, 10 lidos: 5 de asserção (chave e
  mensagens), 4 *Cannot read properties of null* e 1 de import, como previsto. Mutações: tirar o
  `continue` da célula sem definição em `definitionsIncomplete` quebra só "nenhuma definição fica
  incompleta", e **por exceção** (*Cannot read properties of null*), não por asserção;
  `perResponseIncomplete` devolvendo `[]` dá 2 vermelhos de asserção; `isComplete` ignorando a
  célula por resposta, 2.
- **Divergências do plano**:
  - Três testes de consenso passam `definitionId` onde a assinatura exige `string`; ficaram com
    `?? ''`: `consensusCellKey(cell.definitionId ?? '', ...)` em `rounds/[roundId]/page.int`, e
    `form.set('definition_id', cell.definitionId ?? '')` em `consensus-actions.int` e
    `phase-4-round.int`. Nenhum desses cenários tem critério por resposta. **→ Plano 3**, quando o
    consenso tratar a célula sem definição.
  - O handoff do Plano 1 (§ 6.6) corrige o § 7.6 deste: `agreement.ts` tem **um** descarte só
    (`toObservation`); corrigido lá embaixo.

---

## 6. Parte 2 — Envio e leitura

**Ler antes:** `evaluate/actions.ts` inteiro, `evaluate/evaluation.ts`, `evaluate/actions.int.test.ts`
até o primeiro `it` e os casos "o envio incompleto é recusado…" (~262) e "os loaders leem…" (~439).

### 6.1 Ajustes no arquivo de teste

Em `evaluate/actions.int.test.ts`, antes dos casos novos:

- `scenario` aceita `perResponseCriteria` e repassa a `addCodebookVersion`;
- `form()` e o teste da justificativa (~394) montam a chave por `cellKey` (achado 3).

Rodar o arquivo inteiro depois disso e antes dos casos novos: tudo verde prova que a troca da chave
não mudou nada.

### 6.2 Casos novos (TDD, integração)

Cenário do PoC: cinco definições `Query 1`…`Query 5` sem critério próprio, `Relevance` geral,
`Diversity` por resposta. Um `it` por caso:

- [ ] **Envio completo grava 6 notas**, e só uma tem `definitionId` nulo, no critério `Diversity`.
- [ ] **Envio sem a nota por resposta é recusado** com a mensagem do D2 (`O critério por resposta
      “Diversity” ainda está sem nota.`), e nada é gravado (nem avaliação, nem nota).
- [ ] **Faltando nas duas**: a mensagem é a combinada.
- [ ] **Campo de célula inexistente não vira nota** (R11): com todas as células preenchidas mais
      `score_per_response_<id do Relevance>` e `score_<id da Query 1>_<id do Diversity>`, o envio é
      aceito e as notas gravadas são exatamente as 6 células.
- [ ] **Justificativa na célula por resposta** grava o texto.
- [ ] **`loadEvaluationOf` devolve a nota por resposta**, com `definitionId: null`.

Vermelho esperado, com o descarte da Parte 1: os envios são aceitos com 5 notas (o primeiro e o
quarto falham pela contagem, o segundo e o terceiro por `ok: true` no lugar do erro); o loader
devolve 5 notas pelo descarte do Plano 1. O quarto caso falha pelo mesmo motivo do primeiro, e não
há mutação barata que o separe: a garantia é estrutural (achado 9), e o caso fica como guarda de
regressão. Dizer isso no resumo e no handoff.

### 6.3 Código

- `evaluate/actions.ts`: remover o filtro da Parte 1; a chave por `cellKeyOf`; `answers` com
  `definitionId: cell.definition?.id ?? null`; o desfecho `incomplete` com `titles` e `criteria`
  (`perResponseIncomplete`); `incompleteMessage(outcome.titles, outcome.criteria)`. O insert não
  muda: o banco calcula a coluna gerada (D2 (a′) do Plano 1).
- `evaluate/evaluation.ts`: remover o descarte do Plano 1; `EvaluationScore.definitionId:
  string | null`.

### 6.4 Docs

`docs/CONTEXT.md`, verbete **Nota** (tracked, entra no commit). Texto proposto:

> O valor da escala que uma Avaliação atribui a um critério, com justificativa opcional: dentro de
> uma definição, ou à resposta inteira, no critério por resposta. Um critério geral rende uma nota
> em cada definição da versão; um critério por resposta, uma nota só.

A spec põe o verbete na Parte 3; ele vem para cá porque é esta Parte que grava a nota sem definição.

### 6.5 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -n "definitionId === null" "app/projects/[id]/(tabs)/evaluate/"*.ts` não acha descarte.
- Testes antigos editados: só os de § 6.1.

### 6.6 O que a Parte 3 herda

Feita em 2026-10-14, sem commit no momento da escrita. `npm run lint`, `npm run typecheck` e
`npm test` (108 arquivos, 1607 testes) verdes.

- **Descarte que sobrou**: só o do formulário, `const cells = codebookCells.filter(isDefinitionCell)`
  no começo de `EvaluationForm` (`evaluate/evaluation-form.tsx` ~212). `grep -rn isDefinitionCell
  app` acha a definição, o teste dela em `criteria.unit` e o formulário. O envio não filtra mais, e
  `loadEvaluationOf` voltou a devolver as linhas como vêm do banco (`return { ...evaluation, scores:
  cells }`, a forma de antes do Plano 1).
- **Tipos**: `EvaluationScore.definitionId` é `string | null`. O formulário já indexava as notas
  gravadas por `cellKey(score)`, então o `typecheck` não apontou nada fora de `evaluate/`; a nota
  por resposta já chega às props do formulário em leitura, e só não aparece por causa do filtro.
- **Envio**: a chave é `cellKeyOf(cell)`; `answers` leva `definitionId: cell.definition?.id ??
  null`; o desfecho `incomplete` tem `titles` e `criteria`, e a recusa chama
  `incompleteMessage(outcome.titles, outcome.criteria)`. O insert não mudou.
- **Mensagem final**, conferida por igualdade exata nos testes: só por resposta, `O critério por
  resposta “Diversity” ainda está sem nota. Dê uma nota nele para enviar a avaliação.`; nos dois,
  `A definição “Query 1” ainda tem critério sem nota, e o critério por resposta “Diversity”
  também. Dê uma nota em cada critério para enviar a avaliação.`
- **Testes novos**: em `evaluate/actions.int.test.ts`, o `describe` "o critério por resposta"
  (6 `it`), com a fábrica `poc(admin)` (cinco Queries, `Relevance` geral, `Diversity` por resposta,
  e os ids dos dois critérios e da `Query 1`).
- **Testes antigos editados**: só os de § 6.1 (`scenario` com `perResponseCriteria`; `form()` e o
  teste da justificativa vazia montam a chave por `cellKey`). O arquivo inteiro rodou verde depois
  disso e antes dos casos novos (20/20).
- **Vermelhos** (6 lidos, com o descarte da Parte 1): o envio completo, o campo inexistente e o
  loader por contagem (5 no lugar de 6; as asserções depois do `toHaveLength` não rodaram); o envio
  sem a nota por resposta por `ok: true`. **Divergências do previsto**: o caso "faltando nas duas"
  não deu `ok: true`, e sim a mensagem antiga (só a `Query 1`), porque a definição incompleta já
  bastava para recusar; o caso da justificativa quebrou primeiro por `TypeError` (lia
  `.justification` de `undefined`) e foi reescrito com `toMatchObject` antes do código, virando
  vermelho de asserção (*expected undefined to match object*).
- **Mutações depois do verde** (desfeitas por `cp`): o descarte de volta no loader derruba só o caso
  do `loadEvaluationOf`, por asserção (5 no lugar de 6), o que prova o loader separado do envio;
  `perResponseIncomplete` zerado no envio derruba dois: o da mensagem combinada por asserção, e o
  de "sem a nota por resposta" **por exceção** (o insert falha com o valor vazio, o CHECK da escala
  do achado 7), não por asserção. O caso "campo de célula inexistente não vira nota" (R11) falhou
  pelo mesmo motivo do envio completo e não tem mutação barata que o separe: a garantia é
  estrutural (achado 9), e o caso fica como guarda de regressão.
- **Docs**: verbete *Nota* em `docs/CONTEXT.md` com o texto do § 6.4.
- **Achado 8 em vigor**: até a Parte 3, com critério por resposta montado à mão, o servidor recusa
  a avaliação que o formulário não deixa completar.

---

## 7. Parte 3 — Formulário do Avaliador

**Ler antes:** `evaluate/evaluation-form.tsx` inteiro; em `evaluate/page.int.test.ts`, o `scenario`,
`formOf`/`markupOf` e os casos "o avaliador ativo vê o formulário…" (~302), "a descrição da
definição e a do critério…" (~414) e "a resposta já avaliada aparece em leitura…" (~497). Lembrar
que o `markupOf` lê o corpo de `<details>` fechado e o balão do ⓘ como texto.

### 7.1 Casos novos (TDD, integração) — `evaluate/page.int.test.ts`

`scenario` aceita `perResponseCriteria`. Cenário: duas definições sem critério próprio, um geral,
um por resposta `Diversity` com descrição (3 células). Um `it` por caso:

- [ ] **Em curso**: no markup, "Por resposta" aparece depois do título da última definição e antes de
      "Enviar avaliação"; o nome e a descrição do `Diversity` aparecem dentro desse trecho; existe o
      campo `score_per_response_<id>`; o contador diz `0 de 3 notas`; o grupo não tem o selo
      "Geral".
- [ ] **Em leitura**: com a avaliação gravada pelo helper (inclusive a nota por resposta com
      justificativa), "Por resposta" aparece depois da última definição, com o marcador da nota e a
      justificativa.

`props.cells` já traz a célula desde a Parte 1, então afirmá-la nas props não é vermelho: afirmar no
markup. Vermelho esperado: "Por resposta" ausente e o contador em `0 de 2 notas` (o formulário ainda
descarta). Contar quais asserções rodaram depois da primeira falha; as de dentro do trecho só rodam
depois do código.

### 7.2 Código — `evaluate/evaluation-form.tsx`

- Remover o filtro da Parte 1.
- `Group.definition: CodebookDefinition | null`; o título do grupo é `definition?.title ??
  PER_RESPONSE_LABEL`, a descrição só existe nas definições; a `key` do grupo é `definition?.id ??
  PER_RESPONSE_KEY`. Vale nos dois modos.
- O resumo do `Disclosure` (`DefinitionSummary`) passa a receber o título, e não a definição.
- Mais nada muda: o contador, `isComplete` e o envio já contam a célula pelo `cells.length` e pelas
  chaves.

### 7.3 Conferência no navegador

Cena por Vitest descartável (memória `vitest-como-runner-de-seed`): o PoC (cinco Queries,
`Relevance` geral, `Diversity` por resposta) pelo `perResponseCriteria` do helper, rodada aberta na
Fase 2, uma resposta, o usuário do `/dev/login` como avaliador ativo. Conferir o banco vazio de
projetos antes de semear.

No `tcc-dev-local`:

- o grupo "Por resposta" depois da Query 5, com a descrição do `Diversity`;
- o contador vai a `6 de 6 notas` e o botão só destrava com a nota por resposta;
- enviar; a leitura mostra a nota por resposta; a 375 px, o grupo não estoura a largura.

**Não salvar o codebook.** Depois: apagar a cena na ordem da memoria
`cena-no-banco-quebra-int-test` (`scores` → `evaluations` → `responses` → `rounds` → `projects` →
`auth.users` de teste), apagar o arquivo de seed, conferir `scores` vazia e só então rodar `npm test`.

### 7.4 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- `grep -rn "isDefinitionCell" app` não acha uso (e a guarda saiu), ou o handoff diz onde ficou.
- Conferência do § 7.3 feita, cena apagada.

### 7.5 Fecho

A Parte 3 fecha o Plano 2, não a série: sem `Closes`.

### 7.6 O que o Plano 3 herda

(preencher ao fim da Parte 3; incluir pelo menos:)

- `CodebookCell.definition: D | null`, e a célula por resposta no fim de `resolveCells`.
- `PER_RESPONSE_LABEL` ("Por resposta") em `criteria.ts`, para a linha das matrizes e o grupo da
  revisão; `PER_RESPONSE_KEY` em `completeness.ts` (é a chave do formulário; as chaves de
  `agreement-matrix.ts`, `review-groups.ts` e `consensus-cells.ts` são outras e precisam do seu
  marcador).
- Os testes que montam fixture por `resolveCells` já mandam `definitionId: null` na célula por
  resposta: um cenário do Plano 3 com critério por resposta já sai com a nota dele.
- **Descartes que continuam**: `agreement.ts` (um, em `toObservation`), `review.ts` e `consensus.ts`. Desde a Parte 2,
  uma nota por resposta pode existir no banco (com critério montado à mão), e essas leituras a
  ignoram.
- A receita da cena do § 7.3.

**→ Plano 4:** o `NOTES_PER_RESPONSE_HELP` ficou para a Parte 2 dele (D2), com o texto proposto.

---

## 8. Fora deste plano

- ICR, matrizes, Qualidade, revisão, consenso (Plano 3).
- Editor, `parseCriteria`, leitura do codebook, entrada da LLM e o ⓘ do card de notas (Plano 4).
- A ajuda da página de avaliação (D6).
- Mostrar a descrição de um critério geral uma vez só no formulário (adiado pelo usuário).
