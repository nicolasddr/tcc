# Plano de implementação — Issue #61: "24b — Tela do avaliador: contexto, navegação, progresso e ordem embaralhada"

Link: https://github.com/nicolasddr/tcc/issues/61
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 23, 24, 25, 26, 32, 33, 34)
Blocked by: #60 (fechada) — "Avaliar uma resposta: notas, justificativa e envio imutável"

**Executado em 2 partes, uma por chat.** As seções 1 a 5 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas cinco seções e só então a sua Parte. A Parte 1 termina com o que a
Parte 2 herda — anote ali o que divergiu, como foi feito nos planos da #60 e do redesenho de telas.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | O que a tela **informa**: ordem embaralhada, rótulo fixo, os quatro estados de espera e o progresso individual | ☑ |
| 2 | O que a tela **faz**: anterior/próxima, avanço automático depois do envio, painel de contexto e cabeçalho | ☐ |

O corte é esse porque a Parte 1 inteira é leitura — módulos puros e renderização, nenhuma escrita e
nenhuma navegação — e a Parte 2 é tudo o que mexe no fluxo. Progresso e estado "você terminou" são a
mesma tira na tela, então vivem na mesma Parte; separá-los deixaria a Parte 1 entregando meia faixa.

Decisões de domínio já registradas: ADR 0008 (Administrador-avaliador), ADR 0009 (imutabilidade e
vínculo de membro), ADR 0010 (escala fixa), ADR 0011 (ICR invisível ao avaliador). **Uma ADR nova é
proposta** na § 5 — a ordem embaralhada, porque o AC da história 34 exige que a decisão
metodológica fique registrada, e o que o PRD tem hoje é uma nota de implementação sem o porquê.

---

## 1. Ponto de partida

A #60 entregou a rota, o formulário e o envio imutável. Esta fatia não cria tabela nenhuma: ela é
quase toda módulo puro mais tela, e o único loader novo é o do painel de contexto. O que já está
pronto e vai ser reaproveitado:

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Rota canônica com `?response=<id>` | `(tabs)/evaluate/page.tsx` | o seam que a #60 deixou pronto de propósito: a resposta corrente já está na URL |
| Escolha da resposta corrente | `(tabs)/evaluate/queue.ts` (`pickResponseId`, `nextResponseId`) | é o módulo que esta fatia substitui pela fila embaralhada |
| Ids já avaliados por aquele vínculo | `(tabs)/evaluate/evaluation.ts` (`loadEvaluatedResponseIds`) | base do progresso individual e do avanço automático |
| Guarda de acesso do avaliador | `(tabs)/evaluate/access.ts` (`requireEvaluator`) | ganha o nome do avaliador para o cabeçalho |
| Respostas da rodada | `pipeline/responses.ts` (`listRoundResponses`, `loadRoundResponse`) | a ordem canônica (que dá o rótulo) e o texto da resposta corrente |
| Prompt de uma versão | `pipeline/prompt.ts` (`loadPromptVersion`) | o painel de contexto lê daqui, pela versão que a **resposta** gravou |
| Regra de codebook completo | `pipeline/criteria.ts` (`definitionsWithoutCriteria`) e `rounds/preconditions.ts` (`roundBlockers`) | a mesma regra que barra abrir rodada decide o estado "ainda montando o codebook" |
| Redirect fora da transação | `app/onboarding/actions.ts:73` e `:172` | prior art obrigatório para o avanço automático (ver § 3) |
| Barra de progresso | `app/components/ui/stat.tsx` (`ProgressBar`) | o indicador da história 33 sai sem CSS novo |
| Painel retrátil | `app/components/ui/disclosure.tsx` (`Disclosure`) | `<details>` nativo, e é justamente por isso que o painel não perde o preenchido |

### O que esta issue NÃO faz

Não mexe em schema, não mexe na action de escrita a não ser pelo avanço automático, não toca no
cálculo de ICR (#62) e não mostra nada do grupo ao avaliador (ADR 0011). O modo leitura da resposta
já avaliada é como a #60 deixou; esta fatia só muda **como se chega** nele.

---

## 2. A fila do avaliador: ordem embaralhada e rótulo fixo

Duas ordens convivem na mesma tela, e confundi-las é o erro que esta seção existe para evitar.

**Ordem canônica** — `createdAt` crescente, a de `listRoundResponses`. É igual para todo mundo e
dela sai o **rótulo**: a resposta na posição *n* é "Resposta *n*", para sempre e para todos. É o que
faz "a resposta 3 dividiu o grupo" significar a mesma coisa na discussão.

**Ordem do avaliador** — a fila embaralhada, própria de cada vínculo, estável entre visitas. É a
ordem de anterior/próxima e do avanço automático. Não aparece como número em lugar nenhum da tela.

### Embaralhar por chave, e não por Fisher-Yates

A forma óbvia — semear um gerador com `(vínculo, rodada)` e rodar Fisher-Yates sobre a lista — tem
um defeito que só aparece em uso real: o sorteio de cada troca depende do **tamanho** da lista, então
gerar uma resposta nova no meio da rodada reembaralha tudo, e o avaliador que já viu metade da fila
volta a uma ordem diferente. Isso quebra o AC "estável entre visitas" exatamente no cenário que a
história 33 prevê ("o total pode crescer").

A forma que sobrevive ao crescimento é dar a **cada resposta uma chave independente** e ordenar por
ela:

```
chave(resposta) = hash(memberId + roundId + responseId)
fila = respostas ordenadas por chave crescente, desempate pela ordem canônica
```

Resposta nova entra no lugar que a chave dela mandar e não desloca as outras. A função é pura,
determinística, não precisa de coluna no banco nem de linha gravada, e dois avaliadores diferentes
produzem filas diferentes porque o `memberId` entra no hash.

Hash: FNV-1a de 32 bits sobre a string concatenada, escrito à mão em `shuffle.ts` (umas dez linhas).
Não usar `Math.random`, não usar `crypto` (assíncrono no browser, e isto roda no servidor **e**
precisa ser testável sem mock), não usar dependência nova.

### O desempate não é decorativo

`listRoundResponses` ordena só por `createdAt`, e `responses.created_at` é `defaultNow()` — duas
respostas gravadas na mesma transação recebem o **mesmo** timestamp. Hoje a geração persiste uma a
uma, então na prática elas diferem; nas fixtures de teste não. Ordem canônica instável significa
rótulo instável, que é o oposto do que o AC pede.

Acrescentar `asc(responses.id)` como segundo critério em `listRoundResponses`. O índice
`rs_round_created` continua servindo, e nada mais no repo depende da ordem antiga.

---

## 3. Avanço automático: onde o `redirect` pode e onde não pode

A história 32 pede que o envio leve à próxima resposta ainda não avaliada. Como a rota é canônica
desde a #60, isso é uma navegação, e o lugar dela é o fim de `submitEvaluation`.

**A armadilha:** `redirect()` do Next funciona lançando control-flow. Chamado **dentro** do callback
de `transaction(...)`, ele aborta a transação e desfaz a avaliação que acabou de ser gravada — o
avaliador veria a próxima resposta com o envio perdido em silêncio. O repo já documenta isso em
`app/onboarding/actions.ts:73`. A transação calcula e devolve o destino; o `redirect` acontece
depois que ela commitou, ao lado do `revalidatePath` que já existe.

Sem próxima não avaliada, não há para onde ir: a action devolve `{ ok: true, nonce }` como hoje, a
resposta corrente aparece em leitura e o estado de espera "você terminou" (§ 4) entra embaixo.

**Consequência:** no caminho do redirect o `useActionState` é descartado com a página, e o "Avaliação
enviada" da #60 some. Sem confirmação, o avaliador vê a tela trocar sozinha e não sabe se o envio
passou. A confirmação viaja na URL como `?sent=1`, e a página renderiza um `Alert` de sucesso no
servidor. Sem `useEffect`, e sem depender do estado da action — vale lembrar que
`react-hooks/set-state-in-effect` proíbe a alternativa.

**O `sent` não pode contaminar o redirect canônico.** A página redireciona para a rota canônica
sempre que a URL não traz a resposta corrente; esse redirect nunca carrega `sent`, senão um F5
ressuscita a confirmação de um envio antigo.

### Envolver ou não a fila

O avanço automático escolhe a próxima **na ordem do avaliador**, varrendo para frente a partir da
corrente e **dando a volta** no fim da fila. Sem a volta, quem enviar a última da fila para sem
motivo, com respostas pendentes lá atrás — e o AC diz "a próxima ainda não avaliada por mim", não "a
próxima depois desta". Anterior/próxima, ao contrário, **não** dão a volta: são navegação
posicional, e a ponta da fila tem que parecer a ponta.

---

## 4. Os quatro estados de espera

Uma função pura decide qual deles vale, com a mesma regra que o Administrador vê do outro lado.

| Estado | Quando | O que a tela diz |
|---|---|---|
| `codebook` | não há rodada aberta **e** o codebook do projeto está incompleto (sem definição, ou com definição sem critério), ou a fase ainda é anterior à 2 | o administrador ainda está montando o codebook |
| `round` | não há rodada aberta e o codebook está completo | está aguardando o administrador abrir uma rodada |
| `responses` | rodada aberta, nenhuma resposta gerada | a rodada foi aberta e está aguardando as respostas |
| `finished` | rodada aberta, todas as respostas dela já avaliadas por mim | você terminou, e a rodada aguarda o fechamento |

A ordem da checagem é essa, e é o que evita dizer "aguardando respostas" para quem nem codebook tem.

**Codebook completo é uma regra só.** Hoje a condição vive em `roundBlockers`
(`rounds/preconditions.ts:37`) como `definitions.length === 0 || definitionsWithoutCriteria(...)`.
Extrair `isCodebookComplete(definitions, criteria)` para `pipeline/criteria.ts` e usar nos dois
lados. Duas cópias da mesma regra é como a tela do avaliador passa a dizer "ainda montando" de um
codebook que o Administrador já consegue congelar.

O `finished` é o único que **não** substitui a tela: a resposta corrente continua visível em
leitura, e a mensagem entra como faixa junto do progresso. Trocar a tela inteira esconderia a última
avaliação enviada no instante em que ela foi enviada.

A guarda `cells.length === 0` que existe hoje em `page.tsx` (versão congelada sem critério nenhum)
passa a cair no texto do `codebook`, em vez de ter mensagem própria. É defesa contra dado
inconsistente, não um quinto estado.

---

## 5. Documentação de domínio

**`docs/CONTEXT.md`** (tracked) ganha dois verbetes na seção "Pipeline e avaliação", porque as
Partes 1 e 2 passam a usar as duas palavras em nome de função, de teste e de tela:

- **Fila do avaliador** — a sequência em que um Avaliador vê as Respostas de uma Rodada. É própria de
  cada vínculo, embaralhada de forma determinística e estável entre visitas, inclusive quando o
  Administrador gera mais respostas. Não é a ordem em que as respostas foram criadas.
- **Rótulo da resposta** — o nome fixo de uma Resposta dentro da Rodada ("Resposta 3"), derivado da
  ordem de criação e igual para todos os avaliadores, independente da posição na fila de cada um. É
  o que permite discutir uma resposta específica na revisão de discordâncias.

**ADR 0012 — Ordem embaralhada por avaliador, com rótulo fixo.** O AC da história 34 diz que a
decisão metodológica "fica registrada no documento", e o que existe hoje é uma linha na
"Decisões de Implementação" do PRD que descreve o *como* sem o *porquê*. A ADR registra: com cinco
ou mais respostas, efeito de ordem e fadiga entram correlacionados no coeficiente se todos veem a
mesma sequência, e o resultado é concordância falsa; o rótulo fica fora do embaralhamento porque a
discussão posterior precisa de um nome comum. Registra também a escolha de embaralhar por chave
independente em vez de permutação, pela razão da § 2.

⚠️ `docs/adr/` está no `.gitignore` deste repo (`.gitignore:55`). A ADR é escrita e fica local, como
as outras onze. Os verbetes do `CONTEXT.md` e este plano são o que entra no commit.

---

# Parte 1 — O que a tela informa: fila, rótulo, esperas e progresso

**Objetivo:** a fila certa, o rótulo comum, as quatro mensagens de espera e o quanto falta. Nada
nesta Parte navega, e nada nesta Parte escreve no banco — é a metade de leitura da issue, e é onde
moram os três módulos puros mais interessantes de testar.

**Ler antes:** `AGENTS.md`, as seções 1, 2, 4 e 5 deste plano, `(tabs)/evaluate/queue.ts` e
`queue.unit.test.ts`, `(tabs)/rounds/preconditions.ts` (`roundBlockers`, e o padrão de blocker com
mensagem separada), `app/components/ui/stat.tsx` (`ProgressBar`) e `(tabs)/evaluate/page.int.test.ts`
(o helper `open()`, que segue o redirect canônico).

### 1.1 `evaluate/shuffle.ts` — o embaralhamento determinístico

```ts
/** FNV-1a 32 bits. Determinístico, sem dependência e sem estado. */
export function hash32(text: string): number

/** Chave de ordenação de uma resposta na fila de um vínculo. */
export function orderKey(memberId: string, roundId: string, responseId: string): number
```

Módulo próprio, e não uma função escondida em `queue.ts`, porque é a peça que o teste de
determinismo interroga diretamente e a que a ADR 0012 descreve.

### 1.2 `evaluate/queue.ts` — reescrito em volta da fila

O `pickResponseId`/`nextResponseId` da #60 eram o seam declarado para esta issue. Substituir por:

```ts
export type QueuedResponse = { id: string; label: string; evaluated: boolean }

/** Fila do avaliador: rótulo pela ordem canônica, ordem pela chave do vínculo. */
export function buildQueue(
  responses: readonly { id: string }[],   // já na ordem canônica
  evaluated: readonly string[],
  memberId: string,
  roundId: string,
): QueuedResponse[]

/** Resposta corrente: a pedida se for da rodada, senão a 1ª não avaliada da fila, senão a 1ª. */
export function pickResponseId(queue: readonly QueuedResponse[], requested?: string | null): string | null
```

`buildQueue` é a única porta: rótulo e ordem nascem juntos, e nenhuma tela consegue usar um sem o
outro. `nextResponseId` sai daqui e volta na Parte 2 com forma nova.

### 1.3 `evaluate/waiting.ts` — os quatro estados

```ts
export type WaitingState =
  | { key: 'codebook' }
  | { key: 'round' }
  | { key: 'responses'; roundNumber: number }
  | { key: 'finished'; roundNumber: number; total: number }

export type WaitingInputs = {
  phase: number
  definitions: readonly DefinitionKey[]
  criteria: readonly CriterionScope[]
  openRound: { roundNumber: number } | null
  total: number
  evaluated: number
}

export function waitingState(inputs: WaitingInputs): WaitingState | null
export function waitingMessage(state: WaitingState): string
```

Estado e mensagem separados, como `roundBlockers`/`roundBlockerMessage`: o teste afirma o estado sem
depender de redação, e a redação é conferida uma vez só.

### 1.4 `evaluate/progress.ts` — o indicador

```ts
export type Progress = { evaluated: number; total: number }
export function progressMessage(progress: Progress): string
```

Texto: quantas **eu** avaliei sobre o total da rodada, mais a frase que deixa explícito que o total
pode crescer se o Administrador gerar mais respostas. Usar `plural` de `lib/plural.ts`. O número sai
de `loadEvaluatedResponseIds(roundId, memberId)`, que já filtra pelo vínculo — o progresso é
individual por construção, e um teste prova que a avaliação de um colega não move a minha barra.

### 1.5 `pipeline/criteria.ts` — `isCodebookComplete`

```ts
export function isCodebookComplete(
  definitions: readonly DefinitionKey[],
  criteria: readonly CriterionScope[],
): boolean
```

`roundBlockers` passa a usá-la (mantendo os blockers `definition` e `criteria` como estão, para não
perder o detalhe de *quais* definições estão descobertas — a tela do Administrador precisa disso, a
do Avaliador não).

### 1.6 `pipeline/responses.ts` — desempate da ordem canônica

`listRoundResponses`: `orderBy(asc(responses.createdAt), asc(responses.id))`. Um caso no teste de
integração prova que duas respostas com o mesmo `created_at` saem sempre na mesma ordem.

### 1.7 `evaluate/page.tsx`

- carrega o codebook **corrente** do projeto (`loadCodebook`) só quando não há rodada aberta — é o
  único caminho em que o estado `codebook` pode valer;
- monta a fila com `buildQueue` e escolhe a corrente com `pickResponseId`;
- renderiza `waitingMessage(...)` num `EmptyState` quando o estado for `codebook`, `round` ou
  `responses`;
- renderiza, acima do formulário, a tira de progresso: o rótulo da resposta corrente, a
  `ProgressBar` e `progressMessage`. No estado `finished` a tira ganha a mensagem de que terminei e a
  rodada aguarda o fechamento, **sem** substituir a tela: a resposta corrente continua visível em
  leitura, porque trocar tudo esconderia a última avaliação no instante em que ela foi enviada;
- passa o rótulo da resposta corrente para o formulário, que o exibe no `ResponseCard` no lugar de
  ficar só com o nome do item.

O redirect para a rota canônica e o link "Avaliar a próxima resposta" continuam como a #60 deixou —
o link só sai na Parte 2, quando os controles de verdade existirem.

### Testes da Parte 1

- [ ] `shuffle.unit.test.ts`: `orderKey` é estável entre chamadas; muda com o vínculo; muda com a
      rodada; não colide para ids diferentes num lote realista.
- [ ] `queue.unit.test.ts`: a fila é estável entre chamadas com as mesmas entradas; dois vínculos
      produzem **ordens diferentes** sobre as mesmas respostas; **acrescentar uma resposta não muda a
      posição relativa das anteriores** (o teste que justifica a § 2); o rótulo segue a ordem
      canônica e não a da fila; o rótulo do id X é igual para dois vínculos diferentes;
      `pickResponseId` respeita a pedida, cai na primeira não avaliada da fila e, sem nenhuma, na
      primeira da fila.
- [ ] `waiting.unit.test.ts`: os quatro estados, a precedência entre eles, e `null` quando há
      trabalho a fazer; fase anterior à 2 cai em `codebook`; rodada aberta com codebook incompleto
      **não** cai em `codebook`.
- [ ] `progress.unit.test.ts`: singular e plural; zero avaliadas; tudo avaliado.
- [ ] `criteria.unit.test.ts`: `isCodebookComplete` com definição sem critério, com critério geral
      cobrindo todas e sem definição nenhuma.
- [ ] `page.int.test.ts`: os quatro estados de espera pela borda da página, cada um com a sua
      mensagem; a barra conta só as minhas avaliações, com um colega tendo avaliado mais que eu;
      dois avaliadores no mesmo projeto recebem primeira resposta diferente (fixar os ids da fixture
      e usar respostas suficientes para a coincidência ser improvável; se preferir, comparar a fila
      inteira em vez da primeira).
- [ ] `responses.int.test.ts` (ou onde `listRoundResponses` já é testada): o desempate por id.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. A tela ainda não tem anterior/próxima nem
painel de contexto, mas já abre na fila certa, mostra o rótulo, explica as quatro esperas e diz
quanto falta.

### O que a Parte 2 herda

Os três gates ficaram verdes (`npm run lint`, `npm run typecheck`, `npm test` — 628 testes).

**Assinaturas como ficaram.** Todas iguais ao previsto, com duas adições:

```ts
// evaluate/shuffle.ts
export function hash32(text: string): number
export function orderKey(memberId: string, roundId: string, responseId: string): number

// evaluate/queue.ts
export type QueuedResponse = { id: string; label: string; evaluated: boolean }
export function responseLabel(position: number): string          // ← nova, 0-based
export function buildQueue(
  responses: readonly { id: string }[], evaluated: readonly string[],
  memberId: string, roundId: string,
): QueuedResponse[]
export function pickResponseId(
  queue: readonly QueuedResponse[], requested?: string | null,
): string | null

// evaluate/waiting.ts
export function waitingState(inputs: WaitingInputs): WaitingState | null
export function waitingMessage(state: WaitingState): string

// evaluate/progress.ts
export type Progress = { evaluated: number; total: number }
export function progressMessage(progress: Progress): string

// pipeline/criteria.ts
export function isCodebookComplete(definitions, criteria): boolean
```

**⚠️ O que divergiu: FNV-1a puro não serviu, e o teste pegou.** A § 2 pedia FNV-1a de 32 bits e só.
Com ele, `dois vínculos produzem ordens diferentes` falhou — e não por azar de fixture: nos últimos
bytes da string o FNV-1a quase não avalancha para os bits altos, então respostas cujos ids
compartilham prefixo saem na **mesma ordem para todos os vínculos**, qualquer que seja o `memberId`.
A promessa central da fatia morreria em silêncio com ids sequenciais ou com prefixo comum.
`hash32` ganhou um passo final de avalanche (o finalizador do MurmurHash3, cinco linhas), e
`shuffle.unit.test.ts` tem o caso de regressão (`ids que só diferem no fim ainda embaralham
diferente para cada vínculo`). A ADR 0012 registra o porquê. **A Parte 2 não muda nada disso, mas
não troque a função de hash** — ver "riscos" na § 6.

**`nextResponseId` saiu, e o link paliativo ficou.** Como o plano previa, `nextResponseId` não
existe mais. O link "Avaliar a próxima resposta" da #60 continua na tela, alimentado por um
`queue.find(r => !r.evaluated && r.id !== currentId)` inline em `page.tsx` — deliberadamente **não**
é uma função exportada, para não criar um terceiro "próxima" competindo com `neighbours` e
`nextPendingId`. Na Parte 2, esse `find` sai junto com o link.

**O rótulo entrou no `ResponseCard` como previsto.** `EvaluationForm` ganhou a prop
`label: string` (obrigatória) e o card mostra `label` · `itemName` · data, nessa ordem. Nos dois
modos, leitura e preenchimento.

**A tira de progresso**, em `page.tsx`, é um `div.flex.flex-col.gap-2` imediatamente acima do
`<EvaluationForm>`, com três filhos: uma linha `justify-between` com o rótulo à esquerda e
`progressMessage` à direita, a `ProgressBar`, e — só no estado `finished` — um `<p>` com
`waitingMessage(waiting)`. **É nessa primeira linha que os `ButtonLink` de anterior/próxima
encaixam.**

**A página decide em três degraus** (`page.tsx`): `held` (a espera que substitui a tela — qualquer
`WaitingState` que não seja `finished`) → `!response || cells.length === 0` (a defesa contra dado
inconsistente, que agora usa o texto de `codebook` como a § 4 pediu) → a tela normal. O `finished`
passa reto pelos dois primeiros e entra na tira, sem esconder a última avaliação enviada.

**Só carrega o codebook corrente quando não há rodada aberta**; com rodada, `waitingState` recebe as
definições e critérios da versão **congelada** que a rodada fixou (que a página já carregava para
montar as células). Nesse ramo `waitingState` nem olha para elas, mas passar `[]` seria mentira.

**`roundBlockers` agora gateia por `isCodebookComplete`** e só então decide *qual* blocker emitir
(`definition` ou `criteria`), preservando os títulos das definições descobertas. Nenhum dos 27
testes de `preconditions.unit.test.ts` mudou.

**Testes de página úteis para a Parte 2.** `queueOf(scene, evaluator)` calcula, fora da página, a
fila que aquele vínculo deve ver — é o oráculo para asserção determinística sobre ordem, e
anterior/próxima vão precisar dele. `scenario` ganhou `phase` e `openRound: false` (que devolve
`round: ''` e nenhuma resposta). `findElement(tree, ProgressBar)` lê a barra pelas props.
Continua valendo o aviso do redesenho: `collectText` só anda pelos children.

---

# Parte 2 — O que a tela faz: navegação, avanço automático e contexto

**Objetivo:** o avaliador anda pela rodada sem pensar em URL, nunca fica preso numa resposta, e
julga sabendo o que foi pedido à LLM.

**Ler antes:** `AGENTS.md`, as seções 1, 3 e 5 deste plano, o "o que a Parte 2 herda" da Parte 1,
`app/onboarding/actions.ts:60-80` (redirect fora da transação), `(tabs)/evaluate/actions.ts` inteira,
`pipeline/prompt.ts` (`loadPromptVersion`, `PromptMetadata`), `app/components/ui/disclosure.tsx` e
`app/components/ui/prose.ts`.

### 2.1 `evaluate/queue.ts` — vizinhos e próxima pendente

```ts
/** Anterior e próxima na ordem do avaliador. Não dão a volta. */
export function neighbours(
  queue: readonly QueuedResponse[], currentId: string,
): { prev: string | null; next: string | null }

/** Próxima ainda não avaliada, varrendo para frente e dando a volta. */
export function nextPendingId(
  queue: readonly QueuedResponse[], currentId: string,
): string | null
```

As duas semânticas diferentes de "próxima" são funções diferentes, com nomes diferentes. Fundi-las
num parâmetro booleano é o caminho para alguém passar o valor errado.

### 2.2 `evaluate/actions.ts` — avanço automático

Dentro da transação, **depois** dos inserts, montar a fila daquele vínculo (com os ids já avaliados
incluindo o que acabou de ser gravado) e devolver `nextPendingId(...)` no outcome. Fora da
transação, depois do `revalidatePath`:

```
se destino → redirect(`/projects/${projectId}/evaluate?response=${destino}&sent=1`)
senão      → { ok: true, nonce }
```

⚠️ `redirect` **fora** de `transaction(...)`, pela razão da § 3. O comentário de
`app/onboarding/actions.ts:73` explica o porquê e vale citá-lo na mensagem de commit.

O teste de action passa a precisar do mock de `next/navigation` (hoje só `next/cache` é mockado), no
mesmo formato que `page.int.test.ts` usa: `redirect` lança `NEXT_REDIRECT:<url>`.

### 2.3 `evaluate/page.tsx` — os controles e a confirmação

- acrescenta à tira de progresso da Parte 1 os dois `ButtonLink` de anterior e próxima
  (desabilitados, ou ausentes, nas pontas), apontando para os vizinhos na **minha** ordem;
- lê `?sent=1` e renderiza um `Alert` de sucesso no servidor quando ele vier;
- **nunca** propaga `sent` no redirect para a rota canônica, senão um F5 ressuscita a confirmação de
  um envio antigo;
- remove o link "Avaliar a próxima resposta", que a #60 criou como paliativo declarado.

**A resposta já avaliada continua acessível em leitura** — é o que os controles posicionais
garantem, e o modo leitura já veio pronto da #60. Um teste prova a volta para uma resposta enviada.

### 2.4 `evaluate/context.ts` — o loader do painel

```ts
export type EvaluationContext = {
  prompt: { versionNumber: number; name: string | null; description: string | null; text: string }
  item: { name: string; content: string }
}

export function loadEvaluationContext(
  projectId: string, responseId: string, db?: DbExecutor,
): Promise<EvaluationContext | null>
```

Lê a versão de prompt pelo `responses.prompt_version_id` — a versão que **aquela resposta** gravou —
e não pela da rodada. As duas coincidem hoje, e mesmo assim a da resposta é a correta: é ela que
registra o que foi de fato enviado à LLM, e é a promessa de replicabilidade que a coluna existe para
cumprir. O item vem por join em `input_items` (`name` e `content`).

Um loader novo em vez de inchar `loadRoundResponse`: a tela do Administrador usa `loadRoundResponse`
e não precisa carregar prompt nem conteúdo de item a cada linha da lista.

### 2.5 `evaluate/context-panel.tsx` — o painel retrátil

Server component, renderizado em `page.tsx` **acima e fora** do `<EvaluationForm>`:

- `<Disclosure>` fechado por padrão, com resumo "O que foi pedido à LLM";
- dentro: nome e descrição do prompt **só quando preenchidos**, o número da versão, o texto do
  prompt e o item de entrada com nome e conteúdo;
- cada bloco de texto com `preWrapClass` e o contêiner de rolagem da § 2.6.

**Por que o preenchido não se perde:** `<details>` é HTML nativo. Abrir e fechar não dispara render
do React, e o formulário — que é irmão, não filho — nem fica sabendo. Não usar `useState` para
controlar a abertura: seria trocar uma garantia estrutural por uma que depende de não remontar nada.

### 2.6 `app/components/ui/prose.ts` — rolagem dentro do bloco

```ts
export const scrollBoxClass = '... max-h-... overflow-y-auto ...'
```

Um lugar só para a regra "texto longo rola dentro do próprio bloco", usado em três: o texto do
prompt, o conteúdo do item e o texto da resposta no `ResponseCard` (que hoje tem `preWrapClass` sem
teto de altura — uma resposta de 50 000 caracteres empurra o formulário inteiro para fora da tela).

### 2.7 Cabeçalho com projeto e nome do avaliador

`requireEvaluator` já busca o vínculo; acrescentar o join em `profiles` e devolver `memberName`
junto de `memberId` — sem query nova. A página mostra "Avaliando como <nome>" junto do título da
seção. O nome do projeto já vem do layout das abas (`(tabs)/layout.tsx`), então o AC da história 23
fecha com essa metade.

### Testes da Parte 2

- [ ] `queue.unit.test.ts` (+): `neighbours` nas duas pontas e no meio; `nextPendingId` pula as
      avaliadas, **dá a volta** e devolve `null` quando tudo está avaliado.
- [ ] `actions.int.test.ts` (+): envio com pendente sobrando redireciona para a **próxima da fila
      daquele vínculo**, com `sent=1`; envio da última pendente **não** redireciona e devolve `ok`;
      e — o caso que justifica a § 3 — depois do redirect a avaliação **está gravada** (a asserção
      que pegaria o `redirect` dentro da transação).
- [ ] `context.int.test.ts`: o painel traz o prompt **da versão que a resposta gravou**, mesmo
      quando o projeto já tem versão mais nova; traz o item certo; devolve `null` para resposta de
      outro projeto.
- [ ] `page.int.test.ts` (+): anterior/próxima apontam para os vizinhos na minha ordem e não
      apontam para lugar nenhum nas pontas; voltar para uma resposta já avaliada mostra o modo
      leitura; `?sent=1` mostra a confirmação e o redirect canônico não a carrega; nome e descrição
      do prompt aparecem quando preenchidos e **somem** quando nulos; o conteúdo do item aparece; o
      nome do avaliador aparece no cabeçalho.
- [ ] Um caso de marcação (via `renderToStaticMarkup`) provando que o texto da resposta e o do
      prompt carregam a classe de `whitespace-pre-wrap` — é como o AC de formatação preservada vira
      regressão.

⚠️ Herança do redesenho de telas: `collectText` do teste de página só anda pelos **children**; texto
que vira prop (o `text` do `InfoTooltip`) some das asserções — ler a prop com `findElement`.

### Pronto quando

Os três gates verdes, os doze AC da issue marcados, e o fluxo conferido no app real: abrir, enviar,
ver a tela trocar para a próxima com a confirmação, andar para trás, reler a enviada, abrir o painel
de contexto no meio do preenchimento sem perder nada, e terminar a rodada. Semear à mão um prompt
longo e um item longo para ver a rolagem se comportar. Para conferir logado, usar o
preview/navegador real — o Playwright headless não hidrata.

---

## 6. Riscos e pontas soltas

**O embaralhamento é irreversível na prática.** Ele não é gravado, então mudar a função de hash
depois que uma rodada real começou muda a fila de quem está no meio dela. Não é perda de dado — o
rótulo e as avaliações não dependem da fila — mas é desorientação. Se algum dia a ordem precisar
mudar, o caminho honesto é gravá-la, não trocar a função em silêncio.

**`?sent=1` é estado na URL.** É o preço de não usar efeito. Ele sobrevive a um F5, que mostraria a
confirmação de novo; o mitigante é que ele nunca é reposto por redirect da própria página, então
some na primeira navegação. Se incomodar, a alternativa é não confirmar nada — não é usar `useEffect`.

**`listEvaluatorsNotFinished` continua devolvendo todos os avaliadores ativos.** A #60 deixou isso
explicitamente de fora, e esta fatia não muda a decisão: com `loadEvaluatedResponseIds` e a contagem
de respostas da rodada, dá para excluir quem terminou, mas numa rodada com zero resposta *todo mundo*
terminou vacuosamente e a tela de fechar rodada passaria a dizer que ninguém está pendente. Continua
valendo como issue própria.

**Deploy:** nenhuma migration nesta fatia. Nada a empurrar para o banco de produção.
