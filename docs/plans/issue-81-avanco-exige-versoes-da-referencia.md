# Plano de implementação — Issue #81: "41 — Avanço para a Fase 4 exige as versões da rodada de referência"

Link: https://github.com/nicolasddr/tcc/issues/81
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 8 e 9, esta só na parte
que nomeia a rodada de referência; seções "Rodada" e "Avanço e retorno" de Decisões de Implementação;
"Avanço da Fase 3" e "Rodada de referência" de Testing Decisions)
Blocked by: nenhuma.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Regras puras: rodada de referência, comparação de versões e a pré-condição nova do avanço da Fase 3 | ☑ |
| 2 | A action: `advancePhase` recusa versões diferentes da referência, e a prova de que número continua sem travar | ☐ |
| 3 | A tela: item novo no painel da Fase 3, confirmação nomeando a rodada de referência, testes de página e varredura dos ACs | ☐ |

**Nenhuma ADR nova.** A regra está escrita na **emenda de 2026-10-02 da ADR 0004** ("As versões da
Fase 4": o avanço ganha uma pré-condição estrutural, as versões vigentes precisam ser as da última
rodada fechada da Fase 3; é insumo faltando, não métrica) e no glossário (`docs/CONTEXT.md`, verbete
**Rodada de referência**). Se algo divergir, emende a ADR em vez de improvisar no código.

**Sem migration.** `rounds` já guarda `codebook_version_id` e `prompt_version_id`, e
`version_number` é único por projeto (`cv_unique_project_version`, `pv_unique_project_version`). Nada
de schema.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Action de avanço | `pipeline/actions.ts` (`advancePhase`, ramo `PHASE_3`) | passa a carregar a referência e as vigentes e a montar `versions` (Parte 2) |
| Pré-condições da Fase 3 | `pipeline/preconditions.ts` (`Phase3Inputs`/`Phase3Blocker` hoje são **aliases** dos da Fase 2; `phase3Blockers`, `phase3BlockerMessage`, `phase3BlockedMessage`, helper privado `roundCycleBlockers`) | os aliases viram tipos próprios, com o bloqueio novo (D3) |
| Confirmação da Fase 4 | `pipeline/preconditions.ts` (`phase4ConfirmationLines`) | **sem mudança** (as frases novas da história 9 são da #82 e da #86, § 4) |
| Rodadas | `(tabs)/rounds/rounds.ts` (`listRounds` → `RoundSummary` com `phase`, `status`, `codebookVersionNumber`, `promptVersionNumber`; `isOpen`, `roundsInPhase`, `loadOpenRound`, `countClosedRounds`) | só usados. `listRounds` já traz tudo o que a referência precisa |
| Versão vigente | `pipeline/codebook.ts` (`loadCodebook` → `version.versionNumber`), `pipeline/prompt.ts` (`loadPrompt`) | só usados. Vigente = maior `version_number` do projeto |
| Congelamento | `pipeline/freeze.ts` (`isFrozen`, `frozenMessage`) | **sem mudança**. Fecha a outra metade da garantia (§ 2) |
| Painel da Fase 3 | `pipeline/phase-3-checklist.tsx` (`PHASE_3_REQUIREMENTS`, `Phase3Checklist`) | ganha o terceiro item (Parte 3) |
| Resumo da confirmação | `pipeline/last-round-summary.tsx` (`LastClosedRound`, `LastRoundSummary`, título fixo "Última rodada fechada: rodada N") | ganha o rótulo de rodada de referência (D7) |
| Visão geral | `(tabs)/page.tsx` (`phaseChecklistData`; já carrega `listRounds`, `loadCodebook` e `loadPrompt` para o Administrador) | monta `versions` sem consulta nova (Parte 3) |
| Testes vizinhos | `pipeline/preconditions.unit.test.ts` (`describe` da Fase 3), `pipeline/advance-phase-3.int.test.ts` (helpers `seedPhase3Project`, `seedArtifacts`, `seedRound`, `rate`), `pipeline/advance-phase-2.int.test.ts`, `(tabs)/rounds/rounds.unit.test.ts`, `(tabs)/page.int.test.ts` (helpers `Phase3Props`, `findElement`, testes a partir de "na Fase 3, com uma rodada fechada da Fase 3…") | copiar helpers e espelhar os casos |

O que **falta**, e esta fatia cria: a função pura da rodada de referência, a comparação de versões com
a sua descrição, o bloqueio `versions_changed` nas pré-condições da Fase 3, a carga das versões em
`advancePhase`, o item novo no painel e o rótulo da referência na confirmação.

---

## 2. A regra, por extenso

### Rodada de referência

- **De uma rodada da Fase 4** (número `n`): a rodada **fechada**, **da Fase 3**, de **maior número
  menor que `n`**. É o que a #84 vai usar para a comparação; esta fatia só cria e testa.
- **Do projeto, para o avanço**: a rodada fechada da Fase 3 de maior número, sem limite.
- **Rodada aberta da Fase 3 não conta.** Rodadas das Fases 2 e 4 nunca contam.
- **Passagens anteriores.** Com `1 (F2) · 2 (F3) · 3 (F4) · 4 (F3) · 5 (F4)`, a referência da 3 é a 2,
  a da 5 é a 4 e a do projeto é a 4. Número de rodada e ordem de fechamento coincidem, porque só
  existe uma rodada aberta por projeto (`rd_one_open_per_project`).
- **Sem rodada fechada da Fase 3, não há referência** (`null`). Nesse caso o `no_closed_round` que já
  existe é quem trava; a regra das versões não se aplica.

### O que trava

Três pré-condições estruturais, nesta ordem: **nenhuma rodada aberta**, **ao menos uma rodada fechada
na Fase 3** (as duas já existem) e, nova, **codebook e prompt vigentes iguais aos da rodada de
referência**. Igual quer dizer o mesmo `version_number`, que é único por projeto (D2). Mudou o
codebook, o prompt ou os dois: recusa, com mensagem que nomeia o que mudou com os números e manda
abrir e fechar mais uma rodada da Fase 3 com as versões vigentes.

### O que não trava, nunca

- **ICR e Qualidade.** `phase3Blockers` continua sem receber métrica; recebe só números de rodada e de
  versão. É isso que mantém estrutural a garantia (emenda de 2026-09-22 da ADR 0004).
- **Metadados do prompt** (nome, descrição, registro de mudanças): `savePromptMetadata` atualiza a
  vigente sem criar versão, então não muda `version_number`.
- **Salvar o prompt com o mesmo texto**: `decideTextSave` devolve `unchanged` e não cria versão.

### A corrida continua fechada

`advancePhase`, `saveCodebook` e `savePrompt` travam a mesma linha de `projects` com `FOR UPDATE`. Uma
edição que chega junto com o avanço ou entra antes (e o avanço vê a versão nova e recusa) ou depois (e
o congelamento da #80 recusa). Por isso a carga das versões acontece **dentro** da transação do avanço,
depois do `FOR UPDATE` (Parte 2).

---

## 3. Decisões

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. Módulo puro novo, `(tabs)/rounds/reference-round.ts`.** Ele mora com as rodadas porque a #82
(abrir rodada) e a #84 (leitura) vão importá-lo de lá. Exportações:

```ts
export type ReferenceCandidate = { roundNumber: number; phase: number; status: string }

export function referenceRoundOf<T extends ReferenceCandidate>(
  rounds: readonly T[],
  round: { roundNumber: number },
): T | null

export function projectReferenceRound<T extends ReferenceCandidate>(rounds: readonly T[]): T | null
```

As duas varrem a lista inteira atrás do maior número (não dependem da ordem de entrada) e filtram
`phase === PHASE_3 && !isOpen(round)`. `isOpen` vem de `./rounds`, como já fazem os outros puros.

**D2. Versões comparadas pelo número, não pelo id.** `version_number` é único por projeto e a vigente
é a de maior número, então número igual ⇔ mesma versão. As mensagens precisam dos números de qualquer
jeito, e `RoundSummary` já os traz (não traz `promptVersionId`). No mesmo módulo de D1:

```ts
export type VersionPair = { codebook: number; prompt: number }

export type VersionChange = {
  subject: 'codebook' | 'prompt'
  reference: number
  current: number
}

export function versionChanges(reference: VersionPair, current: VersionPair): VersionChange[]
// ordem fixa: codebook antes de prompt; vazio quando são iguais

export function referenceVersionsOf(
  rounds: readonly (ReferenceCandidate & {
    codebookVersionNumber: number
    promptVersionNumber: number
  })[],
  current: { codebook: number | null; prompt: number | null },
): VersionCheck | null

export type VersionCheck = { referenceRound: number; reference: VersionPair; current: VersionPair }
```

`referenceVersionsOf` é a ponte que a página e a action usam do mesmo jeito (como `roundsInPhase` na
#77, D9): devolve `null` sem referência ou sem vigente, e senão o trio pronto para a pré-condição.
Nota: uma versão nova com conteúdo idêntico à anterior **conta como mudança**. Não há como "reverter"
para a versão da referência, e é coerente: a rodada congela a vigente, não um conteúdo.

**D3. `Phase3Inputs` e `Phase3Blocker` deixam de ser aliases.**

```ts
export type Phase3Inputs = Phase2Inputs & { versions: VersionCheck | null }

export type Phase3Blocker =
  | Phase2Blocker
  | { key: 'versions_changed'; referenceRound: number; changes: VersionChange[] }
```

`versions` é **obrigatório** (pode ser `null`), para que nenhum chamador esqueça a regra, no mesmo
espírito do `countClosedRounds(projectId, phase)` da #77. `phase3Blockers` continua chamando
`roundCycleBlockers` e acrescenta `versions_changed` **por último**, só quando `versions !== null` e
`versionChanges(...)` não é vazio. `phase2Blockers` e as mensagens da Fase 2 não mudam. Consequência
mecânica: os casos existentes do `describe('phase3Blockers…')` ganham `versions: null` (única edição de
teste antigo da Parte 1, citar no commit).

**D4. Mensagens.** A descrição do que mudou sai de uma função própria do módulo de D1, porque a #82
vai repeti-la com outro desfecho ("voltar à Fase 3…"):

```ts
export function versionChangesSentence(referenceRound: number, changes: VersionChange[]): string
```

Redação (ajustar, preservando o conteúdo: o que mudou, os números, a rodada):

- só codebook: `O codebook mudou depois da rodada de referência: a rodada {r}, a última fechada da
  Fase 3, usou a versão {a}, e a vigente é a {b}.`
- só prompt: igual, com `O prompt mudou…`.
- os dois: `O codebook e o prompt mudaram depois da rodada de referência: a rodada {r}, a última
  fechada da Fase 3, usou o codebook na versão {a} e o prompt na versão {c}, e os vigentes são o
  codebook na versão {b} e o prompt na versão {d}.`

`phase3BlockerMessage({ key: 'versions_changed', … })` = a frase acima + `Avançar assim levaria à
Fase 4 uma versão que nenhum avaliador aplicou. Abra e feche mais uma rodada da Fase 3 com as versões
vigentes e avance de novo.` Nenhuma palavra sobre ICR ou Qualidade, e nenhuma sobre "voltar".

**D5. `phase3BlockedMessage` mantém o formato de "primeiro bloqueio".** Prefixo `Não foi possível
avançar para a Fase 4.` + a mensagem do primeiro bloqueio + o sufixo do gesto único, que continua
valendo só para o par `open_round` + `no_closed_round`. `versions_changed` nunca aparece junto de
`no_closed_round` (sem fechada não há referência). Junto de `open_round` ele vem em segundo, e o
servidor fala primeiro da rodada aberta: fechá-la pode até resolver as versões (ela vira a referência).
O painel mostra os dois itens separados, então o Administrador não fica sem saber.

**D6 ⚠. O item das versões sem rodada de referência fica neutro, fora da contagem.** Sem rodada
fechada da Fase 3 o item não está pronto nem pendente. Recomendação: ícone de círculo vazio, título
normal, texto curto `Depende da rodada de referência, a última rodada fechada da Fase 3, que ainda
não existe.`, **sem** link "Resolver" (quem resolve é o item de rodada fechada) e **sem** entrar no
"N de 3 pendentes", que continua contando `blockers.length`. Alternativa: esconder o item enquanto
não há referência (o painel passaria de 2 para 3 itens).

**D7. A confirmação nomeia a rodada de referência no resumo.** `LastRoundSummary` ganha uma prop
opcional `reference?: VersionPair`. Com ela, o título vira `Rodada de referência: rodada {n}` (+ `·
fechada em …`) e entra, logo abaixo, a linha inline `Codebook na versão {a} e prompt na versão {c}:
são as versões que a Fase 4 vai testar.` Sem ela, o render da Fase 2 fica igual ao de hoje
("Última rodada fechada…"). A rodada do resumo da Fase 3 passa a sair de `projectReferenceRound`, e
não mais de `closed[closed.length - 1]` (é a mesma rodada, mas uma fonte só). Nada de `InfoTooltip`
dentro do `<dialog>` (memória). `phase4ConfirmationLines()` **não muda**.

**D8. O link "Resolver" do item das versões aponta para `/projects/<id>/rounds`**, como os outros
dois: o caminho é abrir e fechar uma rodada da Fase 3.

---

## 4. Fronteira com as fatias vizinhas

- **#80 (congelamento, fechada)** é a outra metade: o avanço impede chegar à Fase 4 com versão nova, e
  o congelamento impede criar versão nova lá dentro. `freeze.ts` não muda.
- **#82 (abrir rodada na Fase 4)** herda daqui `referenceRoundOf`/`projectReferenceRound`,
  `versionChanges`, `referenceVersionsOf` e `versionChangesSentence`. Ela é dona de: apagar
  `phase_unavailable` de `roundBlockers`, o bloqueio de versões na abertura de rodada e a frase da
  confirmação sobre itens e avaliadores novos (história 9). **Aqui `roundBlockers` não muda.**
- **#84 (leitura ao lado da referência)** usa `referenceRoundOf` para a comparação. Esta fatia não
  monta comparação nenhuma.
- **#86 (retorno)** acrescenta à confirmação do avanço a frase "é possível voltar à Fase 3" e, no
  retorno, "valem de novo as regras do avanço, inclusive a da rodada de referência". O teste de
  `phase4ConfirmationLines` que proíbe "voltar" é dela de editar.
- **#77 (avanço da Fase 3, fechada)**: `roundCycleBlockers`, as mensagens de `open_round` e
  `no_closed_round`, o sufixo do gesto único e `phase4ConfirmationLines` não mudam.

---

# Parte 1 — Regras puras

**Objetivo:** tudo o que é regra e texto, sem banco e sem tela. No fim, `npm test` prova em unitário
qual é a rodada de referência e quando as versões travam o avanço.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `pipeline/preconditions.ts` (bloco da Fase 3),
`pipeline/preconditions.unit.test.ts` (a partir de `describe('phase3Blockers…`), `(tabs)/rounds/rounds.ts`
e `(tabs)/rounds/rounds.unit.test.ts`.

### 1.1 `(tabs)/rounds/reference-round.ts` (novo)

D1, D2 e `versionChangesSentence` de D4.

### 1.2 `pipeline/preconditions.ts`

- `Phase3Inputs` e `Phase3Blocker` próprios (D3), importando os tipos do módulo novo.
- `phase3Blockers`: `roundCycleBlockers(inputs)` + `versions_changed` no fim.
- `phase3BlockerMessage`: `case 'versions_changed'` (D4). O `switch` sem `default` faz o TypeScript
  cobrar.
- `phase3BlockedMessage`: hoje o sufixo do gesto único dispara com `blockers.length > 1`, o que
  pegaria também `[open_round, versions_changed]`. Passa a disparar só quando os bloqueios incluem
  `no_closed_round` além de `open_round` (D5). O resto do formato não muda.

### 1.3 Testes da Parte 1

`(tabs)/rounds/reference-round.unit.test.ts` (novo):

- [ ] **Várias rodadas da Fase 3 fechadas**: a do projeto é a de maior número; a de uma rodada da Fase 4
      é a de maior número **menor que ela**.
- [ ] **Rodada aberta da Fase 3 não conta**: com `2 (F3 fechada) · 3 (F3 aberta)`, a do projeto é a 2.
- [ ] **Só Fases 2 e 4**: `null`. Lista vazia: `null`.
- [ ] **Passagem anterior pela Fase 4**: com `1 (F2) · 2 (F3) · 3 (F4) · 4 (F3) · 5 (F4)`, referência da
      3 é a 2, da 5 é a 4, do projeto é a 4.
- [ ] **Ordem de entrada não importa**: a mesma lista embaralhada dá o mesmo resultado.
- [ ] **`versionChanges`**: iguais → `[]`; só codebook; só prompt; os dois, com codebook primeiro.
- [ ] **`referenceVersionsOf`**: sem referência → `null`; sem vigente → `null`; com as duas → trio com
      os números da referência e os vigentes.
- [ ] **`versionChangesSentence`**: nomeia o que mudou e os dois números de cada um, e a rodada.

`pipeline/preconditions.unit.test.ts`:

- [ ] Casos existentes do `describe('phase3Blockers…')` ganham `versions: null` (D3), sem outra mudança.
- [ ] **Codebook mudou**, **prompt mudou**, **os dois mudaram**: um bloqueio `versions_changed` com as
      `changes` certas, e `canAdvanceFromPhase3` falso.
- [ ] **Nenhum mudou** (`versions` com números iguais): liberado.
- [ ] **`versions: null`** com uma fechada e nenhuma aberta: liberado (a regra não se aplica).
- [ ] **Ordem**: com rodada aberta e versões diferentes, `['open_round', 'versions_changed']`.
- [ ] **Mensagens**: cada uma das três nomeia o que mudou com os números e contém "abra e feche mais
      uma rodada da Fase 3"; nenhuma contém "ICR", "Qualidade", "concordância" nem "voltar".
- [ ] **`phase3BlockedMessage`**: com `[versions_changed]` sozinho, prefixo + mensagem e **sem** o
      sufixo do gesto único; com `[open_round, versions_changed]`, fala da rodada aberta e também sem o
      sufixo; o par antigo continua com o sufixo (o teste existente cobre).
- [ ] **A Fase 2 não muda**: o teste `segue a mesma regra da Fase 2…` continua verde com `versions:
      null`.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Único teste antigo editado: o acréscimo de
`versions: null` nos casos da Fase 3.

**Typecheck no meio do caminho:** com `versions` obrigatório, `advancePhase` e `(tabs)/page.tsx`
deixam de compilar. Nesta Parte, passe `versions: null` nos dois chamadores para manter o typecheck
verde; as Partes 2 e 3 trocam pelo valor real.

Commit sugerido: `feat(rodadas): rodada de referência e pré-condição de versões do avanço da fase 3`.

### O que a Parte 2 herda

- **Nomes finais** em `(tabs)/rounds/reference-round.ts`, como em D1, D2 e D4: `ReferenceCandidate`,
  `VersionPair`, `VersionChange`, `VersionCheck`, `referenceRoundOf`, `projectReferenceRound`,
  `versionChanges`, `referenceVersionsOf`, `versionChangesSentence` (aceita `readonly VersionChange[]`).
  Em `pipeline/preconditions.ts`: `Phase3Inputs = Phase2Inputs & { versions: VersionCheck | null }` e
  `Phase3Blocker` com `{ key: 'versions_changed'; referenceRound; changes }`.
- **Textos finais**: os de D4, sem ajuste. `phase3BlockerMessage(versions_changed)` = frase de
  `versionChangesSentence` + ` Avançar assim levaria à Fase 4 uma versão que nenhum avaliador aplicou.
  Abra e feche mais uma rodada da Fase 3 com as versões vigentes e avance de novo.`
- **`phase3BlockedMessage`**: o sufixo do gesto único agora exige `open_round` **e** `no_closed_round`.
- **Divergência 1 — `(tabs)/rounds/round-status.ts` (novo).** `ROUND_OPEN`, `ROUND_CLOSED` e `isOpen`
  saíram de `rounds.ts` para um módulo puro; `rounds.ts` os reexporta, então nenhum import existente
  mudou. Motivo: `pipeline/preconditions.ts` passou a importar `reference-round.ts` em tempo de
  execução, e `preconditions.ts` é importado por componentes cliente (`codebook-editor.tsx`,
  `prompt-editor.tsx`). Se `reference-round.ts` importasse `isOpen` de `./rounds`, levaria
  `@/lib/db` (driver `postgres`) para o bundle do cliente. `reference-round.ts` importa de
  `./round-status`. **Não importe `./rounds` em `reference-round.ts`.**
- **Divergência 2 — mais um teste antigo editado.** Além dos casos da Fase 3 em
  `preconditions.unit.test.ts`, as 4 asserções `phase3Of(tree)!.inputs).toEqual(...)` de
  `(tabs)/page.int.test.ts` ganharam `versions: null` (consequência do `versions: null` passado em
  `page.tsx`). A Parte 3 troca esse `null` pelo valor real nelas.
- **Placeholders**: `advancePhase` (ramo `PHASE_3`) passa `versions: null`; `(tabs)/page.tsx` passa
  `inputs={{ ...phase3.inputs, versions: null }}` ao `Phase3Checklist`. A Parte 2 troca o primeiro; a
  Parte 3, o segundo. `phase-3-checklist.tsx` ainda não conhece `versions_changed` (só não quebrou
  porque nunca recebe o bloqueio).
- **Ciclo de import**: `reference-round.ts` importa `PHASE_3` de `pipeline/preconditions.ts`, que
  importa `reference-round.ts`. Inofensivo (só usado dentro de funções), mas não use esses valores no
  topo de módulo.
- **Suíte**: `npm test` com 84 arquivos e 1198 testes verdes; 14 novos em
  `reference-round.unit.test.ts` e 10 novos em `preconditions.unit.test.ts`.

---

# Parte 2 — A action

**Objetivo:** `advancePhase` recusa, no servidor e na mesma transação, o avanço com versões diferentes
das da rodada de referência. A integração prova os três casos, a mensagem exata e que número continua
sem travar.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 2 herda", `pipeline/actions.ts` (`advancePhase`,
`saveCodebook`, `savePrompt`, `savePromptMetadata`) e `pipeline/advance-phase-3.int.test.ts` inteiro.

### 2.1 `pipeline/actions.ts`

No ramo `PHASE_3`, depois do `FOR UPDATE` e junto das cargas que já existem:

```ts
const codebook = await loadCodebook(projectId, tx)
const prompt = await loadPrompt(projectId, tx)
const versions = referenceVersionsOf(await listRounds(projectId, tx), {
  codebook: codebook.version?.versionNumber ?? null,
  prompt: prompt.version?.versionNumber ?? null,
})
const blockers = phase3Blockers({ openRoundNumber, closedRounds, versions })
```

Sem consulta nova: `loadCodebook`, `loadPrompt` e `listRounds` já existem e aceitam `tx`. Não mude a
ordem `authz → transação → FOR UPDATE`, nem `ADVANCE_DENIED`, nem a revalidação. Os ramos `PHASE_1` e
`PHASE_2` não mudam.

### 2.2 Testes em `pipeline/advance-phase-3.int.test.ts`

Fixture: a de sempre (`seedPhase3Project`: rodada 1 fechada da Fase 2) + rodada 2 fechada da Fase 3
com as versões v1. Para "mudou", acrescentar v2 com `addCodebookVersion(…, { versionNumber: 2 })` e/ou
`addPromptVersion(…, { versionNumber: 2 })` **depois** da rodada.

- [ ] **Codebook mudou**: `{ error: phase3BlockedMessage([{ key: 'versions_changed', referenceRound: 2,
      changes: [{ subject: 'codebook', reference: 1, current: 2 }] }]) }`, fase continua 3.
- [ ] **Prompt mudou**: idem, com `subject: 'prompt'`.
- [ ] **Os dois mudaram**: idem, com as duas `changes`. A string tem os quatro números.
- [ ] **Versões iguais, com ICR baixo e Qualidade toda em Baixo**: avança. Os dois testes existentes
      ("concordância baixa não impede", "Qualidade concentrada em Baixo") já semeiam versões iguais e
      continuam verdes sem edição; acrescentar **um** caso que junta os dois números ruins e afirma, no
      próprio teste, que as versões vigentes são as da rodada.
- [ ] **De ponta a ponta pelo caminho real**: rodada 2 da Fase 3 fechada → `saveCodebook` (cria v2,
      porque v1 está usada) → avanço recusado nomeando codebook 1 → 2 → `createRound` + `closeRound`
      (rodada 3, Fase 3, com v2) → avanço `{ ok: true, phase: 4 }`. Prova que o caminho da mensagem
      resolve.
- [ ] **Metadados não contam**: depois da rodada de referência, `savePromptMetadata` muda o nome →
      avança.
- [ ] **Mesmo texto não conta**: `savePrompt` com o texto da vigente → avança (nenhuma versão nova).
- [ ] **Referência é a última fechada da Fase 3, não a primeira**: rodadas 2 (v1) e 3 (v2) da Fase 3
      fechadas, vigente v2 → avança; vigente v3 → recusa citando a rodada 3.
- [ ] **O Avaliador continua barrado** antes de qualquer leitura de versão (o teste existente cobre;
      conferir que não mudou).

`pipeline/advance-phase-2.int.test.ts` e `(tabs)/rounds/actions.int.test.ts`: os casos de avanço que
passam pela Fase 3 já usam as mesmas versões da rodada; devem continuar verdes **sem edição**. Se algum
cair, o motivo é fixture com versão criada depois da rodada: ajuste a fixture e cite no commit.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, sem teste antigo editado nesta Parte.

Commit sugerido: `feat(pipeline): avanço para a fase 4 exige as versões da rodada de referência`.

### O que a Parte 3 herda

_(preencher ao terminar)_

---

# Parte 3 — A tela

**Objetivo:** o painel "Para avançar para a Fase 4" mostra a pré-condição das versões como item
próprio, liberado e bloqueado, e a confirmação nomeia a rodada de referência. No fim, a issue fecha.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, os dois "o que herda", `pipeline/phase-3-checklist.tsx`,
`pipeline/last-round-summary.tsx`, `(tabs)/page.tsx` (`phaseChecklistData`) e os testes da Fase 3 em
`(tabs)/page.int.test.ts`.

### 3.1 `pipeline/phase-3-checklist.tsx`

- `PHASE_3_REQUIREMENTS` ganha `{ key: 'versions_changed', title: 'Codebook e prompt iguais aos da
  rodada de referência' }`, em terceiro.
- Pendente: `phase3BlockerMessage(blocker)` + "Resolver" para `/projects/<id>/rounds` (D8).
- Pronto: `CheckCircleIcon` + `Badge` "pronto", como os outros.
- Sem referência (`inputs.versions === null`): o estado neutro de D6.
- O `hint` de liberado passa a citar as versões (ex.: `…ao menos uma fechada na Fase 3, e codebook e
  prompt são os da rodada de referência.`).
- `blocked` continua saindo **só** de `phase3Blockers(inputs)`.
- `summary`: `<LastRoundSummary round={lastRound} reference={…} />` com os números da referência (D7).

### 3.2 `pipeline/last-round-summary.tsx`

Prop `reference?: VersionPair` (D7). Sem ela, nada muda.

### 3.3 `(tabs)/page.tsx`

- `phaseChecklistData` devolve, para a Fase 3, `inputs.versions` vindo de `referenceVersionsOf(
  agreement.rounds, { codebook: artifacts.codebook.version?.versionNumber ?? null, prompt: … })` e o
  `lastRound` montado a partir de `projectReferenceRound`. A Fase 2 continua com `Phase2Inputs` (ou
  recebe a função um parâmetro a mais; escolher o que deixar a função mais simples).
- Nenhuma consulta nova: `listRounds`, `loadCodebook` e `loadPrompt` já são carregados para o
  Administrador.

### 3.4 Testes da Parte 3

`(tabs)/page.int.test.ts`:

- [ ] **Item liberado**: Fase 3, rodada fechada da Fase 3 com as versões vigentes → o item das versões
      aparece "pronto", `AdvancePhase` com `blocked: false`.
- [ ] **Item bloqueado (codebook)**: v2 de codebook depois da rodada → `blocked: true`, o texto do
      painel tem a mensagem de `versions_changed` com os números e o link "Resolver" para
      `/projects/<id>/rounds`.
- [ ] **Item bloqueado (prompt)**: idem com o prompt (pode ser `it.each` com o anterior).
- [ ] **Sem rodada fechada da Fase 3**: o item fica no estado de D6 e o badge continua contando só os
      bloqueios.
- [ ] **ICR baixo e Qualidade em Baixo com versões iguais** continuam liberados (o teste existente
      cobre; conferir).
- [ ] **A confirmação nomeia a referência**: o `summary` contém `Rodada de referência: rodada 2` e os
      números das versões. **Teste existente editado** (esperado, citar no commit): a linha 647 troca
      `Última rodada fechada: rodada 2` pela nova; a da Fase 2 (linha 485) não muda.
- [ ] **O Avaliador não vê o painel** (o teste existente cobre).

### 3.5 Conferência no navegador

Siga as memórias: `/dev/login` para entrar, `resize_window`/`get_page_text` se o pane mostrar a faixa
preta. Projeto na Fase 3 com uma rodada fechada da Fase 3 (montado por `psql` ou pelo fluxo): conferir
o item liberado e o resumo da confirmação; editar o codebook, voltar à visão geral e ver o item
bloqueado com os números, "Resolver" levando a Rodadas e o botão de avançar desabilitado; abrir e
fechar uma rodada e ver o item liberar. A 375px, medido em iframe. **Apagar a cena antes de `npm
test`** (`scores` vazia).

### 3.6 Varredura dos ACs

| AC da issue | Onde é provado |
|---|---|
| Função pura da referência (rodada da Fase 4 e projeto) | P1 (`reference-round.unit.test.ts`) |
| Rodada aberta da Fase 3 não conta | P1 |
| Recusa com codebook, prompt e os dois mudados | P1 (unitário) + P2 (integração, três casos) + P3 (painel) |
| A mensagem nomeia o que mudou, com números, e manda abrir e fechar mais uma rodada da Fase 3 | P1 (mensagens) + P2 (string exata) |
| Versões iguais seguem as regras de sempre | P1 + P2 (testes antigos verdes, metadados, mesmo texto, ponta a ponta) |
| Nenhum ICR ou Qualidade trava | P2 (caso com os dois números ruins) + assinatura de `phase3Blockers` + P3 |
| O painel mostra o item próprio, com link | P3 |
| A confirmação nomeia a rodada de referência | P3 |

| Teste da issue | Onde |
|---|---|
| Unitário: referência com várias rodadas da Fase 3, com aberta e com passagem anterior pela Fase 4 | P1 |
| Unitário: pré-condições com codebook, prompt, os dois e nenhum | P1 |
| Integração: recusa nos três casos, mensagem certa | P2 |
| Integração: avança com versões iguais, ICR baixo e Qualidade em Baixo | P2 |
| Página: item novo liberado e bloqueado | P3 |
| Suíte verde | as três Partes |

Antes de fechar, marque os checkboxes da issue no GitHub e cite no comentário de fechamento o commit de
cada Parte. Confira à mão que nada em `phase-3-checklist.tsx` decide `blocked` por ICR ou Qualidade.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, ACs conferidos um a um e a conferência no
navegador feita.

Commit sugerido: `feat(visao-geral): item das versões e rodada de referência no avanço para a fase 4`.

### O que esta Parte fechou

_(preencher ao terminar)_

---

## 5. Fica para depois (registrar, não construir)

- **Bloqueio de versões ao abrir rodada na Fase 4** e a remoção de `phase_unavailable`: #82, que
  reaproveita o módulo de D1.
- **Frases novas da confirmação** (itens e avaliadores novos são escolha do Administrador; é possível
  voltar à Fase 3): #82 e #86.
- **Mensagem com rodada aberta e versões mudadas** (D5): o servidor fala só da rodada aberta. Se isso
  confundir na prática, avaliar listar as duas pendências.
- **Tooltip de `VersionStatus` na Fase 4** (herdado da #80): segue pendente.

## 6. Deploy

Sem migration e sem `db push`. **Antes do deploy, confira que prod não está atrasado em schema**
(memória: prod já atrasou duas vezes). Esta fatia lê `rounds.phase` (#70) e as versões das rodadas.
