# Plano de implementação — Issue #62: "25 — Concordância: módulo de cálculo e ICR da rodada"

Link: https://github.com/nicolasddr/tcc/issues/62
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 37, 40, 41, 42, 43,
44 e a parte de invisibilidade da 35)
Blocked by: #60 (fechada) — "Avaliar uma resposta"

**Executado em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com o que a
seguinte herda — anote ali o que divergiu, como nos planos das #60 e #61.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | O módulo puro: `lib/agreement.ts`, o Alpha ordinal e os unitários que o provam | ☑ |
| 2 | Leitura: das notas gravadas para a matriz, e as contagens por avaliador | ☑ |
| 3 | A tela do Administrador: valor, N, faixa de referência, avisos e a invisibilidade ao Avaliador | ☐ |

Decisões de domínio já registradas, **nenhuma ADR nova é necessária**: ADR 0004 (faixa de referência
sem trava), ADR 0010 (escala fixa de três pontos, que é o que dá nível ordinal ao coeficiente),
ADR 0011 (ICR invisível ao Avaliador). Duas convenções pequenas nascem aqui e vão para o glossário,
não para uma ADR: o que fazer quando não há variação nenhuma nas notas, e qual amostra a ferramenta
chama de pequena (§ 3).

**Sem migration.** Esta fatia não cria nem altera tabela: o coeficiente é derivado das notas que a
#60 já grava. Não há `db push` em prod no deploy desta fatia.

---

## 1. Ponto de partida

Tudo o que o cálculo precisa **já está gravado**. A #60 fechou o ciclo de escrita do avaliador e a
#61 fechou a fila; esta fatia é a primeira que só **lê**.

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Avaliação enviada, por vínculo de membro | `evaluations` (`round_id`, `response_id`, `project_member_id`, `submitted_at`) | o avaliador e a rodada de cada conjunto de notas |
| Nota, uma por célula | `scores` (`evaluation_id`, `definition_id`, `criterion_id`, `value`) | o valor da escala que entra na matriz |
| Escala fixa e seus rótulos | `(tabs)/evaluate/scale.ts` | vira **posto ordinal** aqui (§ 3) |
| Células de uma versão de codebook | `pipeline/criteria.ts` (`resolveCells`) | quantas notas uma resposta deveria ter — usado só para leitura de contexto |
| Rodada e suas versões congeladas | `(tabs)/rounds/rounds.ts` (`listRounds`, `loadOpenRound`) | o recorte do cálculo: uma rodada, uma versão de codebook |
| Respostas da rodada | `pipeline/responses.ts` (`listRoundResponses`) | denominador do progresso e leitura de tamanho de amostra |
| Área de rodadas do Administrador | `(tabs)/rounds/page.tsx` + `round-list.tsx` | onde o painel de ICR entra |
| Padrão de módulo puro + unitário | `lib/reorder.ts`, `lib/versioning.ts` | forma e lugar do módulo novo |

A **imutabilidade** já é fato: `evaluations` e `scores` não têm action de edição. É isso que torna
legítimo derivar o coeficiente sob demanda em vez de gravar retrato (história 44).

---

## 2. O coeficiente, escrito por extenso

O implementador não deve improvisar a fórmula. O que segue é o algoritmo completo, na forma da
matriz de coincidências, que é a que trata dado faltante sem caso especial.

### Entrada

Uma lista de observações em formato longo, uma linha por nota:

```
{ unitId, raterId, value }   // value = posto ordinal (1, 2, 3)
```

Formato longo **é** a matriz do enunciado, em forma esparsa. Foi escolhido por isso: a célula que
ninguém avaliou simplesmente não tem linha, que é exatamente o tratamento de dado faltante que o
Alpha exige (história 43), sem `null` circulando pelo cálculo.

### Passos

1. Agrupar por `unitId`. Descartar as unidades com **menos de duas** observações: uma nota sozinha
   não forma par, e não contribui nem para a concordância observada nem para a esperada. Isso não
   é excluir avaliador nenhum — é a definição do coeficiente.
2. Montar a **matriz de coincidências** `o`. Para cada unidade pareável com `m` observações, cada
   par ordenado `(c, k)` de observações distintas dentro da unidade soma `1 / (m - 1)` em `o[c][k]`.
   A matriz é simétrica e sua soma total é `n = Σ m_u` sobre as unidades pareáveis.
3. Marginais: `n_c = Σ_k o[c][k]`.
4. Métrica **ordinal**, que é o que faz "Alto contra Médio" pesar menos do que "Alto contra Baixo":

   ```
   δ²(c, k) = ( Σ_{g entre c e k, inclusive} n_g  −  (n_c + n_k) / 2 )²      e  δ²(c, c) = 0
   ```

   O somatório percorre os postos entre `c` e `k`. Postos da escala que ninguém usou têm `n_g = 0`
   e não mudam nada, então percorrer só os postos observados dá o mesmo resultado que percorrer a
   escala inteira — não é preciso passar a escala para o módulo.
5. Coeficiente:

   ```
   α = 1 − (n − 1) · Σ_c Σ_k o[c][k] · δ²(c, k)
                     ─────────────────────────────
                     Σ_c Σ_k n_c · n_k · δ²(c, k)
   ```

`α` pode ser **negativo** (discordância acima do acaso). Isso não é erro e não deve ser aparado
para zero: é informação, e a faixa de referência já classifica qualquer coisa abaixo de 0,667 como
questionável.

### Quando não dá para calcular

Três motivos distintos, e a tela precisa dizer **qual** (história 42):

| Motivo | Quando | Texto que a tela dá |
|---|---|---|
| `few_evaluators` | menos de dois avaliadores com avaliação enviada na rodada | falta de dado, não erro: o coeficiente compara pessoas, e com uma só não há o que comparar |
| `no_shared_units` | há dois ou mais avaliadores, mas nenhuma resposta-célula foi avaliada por dois deles | os avaliadores não se cruzaram em nenhuma resposta ainda |
| `no_variation` | o denominador dá zero: todas as notas caíram no mesmo ponto da escala | sem variação nas notas não há concordância por acaso a descontar, e o coeficiente fica indefinido |

O terceiro é o caso degenerado, e **não** deve virar 1. Concordância total num único valor é
exatamente a situação em que a concordância percentual mente e o Alpha se recusa a responder. Devolver
1 ali seria afirmar confiabilidade perfeita a partir de dado que não contém evidência nenhuma.

Nota importante sobre o primeiro motivo: como a action de envio só grava avaliação **completa**, todo
avaliador com avaliação enviada tem pelo menos uma nota. Então "avaliadores distintos nas observações"
e "avaliadores com avaliação enviada" são o mesmo conjunto, e a regra dos dois avaliadores cabe dentro
do módulo puro, sem consulta a banco.

---

## 3. Decisões desta fatia

**A unidade de análise é resposta × célula.** Célula é o par definição + critério, como o spec fixa.
O `unitId` é a chave composta `responseId:definitionId:criterionId`. Isso é o que permite, na #63,
recortar as mesmas observações por célula sem trocar o motor de cálculo.

**Postos da escala: baixo = 1, médio = 2, alto = 3.** Nasce `scaleRank` em `(tabs)/evaluate/scale.ts`,
junto de `scaleLabel` e `scaleTone`. A direção não muda o coeficiente (a métrica ordinal é simétrica),
mas fixar a ordem crescente evita que a #64, que precisa distinguir divergência adjacente de extrema,
invente outra.

**O módulo puro recebe posto numérico, não `'high' | 'medium' | 'low'`.** Assim `lib/agreement.ts`
não sabe nada sobre a escala do domínio, e o teste unitário pode usar os exemplos da literatura, que
vêm em números e com mais de três pontos. A tradução mora no loader (Parte 2).

**Amostra pequena é convenção declarada da ferramenta, não da literatura.** Não existe número
canônico, e inventar um e citar Krippendorff seria falso. A regra fica em uma constante única, com
comentário dizendo que é critério da ferramenta: **menos de 3 avaliadores ou menos de 10 respostas
avaliadas** dispara o aviso. O aviso é textual, aparece junto do número e **nunca** esconde o número
(AC explícito). Confirmar o corte com o orientador antes de fechar o épico — é o tipo de escolha que a
banca pergunta.

**A faixa de referência é constante da aplicação, com a origem na tela** (ADR 0004): abaixo de 0,667
questionável, de 0,667 a 0,8 aceitável, 0,8 ou mais boa, creditada a Krippendorff (2004). Ela não
trava nada, em lugar nenhum.

**A classificação usa o valor cru, a tela mostra o arredondado.** Exibir com três casas e classificar
pelo texto exibido faria 0,6665 virar "aceitável". Arredondamento é só apresentação.

**Nenhuma action calcula coeficiente.** Só o loader da Parte 2 e o painel da Parte 3 importam
`lib/agreement`. Fechar rodada e avançar de fase continuam sem olhar métrica nenhuma — é a ADR 0004,
e um teste da Parte 3 prova que fechar funciona com ICR não calculável.

---

## 4. Fronteira com as fatias vizinhas

**#63 (matriz por célula e série por rodada)** é dona de: a matriz definição × critério, a série na
página do projeto e a leitura de qual versão de codebook cada ponto usou. Esta fatia entrega o motor
e o painel de **uma** rodada. O loader da Parte 2 já devolve as observações com `definitionId` e
`criterionId` em cada linha, que é tudo o que a #63 precisa para agrupar por célula sem tocar em
`lib/agreement`.

**#65 (outliers)** é dona da marca e do "com todos e sem os marcados, lado a lado". Esta fatia deixa
a costura pronta e não a usa: excluir alguém do cálculo vira um `filter` sobre as observações antes de
chamar a função pura. Não criar nada de outlier aqui, nem coluna, nem parâmetro.

**#64 (revisão de discordâncias)** consome as mesmas observações para classificar divergência
adjacente e extrema. Não antecipar: nada de classificação de divergência nesta fatia.

---

# Parte 1 — O módulo puro

**Objetivo:** a função de cálculo, provada contra valores verificáveis, sem banco, sem sessão e sem
tela. É a única costura nova do épico e a Parte que a banca vai olhar.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `lib/reorder.ts` e `lib/reorder.unit.test.ts`
(forma de módulo puro e de unitário no repo).

### 1.1 `lib/agreement.ts`

Uma função exportada, como o AC exige:

```ts
export type Observation = { unitId: string; raterId: string; value: number }

export type NotCalculableReason = 'few_evaluators' | 'no_shared_units' | 'no_variation'

export type Agreement =
  | { calculable: true; alpha: number; units: number; raters: number }
  | { calculable: false; reason: NotCalculableReason; units: number; raters: number }

export function ordinalAlpha(observations: readonly Observation[]): Agreement
```

- `units` é a contagem de unidades **pareáveis** (com duas ou mais observações), porque é sobre elas
  que o coeficiente é calculado. `raters` é a de avaliadores distintos nas observações. Os dois vêm
  também no caso não calculável: o AC pede que a tela mostre o N sempre que mostrar alguma coisa.
- A ordem de verificação é a da tabela da § 2: menos de dois avaliadores primeiro, depois nenhuma
  unidade pareável, e `no_variation` por último, quando o denominador zera.
- Implementar exatamente os cinco passos da § 2. Nada de aproximação, nada de atalho para dois
  avaliadores.
- Sem dependência nenhuma, nem de `@/lib/db`, nem de `server-only`.

### 1.2 `lib/agreement.unit.test.ts`

Os quatro primeiros casos abaixo têm valor **exato, derivável no papel** — são a espinha do teste e
podem ir para a monografia como verificação. Postos: 1 = baixo, 2 = médio, 3 = alto.

| Caso | Dado | Esperado |
|---|---|---|
| Concordância parcial, conferível à mão | 2 avaliadores, 4 unidades: `A = [1,2,3,1]`, `B = [1,2,3,2]` | `alpha = 0.79` exato, `units = 4`, `raters = 2` |
| Concordância perfeita **com variação** | 3 avaliadores repetindo `[1,2,3,1,2]` | `alpha = 1` |
| Concordância por acaso em distribuição degenerada | 2 avaliadores, 10 unidades, 8 delas `alto/alto`, uma `alto/médio`, uma `médio/alto` | `alpha = −1/18 ≈ −0.0556`, com **80% de concordância percentual** — o caso que distingue o Alpha da porcentagem, e que o AC pede por nome |
| Dado faltante | igual ao primeiro caso, mais uma quinta unidade avaliada só por `A` | idêntico ao primeiro: `alpha = 0.79`, `units = 4`. A unidade sem par sai, o avaliador não |
| Menos de dois avaliadores | um avaliador só, várias unidades | `calculable: false`, `reason: 'few_evaluators'` |
| Avaliadores que não se cruzam | dois avaliadores em unidades disjuntas | `calculable: false`, `reason: 'no_shared_units'` |
| Sem variação | todos sempre `3` | `calculable: false`, `reason: 'no_variation'` — e **não** `alpha = 1` |
| Avaliação parcial não exclui ninguém | 3 avaliadores, o terceiro avaliou só 2 das 6 unidades | `raters = 3`, e o resultado difere de rodar sem ele (prova que ele entrou no cálculo) |

Os três primeiros valores foram conferidos fora do editor, com a fórmula da § 2. Se a implementação
der outro número, a implementação está errada.

**Mais um caso, obrigatório pelo AC e com um passo manual:** "valores conhecidos da literatura".
Copiar da fonte — Krippendorff, *Computing Krippendorff's Alpha-Reliability* (2011) — a matriz de
exemplo e o valor publicado para o nível **ordinal**, e congelar os dois no teste com a citação em
comentário. **Não** tirar essa matriz nem esse valor de memória, e não aceitar o número que o nosso
código produzir como se fosse o da literatura: o objetivo do caso é justamente ser independente. Se a
fonte não estiver à mão na hora, deixar o teste com `it.todo` e uma linha dizendo o que falta, em vez
de inventar. Como referência cruzada opcional, `irr::kripp.alpha` no R e o pacote `krippendorff` em
Python calculam o mesmo coeficiente.

### 1.3 Glossário

Em `docs/CONTEXT.md`, na entrada **Concordância (ICR)**, acrescentar o que esta fatia fixa: a unidade
de análise é resposta × célula; avaliação ausente é dado faltante e não exclusão; e o coeficiente é
não calculável (nunca zero, nunca 1) nos três casos da § 2. Duas ou três frases, no tom das outras
entradas.

### Testes da Parte 1

- `npm run test:unit` verde, com `lib/agreement.unit.test.ts` cobrindo a tabela acima.
- `npm run lint` e `npm run typecheck` verdes.

### Pronto quando

`ordinalAlpha` existe, é pura, devolve os três motivos de não calculável, e os valores conferidos à
mão batem exatamente. Nenhum arquivo fora de `lib/`, `docs/` e `(tabs)/evaluate/scale.ts` foi tocado.

### O que a Parte 2 herda

**A assinatura saiu exatamente como planejada**, sem renomear nada:

```ts
export type Observation = { unitId: string; raterId: string; value: number }
export type NotCalculableReason = 'few_evaluators' | 'no_shared_units' | 'no_variation'
export type Agreement =
  | { calculable: true; alpha: number; units: number; raters: number }
  | { calculable: false; reason: NotCalculableReason; units: number; raters: number }
export function ordinalAlpha(observations: readonly Observation[]): Agreement
```

`Observation` é exportado do módulo, então o `RoundObservation` da Parte 2 pode estendê-lo como o
plano previa. `ordinalAlpha` é a única função exportada; o resto do arquivo é privado.

**O caso da literatura bateu de primeira, e está no teste com valor publicado.** Fonte: Krippendorff,
*Computing Krippendorff's Alpha-Reliability* (2011.1.25, literatura atualizada em 2013.9.13), PDF no
site do próprio autor (`asc.upenn.edu`). A matriz é a de 4 observadores × 12 unidades da seção C do
artigo (7 valores faltantes, `m_u` variando de 1 a 4, `n = 40` valores pareáveis), e o valor publicado
para o nível ordinal é **0,815**. A implementação devolve `0.8153875…`, `units = 11` (a unidade 12 tem
uma nota só e sai) e `raters = 4`. O teste afirma com `toBeCloseTo(0.815, 3)`, que é a precisão em que
o artigo publica. A citação ficou no texto do `it`, não em comentário, porque o repo não usa
comentários no código.

Os quatro valores conferidos no papel também bateram exatos: `0.79`, `1`, `−1/18` e o caso de dado
faltante idêntico ao primeiro. O caso "avaliação parcial não exclui ninguém" foi montado com 6
unidades e um terceiro avaliador em 2 delas: `raters = 3` e o alpha muda (`0.3125` sem ele,
`−0.0586` com ele), o que prova que ele entrou no cálculo.

**Duas notas de implementação que a Parte 2 pode ignorar, mas a Parte 3 não:**

- `units` é a contagem de unidades **pareáveis**, e vem preenchido também no caso não calculável —
  em `few_evaluators` com um avaliador só ele dá `0`, porque nenhuma unidade tem duas notas.
- `raters` conta avaliadores distintos **nas observações**. Como a action de envio só grava avaliação
  completa, isso coincide com "avaliadores com avaliação enviada" — mas quem enviou zero não aparece
  aqui. É por isso que `listEvaluatorEffort` (Parte 2) existe separado: é ele quem mostra o avaliador
  com zero.

**`scaleRank` não foi criado nesta Parte.** O plano o lista na § 3 como decisão desta fatia, mas a
implementação mora na § 2.1, que é da Parte 2. Nada em `(tabs)/evaluate/` foi tocado: a Parte 1
mexeu só em `lib/agreement.ts`, `lib/agreement.unit.test.ts` e `docs/CONTEXT.md`.

---

# Parte 2 — Leitura: da nota gravada para a matriz

**Objetivo:** transformar `scores` em observações, sem calcular nada e sem renderizar nada. É a Parte
que define o recorte por rodada, que é o que a metodologia exige.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 2 herda" da Parte 1,
`(tabs)/rounds/rounds.ts`, `(tabs)/evaluate/evaluation.ts` (loaders sobre `evaluations`/`scores`) e
`docs/dev/camada-de-dados.md`.

### 2.1 `scaleRank` em `(tabs)/evaluate/scale.ts`

`low → 1`, `medium → 2`, `high → 3`, com o mesmo `switch` exaustivo de `scaleLabel`. Caso novo em
`scale.unit.test.ts`.

### 2.2 `(tabs)/rounds/agreement.ts` — os loaders

```ts
export type RoundObservation = Observation & {
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
}

export function loadRoundObservations(roundId, db?): Promise<RoundObservation[]>
export function loadProjectObservations(projectId, db?): Promise<Map<string, RoundObservation[]>>
export function listEvaluatorEffort(roundId, projectId, db?): Promise<EvaluatorEffort[]>
```

- `loadRoundObservations`: `scores` ⋈ `evaluations` filtrando `evaluations.round_id`. Monta
  `unitId = ${responseId}:${definitionId}:${criterionId}`, `raterId = projectMemberId` e
  `value = scaleRank(value)`. Guardar também os três ids crus: é o que a #63 vai agrupar por célula,
  e o que a #64 vai usar para achar a divergência.
- `loadProjectObservations`: a mesma consulta com `evaluations ⋈ rounds` filtrando por projeto,
  agrupada por `roundId`. Existe porque a tela lista todas as rodadas e uma consulta por linha seria
  N+1. A #63 reaproveita inteira para a série.
- `listEvaluatorEffort`: nome do avaliador, vínculo e **quantas avaliações ele enviou nesta rodada**
  (história 43, "o número de avaliações efetivas por avaliador fica visível"). Parte de
  `project_members` com `role = 'evaluator'` e `status = 'active'`, com `left join` nas avaliações da
  rodada, para quem enviou zero aparecer com zero. Ordenar por nome, como `listEvaluatorsNotFinished`.
- Todos aceitam `DbExecutor` opcional com default `ownerDb`, e validam uuid com `isUuid` antes de
  consultar, como os loaders da #60 fazem.
- **Nenhum destes chama `ordinalAlpha`.** O loader entrega observações; quem calcula é a página.

### 2.3 Testes da Parte 2 (`agreement.int.test.ts`)

Fixtures: `addRound`, `addResponse`, `addEvaluation` com `cells`, `addCodebookVersion` — todos já
existem em `test/helpers.ts`, inclusive com valor por célula.

- Duas rodadas no mesmo projeto, cada uma com avaliações: `loadRoundObservations` de uma **não**
  traz nenhuma observação da outra. É o recorte por rodada, que é o AC central do issue.
- `unitId` distingue células: duas notas da mesma resposta, mesmo critério geral, em definições
  diferentes, produzem unidades diferentes. Prova que a chave por definição da ADR 0009 sobrevive até
  o cálculo, e é o que impede que critério geral vire uma nota só por resposta.
- Avaliação parcial: avaliador que enviou 2 de 5 respostas aparece nas observações das 2 e some das
  outras 3, sem nenhum `null`.
- `value` chega como posto: uma nota `'low'` vira `1`.
- `loadProjectObservations` devolve uma chave por rodada com avaliação, e não devolve chave para
  rodada sem nenhuma.
- `listEvaluatorEffort`: avaliador ativo que não enviou nada aparece com zero; quem enviou três
  aparece com três; avaliador de outro projeto não aparece.
- Composição com a Parte 1: montar em banco um cenário de concordância perfeita **com variação** e
  provar que `ordinalAlpha(await loadRoundObservations(...))` devolve 1. É o único teste que junta as
  duas peças, e existe para provar que a tradução escala → posto não inverteu nada.

### Pronto quando

`npm test` verde. As observações de uma rodada nunca vazam para outra, avaliação parcial vira dado
faltante de verdade, e nenhum loader importa `lib/agreement`.

### O que a Parte 3 herda

**As assinaturas saíram como planejadas, com um nome de campo a registrar.** `(tabs)/rounds/agreement.ts`:

```ts
export type RoundObservation = Observation & {
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
}
export type EvaluatorEffort = { projectMemberId: string; name: string; submitted: number }

export function loadRoundObservations(roundId: string, db?: DbExecutor): Promise<RoundObservation[]>
export function loadProjectObservations(projectId: string, db?: DbExecutor): Promise<Map<string, RoundObservation[]>>
export function listEvaluatorEffort(roundId: string, projectId: string, db?: DbExecutor): Promise<EvaluatorEffort[]>
```

A contagem de avaliações enviadas chama-se **`submitted`**, e não `evaluations`, porque o módulo já
importa a tabela `evaluations` de `@/lib/db` e o nome colidiria na leitura. Nenhuma coluna a mais foi
necessária: `projectMemberId` (o vínculo), `name` e `submitted` bastam para a lista de esforço da
história 43.

**O loader importa `lib/agreement` só como tipo.** `import type { Observation }` some na compilação,
então `RoundObservation` estende o tipo da Parte 1 sem que nada em `agreement.ts` chame `ordinalAlpha`
— a regra de "nenhum loader calcula" continua valendo ao pé da letra. Quem calcula é a página da
Parte 3.

**`loadProjectObservations` omite a rodada sem nenhuma avaliação**, em vez de devolver chave com lista
vazia. A página tem que tratar a ausência: `ordinalAlpha(byRound.get(round.id) ?? [])` devolve
`calculable: false`, `reason: 'few_evaluators'`, `units: 0`, `raters: 0` — que é exatamente o que a
tela deve mostrar para uma rodada recém-aberta.

**Administrador-avaliador não virou caso especial.** `raterId` é o `projectMemberId`, e `requireEvaluator`
só deixa enviar quem tem vínculo `role = 'evaluator'` ativo — o mesmo filtro de `listEvaluatorEffort`.
Então um administrador que também é avaliador aparece uma vez só, pelo vínculo de avaliador, tanto nas
observações quanto na lista de esforço. Nada a decidir na Parte 3.

**`scaleRank` nasceu aqui**, em `(tabs)/evaluate/scale.ts`, com `low → 1`, `medium → 2`, `high → 3` e
dois casos novos em `scale.unit.test.ts`. A conversão de `scores.value` (texto) para posto passa por
`isScaleValue`, que já existia: valor fora da escala não vira observação em vez de virar `NaN`.

**Os testes de integração rodam sob `inRollbackTx`**, como `pipeline/responses.int.test.ts`, porque os
três são leitura pura e não precisam de commit. São 9 casos: o recorte por rodada, a unidade
resposta × célula com critério geral em duas definições, avaliação parcial sem `null`, a tradução dos
três valores da escala, o agrupamento por rodada (com omissão da rodada vazia e do outro projeto), as
duas contagens de esforço e a composição com a Parte 1, em que concordância perfeita com variação
montada em banco devolve `alpha` exatamente `1`.

`npm test` 679 testes verdes; `npm run lint` e `npm run typecheck` verdes.

---

# Parte 3 — A tela do Administrador

**Objetivo:** o Administrador vê o coeficiente com o N, a faixa e os avisos, na rodada aberta e nas
fechadas. E o Avaliador continua sem ver nada disso, provado por teste.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 3 herda" da Parte 2,
`(tabs)/rounds/page.tsx`, `round-list.tsx`, `page.int.test.ts` da mesma pasta e
`app/components/ui/{stat,alert,badge}.tsx`.

### 3.1 `(tabs)/rounds/agreement-labels.ts` — módulo puro de apresentação

Separado do cálculo de propósito: o AC pede que `lib/agreement.ts` tenha **uma** função.

- `AGREEMENT_BANDS` com os cortes da ADR 0004 e `AGREEMENT_SOURCE = 'Krippendorff (2004)'`.
- `agreementBand(alpha): 'questionable' | 'acceptable' | 'good'` — classifica pelo valor cru.
- `bandLabel(band)` → "questionável" / "aceitável" / "boa"; `bandTone(band)` → tom de `Badge`
  (`danger` / `warning` / `success`), no padrão de `scaleTone`.
- `formatAlpha(alpha)` → três casas com vírgula (`pt-BR`), negativo incluso. Existe para o teste
  poder afirmar sobre texto sem depender de locale do ambiente.
- `sampleSize({ units, raters })` → "12 unidades · 3 avaliadores", com `plural`.
- `SMALL_SAMPLE_RATERS = 3` e `SMALL_SAMPLE_RESPONSES = 10`, com o comentário da § 3 dizendo que o
  corte é critério da ferramenta. `smallSampleWarning({ raters, responses })` devolve o texto ou
  `null`.
- `notCalculableMessage(reason)` → o texto de cada motivo da tabela da § 2.

Unitário `agreement-labels.unit.test.ts`: os três cortes, inclusive as bordas exatas 0,667 e 0,8;
negativo cai em questionável; `formatAlpha(1)` e `formatAlpha(-1/18)`; o aviso aparece e some nos
limites; um texto para cada motivo.

### 3.2 `(tabs)/rounds/agreement-panel.tsx`

Dois componentes no mesmo arquivo, servidor, sem estado:

- `AgreementPanel({ agreement, responses, effort })` — o painel cheio, para a rodada em foco:
  - calculável: `StatCard` com `label="Concordância (ICR)"`, valor `formatAlpha`, `badge` com a faixa,
    `hint` com o N (`sampleSize`) e a frase da faixa com a origem citada, sempre visível;
  - aviso de amostra pequena como `Alert tone="notice"` **abaixo** do número, nunca no lugar dele;
  - não calculável: o valor vira "não calculável", com o motivo em texto e o N do mesmo jeito;
  - lista curta de esforço: cada avaliador ativo e quantas avaliações enviou (história 43).
- `AgreementValue({ agreement })` — versão compacta, uma linha, para as linhas de `RoundList`.

Texto da faixa, uma frase só, exibida junto de todo coeficiente: abaixo de 0,667 questionável, de
0,667 a 0,8 aceitável, 0,8 ou mais boa, referência de Krippendorff (2004), e que é referência, não
trava.

### 3.3 Ligação na página de rodadas

Em `(tabs)/rounds/page.tsx`, dentro da mesma `transaction` que já existe:

- carregar `loadProjectObservations(project.id)` e, se houver rodada aberta,
  `listEvaluatorEffort(openRound.id, project.id)`;
- calcular com `ordinalAlpha` por rodada, na página, depois da transação;
- `AgreementPanel` numa `Section` própria da rodada aberta, **acima** de fechar rodada — é o "o aviso
  aparece cedo" da história 42;
- `AgreementValue` em cada linha de `RoundList`, que já mostra versão de codebook e prompt ao lado,
  então o número nunca aparece sem a versão que ele mede.

Nada de média entre rodadas, em lugar nenhum. A série cronológica dedicada é a #63.

### 3.4 Testes da Parte 3

Em `(tabs)/rounds/page.int.test.ts`, no desenho que o arquivo já usa (`findElement` / `textOf`):

- Administrador com rodada de 2 avaliadores concordando: o painel aparece, com o número, o N em
  unidades e avaliadores, a faixa e a palavra "Krippendorff".
- Rodada com **um** avaliador só: "não calculável" com o motivo, e o número de avaliadores à vista.
  Em seguida, na suíte de actions, **fechar essa rodada continua funcionando** — métrica não trava
  (ADR 0004). Um teste, não uma promessa.
- Amostra pequena: o aviso aparece **e** o número continua na tela. Assertar as duas coisas na mesma
  expectativa, porque esconder o número é o erro que o AC proíbe.
- Rodada com avaliação parcial: o esforço por avaliador aparece com a contagem certa e ninguém sumiu
  da lista.
- Avaliador tentando `/rounds` continua levando `notFound` (já coberto; confirmar que segue verde).
- **Invisibilidade (AC e história 35):** em `(tabs)/evaluate/page.int.test.ts`, com rodada já tendo
  avaliações de dois avaliadores, a árvore renderizada para o Avaliador não contém `AgreementPanel`
  nem `AgreementValue`, e o texto não contém "Krippendorff", "ICR" nem "Concordância". Fazer a mesma
  asserção de texto na página de visão geral do projeto vista por um avaliador.

### Pronto quando

`npm test` verde, `npm run lint` e `npm run typecheck` verdes, e a tela do Administrador mostra o
coeficiente com N, faixa, origem e aviso, enquanto a do Avaliador não mostra nada disso.

### O que ficou desta Parte

_(preencher: o que divergiu, onde o painel acabou ficando, e o que a #63 pode reaproveitar tal como
está.)_

---

## 5. Riscos e pontas soltas

**O caso da literatura é o único ponto que pode travar a Parte 1.** Ele é AC explícito e exige a
fonte na mão. O plano manda deixar `it.todo` com o que falta em vez de inventar matriz ou valor — e
os quatro casos conferidos no papel já provam o algoritmo sozinhos, então a fatia não fica sem rede
enquanto isso.

**O corte de amostra pequena é escolha da ferramenta, e está exposto.** Qualquer número aqui é
arbitrário; o que não pode é parecer literatura. Por isso ele mora numa constante comentada e o texto
da tela não cita fonte nenhuma para ele. Vale confirmar com o orientador.

**`no_variation` é a decisão mais discutível da fatia**, e é deliberada: a alternativa, devolver 1,
transforma "todo mundo marcou Alto em tudo" em confiabilidade perfeita, que é o oposto do que o
número deveria dizer. Está registrada na § 2 e vai para o glossário, para não virar bug aos olhos de
quem chegar depois.

**Custo de leitura.** `loadProjectObservations` traz todas as notas do projeto de uma vez. Com o teto
de respostas por projeto e uma equipe pequena, é da ordem de milhares de linhas — barato. Se a #63
fizer isso crescer, o caminho é agregar por rodada no banco, não paginar na página.

**Adjacente, não obrigatório:** `listEvaluatorsNotFinished` hoje devolve todos os avaliadores ativos
sem olhar quem terminou (pendência anotada no plano da #60). `listEvaluatorEffort` nasce com a
informação certa, então trocar o uso em `CloseRound` vira uma linha — mas é fora do escopo desta
issue e melhor como fatia própria.

**Deploy:** nada a fazer. Sem migration, sem variável nova, sem `db push`.
