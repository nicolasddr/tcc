# Plano de implementação — Issue #64: "26 — Revisão de discordâncias"

Link: https://github.com/nicolasddr/tcc/issues/64
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 50, 51, 52, 54, 56
e a parte de visibilidade da 35)
Blocked by: #60 (fechada) — "Avaliar uma resposta". Também depende, na prática, da #61 (rótulo e fila)
e da #63 (rodada em foco e rótulos de célula), ambas fechadas.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60, #61, #62 e #63.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Classificar divergência e montar a revisão de uma resposta, sem tela e sem banco | ☑ |
| 2 | A tela da rodada: rota nova, navegação entre respostas, células, notas e justificativas | ☐ |
| 3 | O acesso do Avaliador: só as rodadas em que avaliou, sem coeficiente nenhum | ☐ |

**Nenhuma ADR nova.** As decisões que esta fatia usa já estão registradas: ADR 0009 (avaliação
imutável vinculada ao membro — é o que faz a nota ter dono e sobreviver à desativação), ADR 0010
(escala fixa de três pontos — é dela que sai a distinção entre adjacente e extrema), ADR 0011
(ICR invisível ao Avaliador), ADR 0012 (ordem embaralhada por avaliador com rótulo fixo — é o rótulo
que dá nome à resposta nesta tela). Duas convenções pequenas nascem aqui e vão para o glossário, não
para uma ADR: **divergência adjacente e extrema** e **revisão de discordâncias** (§ 3 e passo 3.5).

**Sem migration.** Nada de tabela nova nem de coluna nova: a tela é leitura pura de `evaluations` e
`scores`, que a #60 já grava. A primeira escrita desta área é a anotação de consenso, que é da #66.
Não há `db push` em prod no deploy desta fatia.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Notas gravadas, com justificativa | `scores` (`evaluation_id`, `definition_id`, `criterion_id`, `value`, `justification`) | é o dado inteiro da tela |
| Dono da nota | `evaluations.project_member_id` → `project_members` → `profiles.name` | o nome real que aparece ao lado de cada nota |
| Escala e ordem | `(tabs)/evaluate/scale.ts` (`ScaleValue`, `scaleLabel`, `scaleTone`, `scaleRank`) | `scaleRank` é o que transforma "Alto com Baixo" em distância 2 |
| Rótulo fixo da resposta | `(tabs)/evaluate/queue.ts` (`responseLabel`) | "Resposta 3" é igual para todos; a fila embaralhada **não** entra aqui |
| Respostas em ordem de criação | `pipeline/responses.ts` (`listRoundResponses`, já ordena por `createdAt`) | é a ordem do rótulo e a ordem da navegação desta tela |
| Células de uma versão de codebook | `pipeline/criteria.ts` (`resolveCells`, `criteriaOfDefinition`, `isGeneral`) | quem decide quais pares definição × critério existem |
| Codebook de uma versão específica | `pipeline/codebook.ts` (`loadCodebookVersion`) | a revisão é sobre a versão **que a rodada fixou** |
| Rodadas do projeto | `(tabs)/rounds/rounds.ts` (`listRounds`, `isOpen`, `RoundSummary`) | a lista de onde se entra na revisão |
| Acesso de Administrador | `pipeline/access.ts` (`loadPipelineAccess`, `requirePipelineAdmin`) | metade da autorização desta fatia |
| Acesso de Avaliador | `(tabs)/evaluate/access.ts` (`requireEvaluator`) | a outra metade; dá o `memberId` do vínculo ativo |
| Navegação anterior/próxima | `(tabs)/evaluate/queue-nav.tsx` (`QueueNav`) | a mesma barra serve à revisão (§ 3) |
| Texto longo com rolagem própria | `app/components/ui/prose.ts` (`scrollBoxClass`, `preWrapClass`) | é como o AC de texto longo é cumprido |
| Expansão e recolhimento | `app/components/ui/disclosure.tsx` (`Disclosure`, sobre `<details>`) | a expansão por definição e a da justificativa |
| Abas do projeto | `app/projects/[id]/project-tabs.tsx` | hoje "Rodadas" é aba só de Administrador; a Parte 3 mexe nisso |

O que **falta** e esta fatia cria: classificar divergência, carregar as notas de uma resposta com
nome e justificativa, uma rota por rodada, e o caminho de entrada do Avaliador.

---

## 2. A tela, por extenso

### A célula e os seus estados

A unidade da tela é a mesma da #62 e da #63: **resposta × célula**, onde célula é o par definição ×
critério que existe na versão de codebook da rodada. Um critério geral rende uma célula em cada
definição — e as duas podem divergir de formas diferentes, que é justamente o que interessa ler.

Uma célula, numa resposta, tem uma nota por avaliador que enviou avaliação daquela resposta. Os
estados são cinco:

| Estado | Quando | O que a tela mostra |
|---|---|---|
| `unrated` | nenhuma nota | "sem nota", em tom neutro |
| `single` | exatamente uma nota | "1 nota", em tom neutro, **sem** marca de divergência nem de unanimidade |
| `unanimous` | duas ou mais notas, todas no mesmo ponto | "unânime" |
| `adjacent` | distância máxima 1 entre as notas (Alto com Médio, Médio com Baixo) | "divergência adjacente" |
| `extreme` | distância máxima 2 (Alto com Baixo presentes) | "divergência extrema" |

`single` é um estado à parte de propósito. O AC diz que divergência é qualquer célula **sem
unanimidade entre os avaliadores considerados**, e uma nota só não é unanimidade nem é divergência:
não há com quem discordar. Chamar isso de "unânime" seria dizer que a equipe concordou quando uma
pessoa só respondeu — o mesmo erro que a #63 evitou ao não deixar célula vazia virar zero.

A classificação sai da distância na escala, e não de uma lista de pares: com `scaleRank`, o
`max − min` das notas da célula é 0, 1 ou 2. Três notas distintas na mesma célula (Alto, Médio e
Baixo) dão distância 2 e caem em **extrema** — o caso que o issue pede em teste, e que o ícone único
de certo e errado do documento antigo não sabia representar.

### O porquê da distinção

Numa escala ordinal de três pontos as duas divergências são diagnósticos diferentes, e a tela precisa
dizer isso por escrito (é AC):

- **Adjacente** costuma indicar fronteira borrada entre pontos da escala: as pessoas entenderam a
  mesma coisa e discordaram de grau.
- **Extrema** costuma indicar definição ambígua: duas pessoas leram coisas opostas no mesmo texto,
  com o mesmo codebook.

Refinar um caso e o outro é trabalho diferente — o primeiro pede critério mais preciso na régua, o
segundo pede descrição mais precisa na definição.

### A justificativa

A justificativa é opcional na #60, então célula com nota e sem justificativa é comum e **não** é
erro. A tela diz "sem justificativa" por extenso, em vez de deixar um espaço vazio que parece falha de
carregamento. Onde existe, o texto aparece ao passar o mouse (`title`) e ao expandir, dentro de uma
caixa com rolagem própria — o texto longo rola no seu espaço e nunca estica a página.

### Os dois papéis

| | Administrador | Avaliador |
|---|---|---|
| Quais rodadas alcança | todas as do projeto | só aquelas em que ele enviou ao menos uma avaliação |
| Quando abre | depois do fechamento da rodada | depois do fechamento da rodada |
| Notas que vê | todas, com nome real | todas, com nome real |
| Coeficiente | vê nas telas de concordância (não nesta, § 3) | **nenhum**, em lugar nenhum |

A discussão fica presa à rodada porque é isso que mantém a Fase 4 medindo a clareza do codebook em
vez da memória do grupo (história 56). Nomes reais para todos, por ora: a anonimização já está
registrada como funcionalidade futura em `docs/CONTEXT.md`.

---

## 3. Decisões desta fatia

**A rota é `/projects/[id]/rounds/[roundId]`, e ela não é mais só do Administrador.** A #63 registrou
que a tela por rodada seria da #64; é esta. Fica dentro de `(tabs)/rounds/` porque é a mesma área
conceitual, e o `activeTab` já resolve o segmento `rounds` sem mudança. A autorização é da página, e
não de um layout: hoje `rounds/page.tsx` chama `requirePipelineAdmin` por conta própria, e a rota
filha passa a ter a sua própria regra, que aceita os dois papéis.

**O caminho de entrada do Avaliador é a aba "Rodadas", que deixa de ser um rótulo desabilitado.**
Hoje o Avaliador vê "Rodadas · ainda não implementado". A alternativa seria uma rota separada
(`/review`), com uma segunda lista de rodadas — dois lugares para o mesmo conceito. Em vez disso,
`/rounds` ganha um ramo de Avaliador: uma lista enxuta das rodadas revisáveis, sem nada da gestão de
rodada. O Administrador continua vendo exatamente o que vê hoje.

**Esta tela não mostra coeficiente para ninguém, nem para o Administrador.** O AC só proíbe ao
Avaliador, mas juntar o número aqui criaria duas fontes para a mesma leitura (a matriz da rodada em
foco já vive em `/rounds`) e faria a invisibilidade do Avaliador depender de um `if` dentro de um
componente compartilhado. Com zero coeficiente na página, a regra vira estrutural: a página **não
carrega** observação nenhuma e **não importa** `lib/agreement`. Levar a matriz da #63 para cá é uma
fatia futura barata e está registrada no § 5.

**O nome da resposta é o rótulo fixo, derivado da ordem de criação.** `responseLabel(posição)` sobre
`listRoundResponses`, que já ordena por `createdAt`. A fila embaralhada da #61 é de cada avaliador e
não pode aparecer aqui: o ponto da revisão é que "Resposta 3" queira dizer a mesma coisa para todo
mundo na reunião (ADR 0012).

**A resposta em foco vive na URL** (`?response=<id>`), como na tela de avaliar. É o que faz o link ser
compartilhável na reunião e o que faz o estado sobreviver a revalidação. Sem `response`, ou com um id
que não é daquela rodada, a página cai na primeira resposta — sem redirect, ao contrário da tela de
avaliar, porque aqui não existe "próxima pendente" a preservar.

**A expansão por definição é `<details>`, e não estado de servidor.** Abrir e fechar uma definição é
gesto de leitura e não precisa de ida ao servidor nem de parâmetro na URL. Por definição, o grupo já
nasce aberto quando tem alguma divergência e fechado quando é todo unânime — quem abre a tela cai
olhando o que interessa.

**As notas de vínculo desativado aparecem.** O `listEvaluatorEffort` filtra `status = 'active'` porque
é sobre denominador de progresso; a revisão **não** filtra, porque desativar um membro preserva o que
ele avaliou (história 61) e a nota dele continua no cálculo. A única porta para tirar alguém do
cálculo é a marca de outlier, que é da #65.

**`QueueNav` sobe para `app/components/ui/`.** A barra de "Resposta anterior / Próxima resposta" é
exatamente a mesma nas duas telas, e os rótulos já falam de resposta. Mesma decisão que a #63 tomou
com o `OpenLink`: o componente muda de pasta e nada muda no visual, com uma linha alterada em
`(tabs)/evaluate/page.tsx`. Se na hora ficar caro, duplicar 20 linhas é aceitável — registrar no "o
que a Parte 3 herda".

**Rodada aberta não vira erro.** Quem tem direito de ver a rodada e chega nela antes do fechamento
recebe uma frase explicando que a revisão abre quando a rodada fechar, e não um 404. O 404 fica para
quem não deveria alcançar aquela rodada — que é coisa diferente e precisa continuar sendo
indistinguível de "não existe".

---

## 4. Fronteira com as fatias vizinhas

**#65 (outliers)** é dona da marca por rodada e do "com todos e sem os marcados, lado a lado". Nesta
fatia, "os avaliadores considerados" são todos os que enviaram avaliação. Quando a #65 chegar, a nota
de quem for outlier continua aparecendo aqui, identificada (história 50) — o que muda é o cálculo, não
a tela. **Não criar nada de outlier agora**: nem coluna, nem parâmetro, nem prop reservada.

**#66 (anotações de consenso)** é dona das histórias 53 e 55: a ata do Administrador, visível a todos
os membros da rodada, e a anotação privada do Avaliador. É a primeira escrita desta área e traz tabela
nova. Esta fatia é **só leitura**: nenhuma `action`, nenhum formulário. O que ela deve deixar pronto é
o lugar — a célula é a unidade onde a anotação vai encostar, e por isso a célula precisa ser um
componente identificável, com `definitionId` e `criterionId` à mão.

**#67 (exportação CSV)** é dona do dado bruto, uma linha por nota, de uma rodada por vez. A revisão não
ganha botão de baixar nada.

**#63 (matriz e série)** continua dona do coeficiente. Esta fatia não chama `ordinalAlpha`, não importa
`lib/agreement` e não mexe em `agreement*.ts`.

---

# Parte 1 — Classificação e montagem, sem tela e sem banco

**Objetivo:** dada a lista crua de notas de uma resposta, mais as definições e os critérios da versão
de codebook da rodada, devolver a revisão já montada: um grupo por definição, uma célula por critério,
cada célula com as notas e a classificação de divergência. Puro: sem React, sem `@/lib/db`.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `(tabs)/evaluate/scale.ts`,
`pipeline/criteria.ts` e, como modelo de forma e de estilo, `(tabs)/rounds/agreement-matrix.ts` e
`agreement-labels.ts`.

### 1.1 `(tabs)/rounds/divergence.ts`

```ts
export type CellDivergence = 'unrated' | 'single' | 'unanimous' | 'adjacent' | 'extreme'

export function classifyDivergence(values: readonly ScaleValue[]): CellDivergence

export function isDivergent(kind: CellDivergence): boolean

export function divergenceLabel(kind: CellDivergence): string
export function divergenceTone(kind: CellDivergence): 'neutral' | 'success' | 'warning' | 'danger'
export function divergenceMeaning(kind: CellDivergence): string

export const DIVERGENCE_LEGEND: string
export const NO_JUSTIFICATION_LABEL = 'sem justificativa'
export const NO_JUSTIFICATION_HINT: string
```

- `classifyDivergence` mapeia por `scaleRank`: zero notas → `unrated`; uma → `single`; senão
  `max − min` em 0 → `unanimous`, 1 → `adjacent`, 2 → `extreme`. Não enumerar pares de valores; a
  distância é a regra, e é ela que faz três notas distintas caírem em `extreme` sem caso especial.
- `isDivergent` é verdadeiro só para `adjacent` e `extreme`. É o que a tela usa para destacar, e é o
  que impede alguém tratar `single` como divergência por descuido.
- `divergenceLabel`: `'sem nota'`, `'1 nota'`, `'unânime'`, `'divergência adjacente'`,
  `'divergência extrema'`. `divergenceTone`: neutro, neutro, `success`, `warning`, `danger`.
- `divergenceMeaning` é a frase por extenso de cada estado, para `title` e para a legenda.
- `DIVERGENCE_LEGEND` é a frase única que explica a diferença entre adjacente e extrema (AC), montada
  a partir das próprias constantes, no espírito de `MATRIX_LEGEND` e `BAND_REFERENCE`.
- `NO_JUSTIFICATION_HINT` diz que a justificativa é opcional no envio, e que a ausência é escolha do
  avaliador, não falha de carregamento.
- Nada de `server-only`, nada de `@/lib/db`, nada de `lib/agreement`.

### 1.2 `(tabs)/rounds/review-groups.ts`

```ts
export type ReviewNote = {
  projectMemberId: string
  evaluatorName: string
  value: ScaleValue
  justification: string | null
}

export type CellNote = ReviewNote & { definitionId: string; criterionId: string }

export type ReviewCell<C> = {
  criterion: C
  isGeneral: boolean
  notes: ReviewNote[]
  divergence: CellDivergence
}

export type ReviewGroup<D, C> = {
  definition: D
  cells: ReviewCell<C>[]
  divergent: number
}

export function reviewGroups<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  notes: readonly CellNote[],
): ReviewGroup<D, C>[]

export function divergentCells(groups: readonly ReviewGroup<unknown, unknown>[]): number
export function ratedCells(groups: readonly ReviewGroup<unknown, unknown>[]): number
```

- `CriterionKey` já existe em `agreement-matrix.ts` (`DefinitionKey & CriterionScope`); importar de lá
  em vez de declarar de novo.
- Um grupo por definição, na ordem recebida; dentro dele, uma célula por critério de
  `criteriaOfDefinition(definition.id, criteria)` — específicos primeiro, gerais depois, como a função
  já devolve. Critério geral rende uma célula em **cada** definição, com as notas daquela definição.
- Agrupar as notas **uma vez** num `Map` com chave `${definitionId}:${criterionId}`, como a #63 fez na
  matriz.
- Notas ordenadas por `evaluatorName` e, em empate, por `projectMemberId`, para a ordem das colunas
  ser estável entre respostas e entre visitas.
- `divergent` é a contagem de células com `isDivergent` no grupo — é o resumo que o cabeçalho do grupo
  mostra e o que decide se ele nasce aberto.
- Nenhuma função de média, de percentual ou de ranking neste módulo. "Onde mais se divergiu" é
  tentador e não é AC; se não existe a função, ninguém a chama por engano.

### 1.3 Testes da Parte 1

`divergence.unit.test.ts` e `review-groups.unit.test.ts`:

- **Os cinco estados**: nenhuma nota → `unrated`; uma nota → `single`; duas iguais → `unanimous`;
  Alto com Médio e Médio com Baixo → `adjacent`; Alto com Baixo → `extreme`.
- **Três notas distintas na mesma célula** (pedido explícito do issue): Alto, Médio e Baixo →
  `extreme`, e não `adjacent`.
- **Uma nota só não é unanimidade**: `single` não passa em `isDivergent` **e** o rótulo dele não é o
  de unânime. É a asserção que protege a leitura honesta da tela.
- **Ordem das notas não muda a classificação**: `[low, high]` e `[high, low]` dão o mesmo resultado.
- **Critério geral rende uma célula por definição, com divergências diferentes**: mesmo critério
  unânime na definição A e extremo na definição B.
- **Critério específico não vaza**: critério da definição A não aparece nas células da B.
- **Célula sem nota é `unrated`, e não `unanimous`**: o análogo do "não vira zero" da #63.
- **Nota de avaliador desconhecido pela célula não entra**: notas de outro par definição × critério
  não contaminam a célula vizinha.
- **`divergentCells` conta célula, não nota**: duas notas divergentes na mesma célula contam 1.

### Pronto quando

`npm run test:unit`, `npm run lint` e `npm run typecheck` verdes. Os dois módulos são puros, e nenhum
arquivo fora de `divergence*.ts` e `review-groups*.ts` foi tocado.

### O que a Parte 2 herda

**Nada divergiu do plano.** Os dois módulos nasceram com as assinaturas do § 1.1 e do § 1.2, puros
(sem React, sem `@/lib/db`, sem `lib/agreement`), e nenhum arquivo fora de `divergence*.ts` e
`review-groups*.ts` foi tocado. `npm run test:unit` (326 testes, 27 novos), `npm run lint` e
`npm run typecheck` verdes.

**As assinaturas finais, como estão no código:**

```ts
// (tabs)/rounds/divergence.ts
export type CellDivergence = 'unrated' | 'single' | 'unanimous' | 'adjacent' | 'extreme'
export type DivergenceTone = 'neutral' | 'success' | 'warning' | 'danger'

export const NO_JUSTIFICATION_LABEL = 'sem justificativa'
export const NO_JUSTIFICATION_HINT: string
export const DIVERGENCE_LEGEND: string

export function classifyDivergence(values: readonly ScaleValue[]): CellDivergence
export function isDivergent(kind: CellDivergence): boolean
export function divergenceLabel(kind: CellDivergence): string
export function divergenceTone(kind: CellDivergence): DivergenceTone
export function divergenceMeaning(kind: CellDivergence): string
```

```ts
// (tabs)/rounds/review-groups.ts
export type ReviewNote = {
  projectMemberId: string
  evaluatorName: string
  value: ScaleValue
  justification: string | null
}
export type CellNote = ReviewNote & { definitionId: string; criterionId: string }
export type ReviewCell<C> = {
  criterion: C
  isGeneral: boolean
  notes: ReviewNote[]
  divergence: CellDivergence
}
export type ReviewGroup<D, C> = { definition: D; cells: ReviewCell<C>[]; divergent: number }

export function reviewGroups<D extends DefinitionKey, C extends CriterionKey>(
  definitions: readonly D[],
  criteria: readonly C[],
  notes: readonly CellNote[],
): ReviewGroup<D, C>[]
export function divergentCells(groups: readonly ReviewGroup<unknown, unknown>[]): number
export function ratedCells(groups: readonly ReviewGroup<unknown, unknown>[]): number
```

**O que a tela precisa saber:**

- `DivergenceTone` é um subconjunto de `BadgeTone` de propósito: o valor vai direto no `tone` do
  `Badge`, sem de/para no componente.
- `divergenceTone` devolve `neutral` para `unrated` **e** para `single`. Marca de divergência na
  célula é `isDivergent(cell.divergence)`, nunca o tom.
- `reviewGroups` descarta nota cujo par definição × critério não existe na versão de codebook
  recebida, e a `ReviewNote` que sai na célula **não** repete `definitionId`/`criterionId` — a
  célula é quem os tem. Para a #66 encostar a anotação na célula, o par vem de
  `group.definition.id` com `cell.criterion.id`.
- As notas já chegam ordenadas por `evaluatorName` (`localeCompare` em `pt-BR`) e, em empate, por
  `projectMemberId`; a tela não reordena.
- `group.divergent` é a contagem de células divergentes do grupo — é o que o cabeçalho mostra e o
  que decide se o `<details>` nasce aberto (`open={group.divergent > 0}`).
- `ratedCells` conta célula com pelo menos uma nota (`divergence !== 'unrated'`), não nota nem
  avaliador.
- `divergenceMeaning` e `DIVERGENCE_LEGEND` já citam `scaleLabel` — a legenda é a frase única do AC
  e não precisa de texto novo na página. `NO_JUSTIFICATION_HINT` é o `title` do "sem justificativa".
- A Parte 2 continua devendo `QueueNav` em `app/components/ui/` e o par
  `review-groups.ts` → `review-groups-list.tsx`: a Parte 1 não criou componente nenhum.

---

# Parte 2 — A tela da rodada

**Objetivo:** `/projects/[id]/rounds/[roundId]` existe, o Administrador chega nela pela lista de
rodadas, navega entre as respostas pelo rótulo fixo, vê todas as células com as divergentes marcadas
e lê as justificativas na própria célula.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 2 herda" da Parte 1,
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`,
`(tabs)/rounds/page.tsx`, `(tabs)/rounds/agreement.ts` (como modelo de loader),
`(tabs)/evaluate/page.tsx` (como modelo de tela com navegação), `pipeline/access.ts` e
`app/components/ui/{disclosure,card,badge,empty-state,alert,prose}.*`.

### 2.1 `(tabs)/rounds/review.ts` — as leituras

Loader de servidor, no mesmo desenho de `agreement.ts` (`DbExecutor`, guarda de `isUuid`, sem
`notFound` aqui dentro):

```ts
export type ReviewRound = {
  id: string
  roundNumber: number
  status: string
  closedAt: string | null
  codebookVersionId: string
  codebookVersionNumber: number
}

export async function loadReviewRound(projectId, roundId, db): Promise<ReviewRound | null>
export async function loadResponseNotes(responseId, db): Promise<CellNote[]>
export async function listEvaluatedRoundIds(projectId, memberId, db): Promise<string[]>
```

- `loadReviewRound` casa `rounds.id` **e** `rounds.projectId` na mesma consulta: rodada de outro
  projeto não é "sem permissão", é inexistente.
- `loadResponseNotes` junta `scores` → `evaluations` → `project_members` → `profiles`, filtrando por
  `evaluations.responseId`. **Sem filtro de `status` do vínculo** (§ 3). Descartar valor fora da
  escala com `isScaleValue`, como `toObservation` já faz.
- `listEvaluatedRoundIds` é o que a Parte 3 usa para o Avaliador; nasce aqui porque a Parte 2 já
  precisa dele na autorização.

### 2.2 `(tabs)/rounds/review-access.ts` — a autorização

```ts
export type ReviewAccess = {
  project: PipelineProject
  isAdmin: boolean
  memberId: string | null
}

export async function requireReviewAccess(projectId, userId, db): Promise<ReviewAccess>
export async function requireReviewableRound(access, roundId, db): Promise<ReviewRound>
```

- `requireReviewAccess` compõe `loadPipelineAccess` com uma consulta do vínculo **ativo** de avaliador.
  Projeto inexistente → `notFound`. Nem administrador nem avaliador ativo → `notFound`. Vínculo em
  `pending_onboarding` e sem papel de administrador → `redirect` para o onboarding, como as demais
  telas fazem.
- `requireReviewableRound` devolve a rodada, ou `notFound` quando ela não é do projeto; e, para quem
  **não** é administrador, quando `listEvaluatedRoundIds` não contém aquela rodada. Administrador que
  também é avaliador passa pelo ramo de administrador — vê tudo.
- A rodada **aberta** passa na autorização: quem tem direito de vê-la recebe a frase da § 3, e isso é
  decisão da página, não da autorização.

### 2.3 `(tabs)/rounds/[roundId]/page.tsx`

- `params` e `searchParams` são `Promise` (Next 16). `searchParams: { response?: string }`.
- Uma `transaction` só: `requireReviewAccess` → `requireReviewableRound` → `listRoundResponses` →
  `loadCodebookVersion(projectId, round.codebookVersionId)` → `loadResponseNotes(responseIdEmFoco)`.
  Carregar as notas **só da resposta em foco**, e não da rodada inteira: a tela mostra uma resposta por
  vez, e a rodada pode ter dezenas.
- Rótulos: `listRoundResponses` na ordem de criação, `responseLabel(índice)` para cada uma. A resposta
  em foco é a do `?response=`, ou a primeira quando o parâmetro falta ou não é daquela rodada.
- Anterior e próxima saem dos vizinhos **nessa** ordem, não de `neighbours` da fila embaralhada.
- Rodada aberta → `EmptyState` dizendo que a revisão abre quando a rodada fechar, sem carregar nota
  nenhuma.
- Rodada fechada e sem resposta, ou versão de codebook sem célula → `EmptyState` próprio, e não uma
  tabela vazia.
- **Nada de `lib/agreement`, nada de `loadProjectObservations`, nada de `AgreementPanel`** nesta rota
  (§ 3).

### 2.4 `(tabs)/rounds/review-groups-list.tsx`

Componente de servidor, sem estado, no par `review-groups.ts` → `review-groups-list.tsx` (mesma
convenção de `agreement-matrix.ts` → `agreement-matrix-table.tsx`):

- Um `Disclosure` por definição. Resumo: título da definição, o tipo em `Badge` neutro e a contagem de
  divergências do grupo ("2 de 3 células divergem" / "nenhuma divergência"). `defaultOpen` quando
  `divergent > 0`.
- Dentro, uma `Card` por célula: nome do critério, `Badge tone="neutral"` de "geral" quando for, e o
  `Badge` de divergência com `divergenceLabel` e `divergenceTone`, com `divergenceMeaning` no `title`.
- Dentro da célula, uma linha por nota: nome do avaliador, `Badge` da escala com `scaleLabel` e
  `scaleTone`, e a justificativa — no `title` para o hover, e dentro de um `Disclosure` para a
  expansão, em caixa com `scrollBoxClass` e `preWrapClass`. Sem justificativa → `NO_JUSTIFICATION_LABEL`
  em tom `muted`, com `NO_JUSTIFICATION_HINT` no `title`.
- `DIVERGENCE_LEGEND` uma vez, abaixo da lista.
- Em 375px nada rola na horizontal: os nomes e notas quebram em linha, e só as caixas de texto rolam,
  na vertical.

### 2.5 Entrada pela lista de rodadas

`round-list.tsx` ganha, em cada rodada **fechada**, um `OpenLink` "Abrir revisão" para
`/projects/[id]/rounds/[roundId]`. Rodada aberta não ganha link — a revisão só abre depois do
fechamento, e oferecer o link seria convidar para a frase de "ainda não". O componente passa a receber
`projectId`.

### 2.6 Testes da Parte 2 (`(tabs)/rounds/[roundId]/page.int.test.ts`)

No desenho dos testes vizinhos (`findElement`, `textOf`, `markupTextOf`, helpers de `@/test/helpers`):

- **Todas as células aparecem, com as divergentes marcadas** (AC): cena com duas definições e um
  critério geral, duas avaliações; o texto renderizado tem todas as células, e só as divergentes
  carregam o rótulo de divergência.
- **Adjacente e extrema se distinguem** (AC): Alto com Médio numa célula e Alto com Baixo em outra →
  rótulos diferentes; e a legenda que explica a diferença está na tela.
- **Nome real por nota** (AC): o nome do perfil de cada avaliador aparece ao lado da nota dele.
- **Célula sem justificativa diz isso** (AC): nota gravada com `justification: null` → o texto contém
  "sem justificativa", e a célula não fica vazia.
- **Notas de vínculo desativado continuam aparecendo**: avaliador desativado depois de avaliar; a nota
  e o nome dele seguem na tela.
- **Rótulo fixo por ordem de criação**: a segunda resposta criada é "Resposta 2" para qualquer
  visitante, e a navegação anda nessa ordem.
- **A resposta em foco vem da URL**: `?response=<id da segunda>` mostra a segunda; sem parâmetro, ou
  com id de outra rodada, mostra a primeira.
- **Rodada aberta não abre a revisão** (AC): a tela explica que a revisão abre no fechamento, e não
  mostra nota nenhuma.
- **Rodada de outro projeto, e id que não é UUID → `notFound`**.
- **Quem não é membro → `notFound`**.
- **A tela não fala de coeficiente**: o texto renderizado não contém "Krippendorff", "ICR", "Alpha"
  nem "Concordância" — vale para o Administrador também (§ 3), e é o teste que a Parte 3 reaproveita
  para o Avaliador.

### Pronto quando

`npm test`, `npm run lint` e `npm run typecheck` verdes; o Administrador abre a revisão de uma rodada
fechada pela lista, navega entre as respostas e lê justificativa em célula. Conferir no navegador
(`npm run dev:local`) em 1100px e 375px — lembrando que o screenshot sai preto pelo problema conhecido
do preview, então a conferência é por `get_page_text` e geometria via `javascript_tool`.

### O que a Parte 3 herda

_(preencher ao fim da Parte.)_

---

# Parte 3 — O acesso do Avaliador

**Objetivo:** o Avaliador chega à revisão das rodadas em que avaliou, e só delas, e não vê coeficiente
nenhum. O Administrador continua vendo tudo.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 3 herda" da Parte 2,
`app/projects/[id]/project-tabs.tsx`, `(tabs)/rounds/page.tsx`, `(tabs)/rounds/page.int.test.ts` e
`(tabs)/evaluate/access.ts`.

### 3.1 A lista de rodadas revisáveis

Em `review.ts`:

```ts
export type ReviewableRound = { id: string; roundNumber: number; closedAt: string }

export async function listReviewableRounds(projectId, memberId, db): Promise<ReviewableRound[]>
```

Rodadas **fechadas** do projeto em que aquele vínculo tem ao menos uma avaliação, em ordem de
`roundNumber`. Um `innerJoin` com `evaluations` e `distinct`, não N+1.

### 3.2 O ramo de Avaliador em `(tabs)/rounds/page.tsx`

- A `transaction` carrega `loadPipelineAccess` primeiro e passa a guardar as leituras de administração
  atrás de `access.isAdmin` — o Avaliador não recebe codebook, prompt, itens, esforço nem observações.
- Fora da transação, dois ramos: administrador → exatamente a tela de hoje, via `requirePipelineAdmin`;
  senão, vínculo ativo de avaliador → `<EvaluatorRounds/>`; senão, `notFound` (e o `redirect` de
  onboarding continua onde está).
- `(tabs)/rounds/evaluator-rounds.tsx`: uma `Section` com a lista de rodadas revisáveis — "Rodada N",
  "fechada em <data>" e o link para a revisão. Sem versão de codebook (o Avaliador não tem a aba de
  codebook), sem estado de rodada aberta, **sem coeficiente**. `EmptyState` quando não há nenhuma,
  dizendo que a revisão de uma rodada aparece aqui depois que ela fecha.

### 3.3 A aba "Rodadas" para o Avaliador

Em `project-tabs.tsx`, a aba vira link quando `isAdmin || isEvaluator`; a versão desabilitada com
"Ainda não implementado" fica só para quem é membro sem nenhum dos dois papéis ativos. Nada de rótulo
novo: é a mesma área, com conteúdo diferente por papel.

### 3.4 O caminho a partir de "Avaliar" (opcional)

Quando a rodada fecha, a tela de avaliar cai no estado de espera. Se couber sem inchar a fatia,
acrescentar ali um link para a revisão da última rodada revisável — é o momento exato em que o
Avaliador quer entender onde se afastou do grupo. Fora dos ACs; cortar sem dó se a Parte crescer.

### 3.5 Glossário

Em `docs/CONTEXT.md`:

- Entrada nova **Divergência**, na seção de pipeline e avaliação: célula sem unanimidade entre os
  avaliadores considerados; *adjacente* (distância 1) costuma indicar fronteira borrada da escala;
  *extrema* (Alto com Baixo, inclusive quando as três notas aparecem) costuma indicar definição
  ambígua; célula com uma nota só não é nem divergência nem unanimidade.
- Entrada nova **Revisão de discordâncias**: a leitura por rodada, que abre no fechamento, mostra todas
  as células com as divergentes destacadas, é presa à rodada, e é onde o Avaliador entra sem ver
  coeficiente. Apontar para a anonimização que já está em "Em aberto".
- Na entrada **Rótulo da resposta**, nada muda: ela já diz que é o que permite discutir uma resposta
  específica na revisão de discordâncias — agora é verdade.

### 3.6 Testes da Parte 3

Em `(tabs)/rounds/[roundId]/page.int.test.ts` e `(tabs)/rounds/page.int.test.ts`:

- **O Avaliador não alcança rodada em que não avaliou** (AC e teste pedido pelo issue): duas rodadas
  fechadas, ele avaliou só na primeira → a segunda dá `notFound`, e a primeira abre.
- **O Avaliador não vê coeficiente** (AC): o texto renderizado da revisão e o do `/rounds` dele não
  contêm "Krippendorff", "ICR", "Alpha" nem "Concordância", numa cena que **tem** avaliação de dois
  avaliadores — a cena vazia passaria mesmo se vazasse.
- **O Administrador vê tudo** (AC): administrador que nunca avaliou abre a revisão de uma rodada
  qualquer do projeto.
- **A lista do Avaliador só traz rodada fechada em que ele avaliou**: a rodada aberta não aparece, a
  rodada de outro avaliador não aparece, e a lista está em ordem crescente.
- **Avaliador sem nenhuma avaliação** vê o `EmptyState`, e nenhum link.
- **O `/rounds` do Avaliador não traz a gestão de rodada**: nada de `NewRound`, `CloseRound` ou
  `GenerateResponses` na árvore.
- **Quem não é membro continua em `notFound`** nas duas rotas.

### Pronto quando

`npm test`, `npm run lint` e `npm run typecheck` verdes; o Avaliador entra pela aba "Rodadas", abre só
as rodadas em que avaliou e não vê coeficiente; o Administrador continua com a tela de hoje.
Conferir no navegador com os dois papéis (`/dev/login` para trocar de usuário). Fechar a #64 com
referência ao commit, como nas fatias anteriores.

### O que ficou desta Parte

_(preencher ao fim da Parte: o que divergiu, o que ficou de pé e o que foi conferido no navegador.)_

---

## 5. Riscos e pontas soltas

**A matriz da #63 continua só na rodada em foco.** Agora que `/rounds/[roundId]` existe, levar
`AgreementPanel` e `AgreementMatrixTable` para lá — atrás de `isAdmin` — fecha a ponta solta que a #63
registrou e torna qualquer rodada antiga legível. Ficou **fora** desta fatia de propósito (§ 3): não é
AC da #64 e tornaria a invisibilidade do Avaliador uma condição dentro da página em vez de uma
propriedade dela. É fatia futura barata: os dois componentes já recebem tudo por parâmetro.

**Carregar uma resposta por vez é uma consulta por navegação.** É o desenho certo para a reunião (uma
resposta na tela, uma conversa por vez), mas quem quiser varrer a rodada inteira paga uma ida por
resposta. Se doer, o caminho é a exportação da #67, não uma tela que carrega tudo.

**Rodada com muitos avaliadores fica larga.** A célula lista uma linha por avaliador; com 3 a 5
pessoas, que é o caso do TCC, cabe. Acima disso o caminho é agrupar as notas por valor ("Alto: Ana,
Bruno") em vez de encolher a fonte — decisão para quando aparecer, não agora.

**"Onde a equipe mais divergiu" não existe nesta fatia.** Ordenar respostas ou células pela gravidade
da divergência seria útil e não é AC; fica registrado aqui, junto do "ordenar as células pelo pior
coeficiente" que a #63 deixou anotado — as duas são a mesma fatia futura.

**A anotação de consenso (#66) vai encostar na célula.** Esta fatia não cria nenhum ponto de escrita,
mas deixa a célula como componente identificável, com `definitionId` e `criterionId` à mão. Se a Parte
2 acabar inline-ando a célula dentro do grupo, a #66 vai ter que extrair — anotar no "o que a Parte 3
herda" se isso acontecer.

**Deploy:** nada a fazer. Sem migration, sem variável nova, sem `db push`.
