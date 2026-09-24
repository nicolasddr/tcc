# Plano de implementação — Issue #71: "32 — Entrada enviada gravada na Resposta"

Link: https://github.com/nicolasddr/tcc/issues/71
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 5, 6 e 25, parte da
entrada enviada)
Blocked by: #70 — **fechada**. A `input` que esta fatia grava já é montada pela fase da rodada em
`generateResponses`.

**A executar em 3 partes, uma por chat.** As seções 1 a 5 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas cinco seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anotar ali o que divergiu, como no plano da #70.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A coluna `responses.sent_input`: schema, migration, helper de teste e uma leitura isolada | ✅ |
| 2 | A geração grava a entrada na mesma escrita do texto | ✅ |
| 3 | A tela: o Administrador lê a entrada, recolhida; o Avaliador não; varredura dos ACs | ✅ |

**Nenhuma ADR nova.** A decisão já está na **emenda de 2026-09-22 da ADR 0002** ("A Resposta grava a
entrada enviada"). O glossário (`docs/CONTEXT.md`, verbetes **Resposta** e **Entrada enviada**) diz
"a partir da Fase 3", mas o AC desta fatia diz "em qualquer fase". O glossário é corrigido na Parte 3
(§ 3, D8).

**Com migration.** A coluna nova em `responses` exige `db push` em prod **antes** do deploy (§ 7).

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Tabela de respostas | `lib/db/schema.ts` (`responses`) | ganha `sentInput` anulável (Parte 1) |
| Geração | `(tabs)/rounds/actions.ts` (`generateResponses`) | já monta `input` por `composeLlmInput` e chama `askLlm(input)`; passa a gravar `sentInput: input` no mesmo `insert` (Parte 2) |
| Leituras de resposta | `pipeline/responses.ts` (`ResponseDetail`, `loadRoundResponse`, `listRoundResponses`) | **não mudam**: `loadRoundResponse` alimenta a tela do Avaliador (§ 3, D3) |
| Composição | `pipeline/llm-input.ts` (`composeLlmInput`) | não muda; é o que os testes comparam |
| Tela de avaliação | `(tabs)/evaluate/page.tsx` + `evaluation-form.tsx` (`ResponseCard`) | é a única tela que mostra o texto de uma resposta hoje, e é **do Avaliador** (`requireEvaluator` exige o vínculo `evaluator`). Não muda |
| Tela da rodada (revisão) | `(tabs)/rounds/[roundId]/page.tsx` (`ReviewView`, `isAdmin`) | Administrador e Avaliador chegam nela. Já tem bloco só do Administrador (`roundInputSummary`, #70). Ganha a entrada enviada da resposta corrente (Parte 3, D1) |
| Painel retrátil | `app/components/ui/disclosure.tsx` (`Disclosure`) | `<details>` nativo, fechado por padrão |
| Classes de texto | `app/components/ui/prose.ts` (`preWrapClass`, `scrollBoxClass`) | mostram o texto como veio, com rolagem |
| Helper de resposta | `test/helpers.ts` (`addResponse`) | ganha `sentInput` opcional (Parte 1) |
| LLM falsa | `(tabs)/rounds/generate-responses.int.test.ts` (`llm.inputs`, `llm.failWhen`) | já captura cada entrada e sabe falhar por entrada. É o que os testes da Parte 2 leem |
| Teste de página da revisão | `(tabs)/rounds/[roundId]/page.int.test.ts` (`render`, `roundWith`) | já testa Administrador × Avaliador na mesma rodada (#70). Ganha os testes da Parte 3 |

O que **falta** e esta fatia cria: a coluna, a gravação, uma leitura que só o Administrador chama e
o bloco recolhido na tela.

---

## 2. A fatia por extenso

### Gravar o que foi, não o que se remontaria

A entrada gravada é **a mesma variável** `input` passada a `askLlm`. Nada de recompor depois, nada de
`trim()`, nada de normalizar quebra de linha. A gravação vai no mesmo `insert` que grava `text`,
`model` e as versões, então não existe resposta nova sem entrada, nem entrada sem resposta.

### A falha não grava nada

Isso já é verdade hoje e continua: toda falha (`llmFailureOf`, `blank`, `too_long`, `ceiling`,
`duplicate`) faz `continue` **antes** ou **no lugar** do `insert`. Como a entrada só entra nos
`values` do `insert`, ela some junto. A Parte 2 só prova isso com teste.

### Respostas antigas

A coluna é anulável só por causa delas. Nenhum backfill: reconstruir a entrada das respostas antigas
está fora do épico (PRD, "Out of Scope"). A tela diz, em uma frase, que a resposta foi gerada antes
desse registro existir.

### Só o Administrador recebe o dado

A garantia é o **fluxo de dados**, como no resto do épico ("nenhuma tela do Avaliador recebe dados
de Qualidade, nem escondidos"). A entrada não entra em `ResponseDetail` nem em nenhum tipo que a tela
do Avaliador carrega. Ela vem de uma função própria, chamada só no ramo `access.isAdmin` da tela da
rodada. Se o Avaliador abre a mesma tela, a consulta nem roda.

---

## 3. Decisões desta fatia

Decisões que o issue e o PRD deixam abertas. Cada uma tem uma recomendação. **As marcadas com ⚠ pedem
confirmação antes da Parte em que entram.**

**D1 ⚠ — Onde fica a "leitura da resposta" do Administrador.** Hoje o Administrador, **como
Administrador**, não lê o texto de resposta nenhuma. O `ResponseCard` só existe em `/evaluate`, que
exige vínculo de avaliador. A tela da rodada mostra as notas, não o texto. Três lugares possíveis:

- **(a) Recomendado: a tela da rodada (`[roundId]/page.tsx`), para a resposta corrente, só com
  `isAdmin`.** É onde o Administrador investiga uma resposta que surpreendeu (a revisão de
  discordâncias), já tem um papel e outro na mesma tela e já tem o padrão `isAdmin` da #70. O teste
  "o Administrador vê; o Avaliador não vê" cai no mesmo arquivo de teste que já compara os dois.
  Limite: a revisão só abre com a rodada **fechada** e com pelo menos uma célula.
- **(b) A lista de respostas geradas da rodada aberta** (`generate-responses.tsx`), transformando
  cada linha num `Disclosure`. Cobre a rodada aberta, mas a lista hoje só tem nome do item e data,
  e não a resposta.
- **(c) `/evaluate`, só quando quem avalia também é Administrador.** Rejeitada: é tela do Avaliador
  (o AC diz "nenhuma tela do Avaliador"), `requireEvaluator` não sabe do papel de administrador, e
  misturaria a leitura de Administrador com a avaliação dele (ADR 0008, o viés).

Com (a), o bloco da resposta corrente ganha, para o Administrador, o **texto da resposta** e, logo
abaixo, a **entrada enviada recolhida**. Mostrar só a entrada, sem a saída ao lado, não serve à
história 6 ("conferir o que a LLM recebeu quando uma resposta me surpreender"). O texto da resposta
também fica só para o Administrador, para não mudar nada para o Avaliador nesta fatia. Se a escolha
for (b), a Parte 3 muda de arquivo, mas não de forma.

**D2 — Nome e tipo da coluna: `sent_input text` (TS `sentInput`), anulável, sem default, sem
CHECK.** O código usa inglês para colunas (`text`, `source`, `model_version`). O PRD dispensa CHECK de
tamanho: a entrada é composta de partes que já têm limite e não vem do usuário.

**D3 — A leitura é uma função própria, fora de `ResponseDetail`.** Em `pipeline/responses.ts`:

```ts
export async function loadSentInput(
  roundId: string,
  responseId: string,
  db: DbExecutor = ownerDb,
): Promise<{ sentInput: string | null } | null>
```

`null` quando a resposta não existe ou não é da rodada; `{ sentInput: null }` quando é antiga.
`loadRoundResponse` **não** ganha o campo, porque alimenta `/evaluate`. Se a D1 (a) trouxer o texto
da resposta para o Administrador, a mesma função pode devolver `{ text, sentInput }` com outro nome
(`loadResponseForAdmin`). Decidir na Parte 1 e anotar.

**D4 — `addResponse` ganha `sentInput?: string | null`, com `null` quando omitido.** Os usos atuais
ficam como respostas "antigas", que é o caso da tela mais fácil de montar. Quem precisar de resposta
nova passa o texto.

**D5 — "Sem formatação adicional" é texto puro em `preWrapClass` + `scrollBoxClass`, como o
`ResponseCard`.** Nada de Markdown, nada de realce dos cabeçalhos (`Definições:`, `Codebook:`), nada
de `trim()` na renderização. Fonte monoespaçada é opcional (conferir no navegador): ajuda a ler o
recuo das descrições, mas não é formatação do conteúdo.

**D6 — A frase da resposta antiga substitui o `Disclosure`, não fica dentro dele.** "A tela diz isso
em vez de mostrar um campo vazio": um painel recolhido que abre para uma frase é um campo vazio
disfarçado. Texto sugerido, constante exportada (`SENT_INPUT_MISSING`):

> Esta resposta foi gerada antes de a ferramenta gravar a entrada enviada.

**D7 — Título do painel: "Entrada enviada à LLM".** Com o `Disclosure` fechado por padrão
(`defaultOpen` ausente).

**D8 — O glossário passa a dizer "a partir do Épico 3", não "a partir da Fase 3".** O AC grava a
entrada "em qualquer fase", então uma resposta de rodada da Fase 2 gerada depois desta fatia também
tem entrada. Corrigir os verbetes **Resposta** ("a partir da Fase 3, a *entrada enviada*") e
**Entrada enviada** ("As respostas geradas antes da Fase 3 não o têm") em `docs/CONTEXT.md`.

**D9 — Resposta colada manualmente não existe ainda.** `generateResponses` é o único `insert` de
`responses` no app (ADR 0003 prevê a colada, mas nenhuma fatia a construiu). Quando existir, ela
não terá entrada enviada, e a frase de D6 ("gerada antes") ficaria errada para ela. Registrar em § 6,
não resolver aqui.

---

## 4. Fronteira com as fatias vizinhas

- **#72 (teste de prompt)** mostra a entrada acima da saída, recolhida, e **não grava nada**. Pode
  reaproveitar o bloco de texto recolhido da Parte 3 se ele virar componente (`SentInputPanel`), mas
  não depende disso.
- **#78 (CSV)** lê `responses.sent_input` e exporta vazio quando `null`. Nada desta fatia precisa
  mudar para isso.
- **#73 a #77** não tocam na entrada.

---

## 5. Convenções que valem em todas as Partes

- Sem comentários novos no código; a explicação vai no commit.
- Sem `npx prettier` (não há config no repo).
- Regra de domínio e corte por papel vão no servidor (na action ou no carregamento da página), nunca
  só escondendo na tela.
- Antes de `npm test`, a tabela `scores` precisa estar vazia (limpar cena de conferência, se houver).
- Um commit por Parte, com a suíte verde (`npm run lint`, `npm run typecheck`, `npm test`).
- Conferir a **ordem** do SQL que o `drizzle-kit generate` emitir, e se ele não trouxe ruído
  (`pg_net`).

---

# Parte 1 — A coluna `responses.sent_input`

**Objetivo:** a coluna existe, as respostas existentes ficam com `null`, os testes conseguem criar
resposta com e sem entrada, e há uma leitura que só devolve a entrada. Nenhuma action nem tela muda.

**Ler antes:** seções 1 a 5, `lib/db/README.md` (fluxo de migration), `lib/db/schema.ts` (tabela
`responses`), `pipeline/responses.ts`, `addResponse` em `test/helpers.ts`,
`pipeline/responses.int.test.ts`.

### 1.1 `lib/db/schema.ts`

Na tabela `responses`, depois de `text`:

```ts
sentInput: text("sent_input"),
```

Sem `.notNull()`, sem default, sem CHECK (D2).

### 1.2 Migration

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' npx drizzle-kit generate
```

O `supabase/migrations/0016_*.sql` gerado deve ter **só**:

```sql
ALTER TABLE "responses" ADD COLUMN "sent_input" text;
```

Sem backfill. Conferir à mão uma vez: com respostas no banco local, `supabase migration up` (não
`db reset`) e `select count(*) from responses where sent_input is not null` dá 0. Depois,
`npm run db:reset`.

### 1.3 `test/helpers.ts` (`addResponse`)

`opts.sentInput?: string | null`, gravado como `opts.sentInput ?? null` (D4).

### 1.4 `pipeline/responses.ts`

`loadSentInput(roundId, responseId, db)` como em D3: `isUuid` nos dois ids, filtro por
`responses.id` **e** `responses.roundId`, `limit(1)`. `ResponseDetail` e `loadRoundResponse` ficam
como estão.

### 1.5 Testes da Parte 1

`pipeline/responses.int.test.ts`:

- [ ] **Resposta com entrada devolve o texto exato**, inclusive com `\r\n`, espaços no fim e linhas
      em branco.
- [ ] **Resposta antiga devolve `{ sentInput: null }`**, não `null` nem string vazia.
- [ ] **Resposta de outra rodada devolve `null`** (o id da rodada faz parte do filtro).
- [ ] **`loadRoundResponse` não traz a entrada**: `Object.keys` do resultado não contém `sentInput`,
      mesmo com a coluna preenchida. É a trava de que a tela do Avaliador não recebe o dado.

### Pronto quando

Lint, typecheck e `npm test` verdes; migration conferida (§ 1.2); nenhuma tela nem action mudou.

### O que a Parte 2 herda

- **Migration:** `supabase/migrations/0016_certain_baron_zemo.sql`, com só
  `ALTER TABLE "responses" ADD COLUMN "sent_input" text;`. Sem ruído de `pg_net`. Conferida com
  `supabase migration up` sobre 3 respostas antigas: 0 com `sent_input` preenchido.
- **A D3 virou `loadResponseForAdmin(roundId, responseId, db)`**, em `pipeline/responses.ts`,
  devolvendo `ResponseForAdmin = { text: string; sentInput: string | null }` (ou `null` quando a
  resposta não existe, não é da rodada ou algum id não é UUID). É o formato que a Parte 3 chama de
  `SentInputView`: pode usar o tipo exportado direto. Motivo: tanto a D1 (a) quanto a (b) precisam
  do texto da resposta ao lado da entrada.
- **`addResponse`** aceita `sentInput?: string | null` e grava `null` quando omitido (D4).
- **Testes** em `pipeline/responses.int.test.ts`, `describe` "a entrada enviada, só na leitura do
  Administrador": texto exato com `\r\n`/espaços no fim/linhas em branco, antiga → `sentInput: null`,
  outra rodada e id inválido → `null`, e `loadRoundResponse` sem a chave `sentInput`.
- Um teste com duas rodadas no mesmo projeto precisa da primeira fechada
  (`rd_one_open_per_project`).

---

# Parte 2 — A geração grava a entrada

**Objetivo:** toda resposta gerada grava `sentInput` na mesma escrita do texto, igual ao que a LLM
recebeu, e nenhuma falha grava nada.

**Ler antes:** seções 1 a 5, `generateResponses` em `(tabs)/rounds/actions.ts`, e o `describe` de
`generate-responses.int.test.ts` (a LLM falsa, `llm.inputs`, `llm.failWhen`, `openRound` com
`projectPhase`/`roundPhase`).

### 2.1 `(tabs)/rounds/actions.ts` (`generateResponses`)

No `insert(responses).values({...})`, uma linha:

```ts
sentInput: input,
```

`input` é a mesma constante passada a `askLlm`. Nenhuma outra mudança: não recompor, não copiar para
outra variável normalizada.

### 2.2 Testes da Parte 2

`(tabs)/rounds/generate-responses.int.test.ts`, com um helper local
`sentInputsOf(roundId)` que lê `responses.inputItemId` + `responses.sentInput` da rodada:

- [ ] **Rodada da Fase 2: a entrada gravada é igual à que a LLM falsa recebeu.** Dois itens; para
      cada resposta, `sentInput` é `toBe` o elemento de `llm.inputs` do mesmo item (casar pelo
      conteúdo do item, não pela ordem).
- [ ] **Rodada da Fase 3: idem**, com `openRound({ projectPhase: PHASE_3, roundPhase: PHASE_3 })`, e
      a entrada gravada contém `CODEBOOK_HEADING`. Se ficar limpo, fazer os dois como
      `it.each([PHASE_2, PHASE_3])`.
- [ ] **Sem normalização:** item com `\r\n`, espaços no fim e linha em branco no meio. A entrada
      gravada é `toBe` a recebida, e contém `\r\n` e os espaços no fim. (Se o cadastro de item já
      normalizar isso, inserir o item com `addInputItem` direto, que é o que chega à geração.)
- [ ] **Falha parcial grava a entrada só nas que deram certo:** três itens, `llm.failWhen` falha um
      deles. Duas linhas em `responses`, as duas com `sentInput` igual à entrada recebida, e nenhuma
      linha com o item que falhou.
- [ ] **Falha que não vem da LLM também não grava** (resposta vazia ou acima de
      `RESPONSE_TEXT_MAX`): o teste existente "resposta vazia e resposta acima do teto viram falha,
      sem gravar linha nenhuma" já prova. Conferir que ele cobre, e não duplicar.
- [ ] **O teste existente "cada item selecionado produz uma resposta, com origem, modelo e
      versões"** passa a conferir também que `sentInput` não é `null`.

### Pronto quando

Lint, typecheck e `npm test` verdes. `grep -n "sentInput" "app/projects/[id]/(tabs)/rounds/actions.ts"`
mostra só a linha do `insert`.

### O que a Parte 3 herda

- **`generateResponses`** grava `sentInput: input` no mesmo `insert` de `text`. `grep` confirma que
  essa é a única ocorrência em `actions.ts`.
- **Testes** em `generate-responses.int.test.ts`, com dois helpers locais: `sentInputsOf(roundId)`
  (mapa `inputItemId → sentInput`) e `receivedInputFor(content)` (a entrada de `llm.inputs` que
  termina com `ITEM_HEADING\n<conteúdo>`. Casa pelo conteúdo do item, não pela ordem):
  - `it.each([PHASE_2, PHASE_3])` "a entrada gravada é a mesma que a LLM recebeu", com a seleção em
    ordem invertida. A Fase 3 contém `CODEBOOK_HEADING` e a Fase 2 não.
  - "não é normalizada": item inserido com `addInputItem` direto, com `\r\n`, espaços no fim e
    linhas em branco (também no fim do conteúdo, que fecha a entrada).
  - "na falha parcial": três itens, `failWhen` no item 2. Só as outras duas linhas existem, cada uma
    com a própria entrada.
  - O teste "cada item selecionado produz uma resposta..." confere `sentInput` não nulo nas três.
  - A falha que não vem da LLM (vazia, acima do teto) já estava coberta pelo teste existente, que
    exige zero linhas. Não foi duplicado.
- **Mutação conferida:** tirar a linha do `insert` derruba 5 testes.
- `openRound(admin, { items: 0 })` funciona para montar uma rodada e inserir o item à mão depois.
- Suíte: 70 arquivos, 924 testes verdes.

---

# Parte 3 — A tela

**Objetivo:** na tela da rodada, o Administrador lê a resposta corrente e a entrada enviada dela,
recolhida. A resposta antiga mostra a frase. O Avaliador não recebe nada disso. Depois, glossário,
navegador e varredura dos ACs.

**Ler antes:** seções 1 a 5 (sobretudo D1, D5, D6 e D7), `(tabs)/rounds/[roundId]/page.tsx`,
`(tabs)/rounds/[roundId]/page.int.test.ts` (os testes de Administrador × Avaliador da #70),
`evaluation-form.tsx` (`ResponseCard`, para copiar a aparência), `app/components/ui/disclosure.tsx`.

> Se a D1 for (b), trocar `[roundId]/page.tsx` por `generate-responses.tsx` e `page.tsx` da aba de
> rodadas em tudo abaixo. O resto vale igual.

### 3.1 Carregamento (`[roundId]/page.tsx`)

`ReviewView` ganha `sentInput: SentInputView | null`, onde

```ts
type SentInputView = { text: string; sentInput: string | null }
```

Dentro do `transaction`, no ramo com `current`, **só com `access.isAdmin`**, chamar a leitura da
Parte 1 para `current.id`. Para o Avaliador, e no `empty`, o campo é `null`. O Avaliador não dispara a
consulta (§ 2, "Só o Administrador recebe o dado").

### 3.2 O bloco

Um componente pequeno, no mesmo arquivo ou em `rounds/sent-input.tsx`:

- um cartão como o `ResponseCard` (`Card tone="subtle" padding="sm"`) com o texto da resposta em
  `preWrapClass` + `scrollBoxClass`;
- abaixo, se `sentInput !== null`: `<Disclosure summary="Entrada enviada à LLM">` com o texto em
  `<pre>` ou `<p>` com `preWrapClass` + `scrollBoxClass`, sem transformação (D5);
- se `sentInput === null`: `<p className="text-[13px] text-muted">{SENT_INPUT_MISSING}</p>` no lugar
  do `Disclosure` (D6).

Posição: entre o `QueueNav` e o `ReviewGroupsList`, para acompanhar a resposta corrente quando se
navega. Renderiza só quando `view.sentInput` não é `null`, ou seja, só para o Administrador.

`SENT_INPUT_MISSING` como constante exportada (em `rounds/preconditions.ts`, junto de
`roundInputSummary`, ou num `sent-input.ts`), para o teste comparar sem copiar a frase.

### 3.3 Glossário (D8)

`docs/CONTEXT.md`: verbete **Resposta**, "a partir da Fase 3" → "a partir do Épico 3"; verbete
**Entrada enviada**, "As respostas geradas antes da Fase 3 não o têm" → "As respostas geradas antes
do Épico 3 não o têm".

### 3.4 Testes da Parte 3

`(tabs)/rounds/[roundId]/page.int.test.ts` (`roundWith` passa a aceitar `sentInput` para as respostas
que cria, repassando a `addResponse`):

- [ ] **O Administrador vê a entrada enviada, recolhida:** a árvore tem um `Disclosure` sem
      `defaultOpen`, cujo conteúdo é **exatamente** o texto gravado (comparar com `toBe`, com um texto
      que tenha `\n` e espaço no fim).
- [ ] **O Administrador lê o texto da resposta corrente** ao lado (D1).
- [ ] **Resposta antiga:** a árvore do Administrador tem `SENT_INPUT_MISSING` e nenhum `Disclosure`
      de entrada.
- [ ] **A navegação troca a entrada:** `render(..., segundaResposta)` mostra a entrada da segunda.
- [ ] **O Avaliador, na mesma rodada e com o mesmo dado no banco, não vê a entrada, nem o texto do
      bloco, nem a frase.** Procurar o texto da entrada e `SENT_INPUT_MISSING` no markup renderizado
      (`renderToStaticMarkup`), não só na árvore: é o que prova que o dado não chegou. Conferir por
      mutação (renderizar para todos derruba o teste), como na #70.

`(tabs)/evaluate/page.int.test.ts`:

- [ ] **A tela de avaliação não recebe a entrada:** com uma resposta que tem `sentInput`, o markup de
      `/evaluate` não contém o texto dela. Vale também quando quem avalia é o Administrador com
      vínculo de avaliador (ADR 0008), que é o caso em que o dado estaria mais perto de vazar.

### 3.5 Conferência no navegador

Com o Supabase local e `npm run dev:local`: uma rodada fechada com uma resposta antiga (inserida sem
`sent_input`, por exemplo com `psql`) e uma nova (gerada, ou inserida com `sent_input` preenchido, se
não houver `OPENAI_API_KEY` local). Como Administrador: a entrada vem fechada, abre e mostra o texto
com as quebras de linha e o recuo; a antiga mostra a frase; a navegação entre respostas troca o
bloco. Conferir a largura em tela estreita (o texto longo não pode estourar a página). Ver a nota de
memória sobre a faixa preta do preview se a captura sair cortada. A tela como Avaliador fica coberta
pelos testes (o `/dev/login` só emite a conta de dev).

### 3.6 Varredura dos ACs

| AC do issue | Onde está provado |
|---|---|
| A tabela ganha a coluna, que aceita vazio só pelas antigas | § 1.1, § 1.2; `generateResponses` grava sempre (§ 2.2, "cada item... `sentInput` não é `null`") |
| Toda resposta nova grava a entrada na mesma escrita do texto, em qualquer fase | § 2.1 (mesmo `insert`); § 2.2 (Fase 2 e Fase 3) |
| A entrada gravada é exatamente a passada à LLM, sem normalização | § 2.2 (`toBe` com `llm.inputs`, `\r\n` e espaços no fim); § 1.5 |
| Falha de geração não grava nada, nem a entrada | § 2.2 (falha parcial; vazia e acima do teto) |
| O Administrador vê a entrada, recolhida, na leitura da resposta, sem formatação | § 3.2; § 3.4 (Disclosure fechado, texto `toBe`) |
| Resposta sem entrada mostra a frase | § 3.2 (D6); § 3.4 (resposta antiga) |
| Nenhuma tela do Avaliador mostra a entrada | § 3.1 (consulta só com `isAdmin`); § 3.4 (revisão como Avaliador, `/evaluate`); § 1.5 (`loadRoundResponse` sem o campo) |
| Teste: entrada gravada = entrada da LLM falsa, Fase 2 e Fase 3 | § 2.2 |
| Teste: falha parcial grava só nas que deram certo | § 2.2 |
| Teste: Administrador vê; Avaliador não | § 3.4 |
| Suíte verde | cada Parte |

### Pronto quando

Lint, typecheck e `npm test` verdes, conferência no navegador feita, tabela acima sem linha em
aberto, glossário corrigido, checkboxes do issue marcados.

### O que esta Parte fechou

- **D1 ficou em (a):** a tela da rodada (`[roundId]/page.tsx`). `ReviewView` ganhou
  `adminResponse: ResponseForAdmin | null` (e não `sentInput: SentInputView | null`: o tipo da
  Parte 1 já é esse formato, e o campo carrega também o texto da resposta). A consulta
  `loadResponseForAdmin` só roda com `access.isAdmin`; no `empty` e para o Avaliador o campo é `null`.
- **O bloco** mora em `rounds/sent-input.tsx`: `AdminResponseCard` (o cartão com o texto da resposta
  e, abaixo de um divisor, a entrada) e `SentInput` (o `Disclosure` fechado com a entrada num `<pre>`
  monoespaçado em `preWrapClass` + `scrollBoxClass`, ou a frase no lugar dele). Constantes
  exportadas: `SENT_INPUT_SUMMARY` ("Entrada enviada à LLM") e `SENT_INPUT_MISSING`. A #72 pode
  reaproveitar `SentInput` direto. Posição: entre o `QueueNav` e o `ReviewGroupsList`.
- **Glossário (D8)** corrigido nos verbetes **Resposta** e **Entrada enviada**.
- **Testes** em `[roundId]/page.int.test.ts` (`roundWith` aceita `texts` e `sentInputs`): entrada
  recolhida e `toBe` o gravado (com `\r\n`, recuo, linha em branco e espaço no fim); texto da resposta
  ao lado; resposta antiga com a frase e sem `Disclosure`; navegação troca texto e entrada (incluindo
  uma antiga); o Avaliador, nas duas respostas, sem o cartão na árvore e sem entrada, texto do bloco,
  frase ou título no markup da página inteira (`renderToStaticMarkup` do `Fragment`). Em
  `evaluate/page.int.test.ts` (`scenario` aceita `sentInput`): nem o avaliador nem o
  Administrador-avaliador recebem a entrada no markup, e `response` não tem a chave `sentInput`.
- **Mutação conferida:** carregar `loadResponseForAdmin` para todos derruba o teste do Avaliador.
- **Navegador (§ 3.5):** rodada da Fase 3 fechada, semeada no banco local e apagada depois. O painel
  vem fechado, abre com quebras e recuo intactos, a linha longa quebra dentro da caixa (sem rolagem
  horizontal no `<pre>`, também em 375 px), a navegação troca para a antiga e mostra a frase. A barra
  de abas do projeto já estoura a largura em 375 px, antes desta fatia.
- **Varredura dos ACs:** a tabela de § 3.6 fecha sem linha em aberto.
- Suíte: 70 arquivos, 930 testes verdes; lint e typecheck verdes.
- **Pendente fora do código:** marcar os checkboxes do issue #71 e, no deploy, seguir § 7.

---

## 6. Fica para depois (registrar, não construir)

- **Entrada no teste de prompt** — #72 (mostra e não grava).
- **Entrada no CSV da rodada** — #78.
- **Entrada durante a rodada aberta**, se a D1 ficar em (a): a revisão só abre com a rodada fechada.
  Se isso fizer falta, a opção (b) resolve numa fatia própria.
- **Resposta colada manualmente** (ADR 0003): quando existir, sem entrada enviada, e com uma frase
  própria em vez de "gerada antes" (D9).
- **Reconstruir a entrada das respostas antigas**: fora do épico (PRD).

## 7. Deploy

Esta fatia **tem migration**. Ordem:

1. `supabase db push` para prod **antes** do deploy do código. O código novo insere `sent_input`, e
   sem a coluna toda geração quebra.
2. Conferir em prod que a coluna existe e que as respostas antigas ficaram com `null`.
3. Deploy do código.

Antes do passo 1, conferir o diff de schema de prod contra o local. A `0015` (`rounds.phase`, da #70)
também precisa estar em prod. Se ainda não estiver, empurrar as duas juntas e ignorar o ruído do
`pg_net`.
