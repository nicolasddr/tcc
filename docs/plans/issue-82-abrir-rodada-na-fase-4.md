# Plano de implementação — Issue #82: "42 — Abrir rodada na Fase 4"

Link: https://github.com/nicolasddr/tcc/issues/82
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 1, 2, 3, 9 — só a frase
sobre itens e avaliadores novos — e 23; seção "Rodada" de Decisões de Implementação; "Criar rodada" e
"Gerar respostas" de Testing Decisions)
Blocked by: #80 e #81, as duas **fechadas**. Pode começar.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A regra: `roundBlockers` sem `phase_unavailable` e com a pré-condição das versões, ligada na action e na página, com os testes de criar rodada | ☑ |
| 2 | O ciclo: geração, avaliação, fechamento, revisão, anotações, outlier e a rodada seguinte numa rodada da Fase 4, provados em integração | ☑ |
| 3 | Os textos e as telas: confirmação do avanço, textos da rodada que falam de fase e de destravar, tela de Rodadas e do avaliador na Fase 4, navegador e varredura dos ACs | ☐ |

**Nenhuma ADR nova.** A regra está na **emenda de 2026-10-02 da ADR 0004** ("a mesma verificação vale
ao abrir rodada" na Fase 4) e no glossário (`docs/CONTEXT.md`, verbetes **Fase 4** e **Rodada de
referência**). Se algo divergir, emende a ADR em vez de improvisar no código.

**Sem migration.** `rd_phase_range` já aceita `phase` de 2 a 4 e `projects_phase_check` de 1 a 4
(`lib/db/schema.ts`). `rounds` já guarda as duas versões. Nada de schema.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Pré-condições de abrir rodada | `(tabs)/rounds/preconditions.ts` (`RoundInputs`, `RoundBlocker`, `roundBlockers`, `canOpenRound`, `roundBlockerSummary`, `roundBlockerMessage`) | perde `phase_unavailable`, ganha `versions` e os bloqueios da Fase 4 (Parte 1) |
| Action de criar rodada | `(tabs)/rounds/actions.ts` (`createRound`: authz → transação → `FOR UPDATE` em `projects` → `loadCodebook`/`loadPrompt`/`loadOpenRound` → `roundBlockers` → insert com `phase: project.phase`) | passa a carregar `listRounds` e a montar `versions` (Parte 1). **Já grava a fase do projeto**: nada a mudar no insert |
| Rodada de referência | `(tabs)/rounds/reference-round.ts` (da #81: `projectReferenceRound`, `referenceVersionsOf`, `versionChanges`, `versionChangesSentence`, tipos `VersionCheck`/`VersionChange`) | só usado. **Não importe `./rounds` nele** (puxa `@/lib/db` para o cliente; ver #81, divergência 1) |
| Tela de Rodadas | `(tabs)/rounds/page.tsx` (já carrega `listRounds`, `loadCodebook` e `loadPrompt` para o Administrador; chama `roundBlockers` e passa a `NewRound`) | monta `versions` sem consulta nova (Parte 1) |
| Nova rodada | `(tabs)/rounds/new-round.tsx` (lista os bloqueios com `roundBlockerSummary` + tooltip `roundBlockerMessage`; no sucesso, tooltip `codebookLockedMessage`) | herda os bloqueios novos sem mudança; o tooltip do sucesso é D8 (Parte 3) |
| Fechar rodada | `(tabs)/rounds/close-round.tsx` (`roundInputSummary(round.phase)`, tooltip `codebookLockedMessage`, `closeConfirmationLines`) | textos que mentem na Fase 4 (D8, D9, Parte 3) |
| Composição da entrada | `pipeline/llm-input.ts` (`composeLlmInput`: `phase >= PHASE_3` → codebook completo) e `pipeline/responses.ts` (`loadRoundComposition` lê `rounds.phase` e as versões **da rodada**) | **sem mudança**. A Fase 4 já cai no ramo do codebook completo |
| Geração | `(tabs)/rounds/actions.ts` (`setUpGeneration`, `generateResponses`) | **sem mudança**; só prova (Parte 2) |
| Avaliação, fechamento, revisão, anotações, outlier | `(tabs)/evaluate/actions.ts` (`submitEvaluation`), `rounds/actions.ts` (`closeRound`), `rounds/review.ts` (`listReviewableRounds`), `rounds/review-access.ts`, `rounds/consensus-actions.ts` (`saveConsensusNote`), `rounds/outlier-actions.ts` (`markOutlier`) | **sem mudança**: nenhum deles olha fase (conferido com `grep`). Só prova (Parte 2) |
| Congelamento | `pipeline/freeze.ts` (`isFrozen`, `frozenMessage`); `saveCodebook` checa `isFrozen` **antes** da rodada aberta, e o editor idem | **sem mudança**. Com rodada aberta na Fase 4, quem fala é o congelamento |
| Confirmação do avanço | `pipeline/preconditions.ts` (`phase4ConfirmationLines`) | ganha a frase da história 9 (D7, Parte 3) |
| Testes vizinhos | `rounds/preconditions.unit.test.ts` (`describe('… rodada na Fase 4')`, linha ~357; `describe('… o que a rodada manda à LLM')`), `rounds/actions.int.test.ts` (helpers `readyProject`, `roundsOf`, `codebookVersionsOf`, `promptVersionsOf`; testes "criar rodada na Fase 4 é recusado" e "de ponta a ponta… recusada na Fase 4"), `rounds/page.int.test.ts` (teste "na Fase 4 a nova rodada fica recusada…", helpers `roundWith`, `newRoundOf`), `rounds/generate-responses.int.test.ts` (LLM falsa `llm.inputs`, helper com `projectPhase`/`roundPhase`, teste "a rodada da Fase 3 manda o codebook completo da versão congelada"), `evaluate/page.int.test.ts` (`scenario`, "a tela de avaliação é igual nas Fases 2 e 3", "na Fase 3, a tela de avaliação não diz a fase…"), `pipeline/advance-phase-3.int.test.ts` (helpers `seedVersions`, `seedReferenceRound`, `currentVersionsOf`) | copiar helpers e espelhar os casos |

O que **falta**, e esta fatia cria: a pré-condição das versões na abertura de rodada (com a recusa sem
rodada de referência, D2), a carga das versões em `createRound` e na tela de Rodadas, as provas de que o
ciclo inteiro funciona na Fase 4, e os textos que hoje dizem coisa errada numa rodada da Fase 4.

---

## 2. A regra, por extenso

### O que trava a abertura na Fase 4

As pré-condições de sempre (rodada aberta, codebook completo, prompt) continuam valendo em toda fase.
Na Fase 4, **e só nela**, entra mais uma: **codebook e prompt vigentes iguais aos da rodada de
referência do projeto** (`projectReferenceRound`: a rodada fechada da Fase 3 de maior número). Igual
quer dizer o mesmo `version_number` (#81, D2). Mudou o codebook, o prompt ou os dois: recusa, no
servidor, na mesma transação que cria a rodada, com mensagem que nomeia o que mudou com os números e
manda voltar à Fase 3, abrir e fechar uma rodada com essas versões e avançar de novo.

### Quando isso acontece

Num projeto que avançou depois da #81, **nunca**: o avanço exige as versões da referência, e o
congelamento da #80 impede criar versão nova na Fase 4. A regra protege os projetos que avançaram antes
(§ 6 tem a consulta para saber se há algum em prod) e fecha a porta no ponto em que a versão de fato
congela. O teste de integração monta o caso semeando a versão nova direto no banco, por baixo do
congelamento.

### O que não trava

- **ICR e Qualidade**, nunca. `roundBlockers` continua sem receber métrica.
- **Rodadas da Fase 4 anteriores.** Depois de fechar uma rodada da Fase 4, a seguinte abre pelas mesmas
  regras; a referência continua sendo a última fechada da Fase 3, e as versões continuam as mesmas
  (história 2). Rodada da Fase 4 nunca vira referência.
- **Metadados do prompt** não criam versão (#81), então não mudam nada aqui.

### A corrida continua fechada

`createRound`, `saveCodebook`, `savePrompt` e `advancePhase` travam a mesma linha de `projects` com
`FOR UPDATE`. A carga das rodadas e das versões acontece **dentro** da transação, depois do lock, junto
das cargas que já existem.

### O que a rodada da Fase 4 faz depois de aberta

Tudo igual à Fase 3: `rounds.phase = 4`, a geração monta a entrada com o codebook completo **da versão
congelada pela rodada** (`loadRoundComposition` lê as versões da rodada, não as vigentes), e fila,
rótulo, avaliação imutável, fechamento, revisão de discordâncias, anotações de consenso e marca de
outlier não olham fase. O Avaliador não vê fase nenhuma e só alcança a revisão das rodadas em que
enviou avaliação (`listReviewableRounds`), então quem é novo na Fase 4 não vê as atas das Fases 2 e 3.

---

## 3. Decisões

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. `RoundInputs` ganha `versions: VersionCheck | null`, obrigatório.** Mesmo espírito da #81 (D3):
obrigatório para nenhum chamador esquecer a regra. Quem chama monta com `referenceVersionsOf(rounds, {
codebook, prompt })`, a mesma ponte que o avanço usa. Nas Fases 2 e 3 o campo é ignorado.

```ts
export type RoundInputs = {
  phase: number
  definitions: readonly RoundDefinition[]
  criteria: readonly CriterionScope[]
  hasPromptVersion: boolean
  openRoundNumber: number | null
  versions: VersionCheck | null
}

export type RoundBlocker =
  | { key: 'phase'; phase: number }
  | { key: 'open_round'; roundNumber: number }
  | { key: 'definition' }
  | { key: 'criteria'; titles: string[] }
  | { key: 'prompt' }
  | { key: 'no_reference_round' }
  | { key: 'versions_changed'; referenceRound: number; changes: VersionChange[] }
```

`phase_unavailable` **sai** do tipo, de `roundBlockers` e das duas mensagens. Os bloqueios da Fase 4
entram **por último**, depois de `prompt`, e só com `phase >= PHASE_4`. Como a action devolve
`roundBlockerMessage(blockers[0])`, com rodada aberta e versões diferentes o servidor fala primeiro da
rodada aberta (na prática impossível: a rodada aberta da Fase 4 usa as versões congeladas).

**D2 ⚠. Na Fase 4 sem rodada de referência, recusar (`no_reference_round`).** `referenceVersionsOf`
devolve `null` quando não há rodada fechada da Fase 3 (ou quando falta versão vigente, caso já coberto
por `definition`/`prompt`). Esse estado é inalcançável pelo app desde a #77 (o avanço exige rodada
fechada da Fase 3), mas existe em seed e em projeto levado à Fase 4 por fora. Recomendação: **recusar**,
porque a Fase 4 só testa o que a Fase 3 avaliou e, sem referência, não há o que comparar (a #84
quebraria). Regra: com `phase >= PHASE_4` e `versions === null`, empurra `no_reference_round` **só se**
não houver `definition`, `criteria` nem `prompt` na lista (para não acusar falta de referência quando o
que falta é versão vigente). Alternativa: deixar abrir sem referência; descartada por abrir uma rodada da
Fase 4 que nenhuma leitura sabe ler.

**D3. Mensagens.** A descrição do que mudou reaproveita `versionChangesSentence(referenceRound,
changes)` da #81 (que já diz "a rodada r, a última fechada da Fase 3, usou a versão a, e a vigente é a
b"). Redação (ajustar, preservando o conteúdo):

- `roundBlockerSummary(versions_changed)`: `O codebook mudou depois da rodada de referência, a rodada
  {r}.` / `O prompt mudou…` / `O codebook e o prompt mudaram…`.
- `roundBlockerMessage(versions_changed)`: `versionChangesSentence(…)` + ` Uma rodada aberta assim
  testaria na Fase 4 uma versão que nenhum avaliador aplicou na Fase 3. Para abrir, volte à Fase 3, abra
  e feche uma rodada com as versões vigentes e avance de novo.`
- `roundBlockerSummary(no_reference_round)`: `Nenhuma rodada da Fase 3 foi fechada, e a Fase 4 só testa
  o que a Fase 3 avaliou.`
- `roundBlockerMessage(no_reference_round)`: `Este projeto está na Fase 4 sem nenhuma rodada fechada da
  Fase 3, e a Fase 4 só testa o codebook e o prompt que uma rodada da Fase 3 avaliou. Volte à Fase 3,
  abra e feche uma rodada e avance de novo.`

Nenhuma palavra sobre ICR ou Qualidade. O "volte à Fase 3" ainda não tem botão até a #86 (§ 5): é o
caminho certo, e os dois casos só acontecem em projeto antigo.

**D4. Comparação por número, como na #81 (D2).** Nada de comparar ids. `listRounds` já traz
`codebookVersionNumber` e `promptVersionNumber`.

**D5. A carga em `createRound`.** Depois do `FOR UPDATE`, junto das cargas de hoje:

```ts
const versions = referenceVersionsOf(await listRounds(projectId, tx), {
  codebook: codebook.version?.versionNumber ?? null,
  prompt: prompt.version?.versionNumber ?? null,
})
```

Uma consulta a mais (`listRounds`), só nesta action. Não mude a ordem `authz → transação → FOR UPDATE`,
nem `CREATE_DENIED`, nem o insert (`phase: project.phase` já grava 4).

**D6. A tela de Rodadas monta `versions` com o que já carrega.** Em `(tabs)/rounds/page.tsx`, `rounds`,
`codebook` e `prompt` já vêm para o Administrador. Basta mover `codebookVersionNumber`/
`promptVersionNumber` para antes de `roundBlockers` e passar `versions: referenceVersionsOf(rounds, {
codebook: codebookVersionNumber, prompt: promptVersionNumber })`. Nenhuma consulta nova. `NewRound` já
lista qualquer bloqueio com resumo + tooltip; não precisa saber dos bloqueios novos.

**D7. A frase da história 9 na confirmação do avanço.** A confirmação **nunca teve** a frase "a Fase 4
ainda não está disponível na ferramenta" (conferido no `git log -S`: a frase só existiu em
`roundBlockerSummary`/`roundBlockerMessage`, que saem na Parte 1). O que falta é dizer que a escolha dos
itens e dos avaliadores novos é do Administrador. Proposta para a primeira linha de
`phase4ConfirmationLines()`:

> Na Fase 4, a avaliação se repete sobre codebook e prompt congelados enquanto ela durar, para medir se o
> codebook generaliza. Ela pede itens de entrada novos e avaliadores novos, e quais são é escolha do
> Administrador: a ferramenta não recusa item já usado nem avaliador que já avaliou antes. A Fase 3
> continua visível como está: rodadas, avaliações, concordância, Qualidade e anotações ficam onde estão.

Sem prometer a marca de uso/participação (é da #83) e sem falar em voltar (é da #86; o teste que proíbe
"voltar" continua de pé). Os testes existentes de `phase4ConfirmationLines` continuam verdes porque
"codebook e prompt congelados enquanto ela durar" e "A Fase 3 continua visível como está" ficam.

**D8 ⚠. Os textos de rodada que prometem destravar ganham a variante da Fase 4.** Hoje três lugares
dizem que fechar a rodada destrava o codebook, o que é falso na Fase 4 a partir desta fatia:

- tooltip de "Rodada N aberta." em `new-round.tsx` (`codebookLockedMessage`: "Feche a rodada para
  voltar a editar");
- tooltip ao lado da rodada aberta em `close-round.tsx` (idem);
- segunda linha de `closeConfirmationLines`: "O codebook volta a ser editável…".

Recomendação: `codebookLockedMessage` **não muda** (é usada em `saveCodebook` e no editor, onde o
congelamento já fala antes na Fase 4). Cria-se `phase4RoundLockedMessage(roundNumber)` (ex.: `A rodada N
está aberta. Na Fase 4 o codebook e o prompt já estão congelados pela fase, e continuam assim depois do
fechamento.`) e `closeConfirmationLines(roundNumber, phase)`, cuja segunda linha na Fase 4 vira `O
codebook e o prompt continuam congelados pela Fase 4, e a rodada continua visível com tudo o que
produziu.` `NewRound` ganha a prop `phase`; `CloseRound` usa `round.phase` (a rodada aberta é sempre da
fase do projeto). Alternativa: deixar para a #86, que é quem descongela; descartada porque é esta fatia
que torna a rodada da Fase 4 possível, e a tela mentiria até lá.

**D9 ⚠. `roundInputSummary(4)` passa a dizer "Rodada da Fase 4".** Hoje a Fase 4 cai no ramo `>=
PHASE_3` e o texto diz `Rodada da Fase 3: a LLM recebe…`, o que é errado numa rodada da Fase 4 (aparece
em `close-round.tsx` e em `rounds/[roundId]/page.tsx`, só para o Administrador). Recomendação: o ramo do
codebook completo usa `Rodada da Fase ${phase}:`, mesmo conteúdo. **Teste antigo editado** (citar no
commit): `preconditions.unit.test.ts`, "a partir da Fase 3 a frase é a da Fase 3", que hoje exige
`roundInputSummary(4) === roundInputSummary(PHASE_3)`; vira "a partir da Fase 3 a frase é a do codebook
completo, com a fase da rodada". O teste da tela do avaliador que proíbe `roundInputSummary(PHASE_2/3)`
ganha `PHASE_4`.

**D10. Para o Avaliador nada muda no código.** Só prova (Partes 2 e 3).

---

## 4. Fronteira com as fatias vizinhas

- **#80 (congelamento, fechada)** e **#81 (avanço, fechada)** são as duas metades que tornam a recusa
  desta fatia rara. `freeze.ts`, `advancePhase`, `phase3Blockers` e `reference-round.ts` **não mudam**;
  só são usados.
- **#83 (uso e participação por fase)** é dona das marcas "usado nas rodadas…" e "avaliou nas
  rodadas…". A frase de D7 não as promete.
- **#84 (leitura ao lado da referência)** é dona do bloco de comparação, das séries com a Fase 4 e da
  marca no painel de concordância. Aqui a tela de uma rodada da Fase 4 mostra o que uma rodada da Fase
  3 mostra (ICR e Qualidade, porque `hasQuality(4)` já é verdade), e nada mais. **Não monte comparação.**
- **#85 (orientação e "o que mudou" na Fase 4)** é dona do texto de orientação da Fase 4
  (`hasReadingGuidance(4)` continua falso aqui, então a rodada da Fase 4 fica sem orientação até lá) e
  da frase de entrada na Fase 4 em `round-changes`. Aqui a primeira rodada da Fase 4 mostra só o
  genérico "Fase: 3 → 4".
- **#86 (retorno)** é dona do botão de voltar, da frase "é possível voltar à Fase 3" na confirmação e de
  editar o teste que proíbe "voltar". As mensagens de D3 mandam voltar antes de o botão existir (§ 5).

---

# Parte 1 — A regra

**Objetivo:** abrir rodada na Fase 4 funciona no servidor e na tela, com a pré-condição das versões. No
fim, `npm test` prova em unitário e em integração que a rodada nasce com a fase 4, que versões
diferentes recusam com a mensagem certa e que o Avaliador é barrado.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `(tabs)/rounds/preconditions.ts` (bloco de `roundBlockers` e as
duas mensagens), `(tabs)/rounds/reference-round.ts`, `(tabs)/rounds/actions.ts` (`createRound`),
`(tabs)/rounds/page.tsx` (do `transaction` até `roundBlockers`) e os testes listados em 1.4.

### 1.1 `(tabs)/rounds/preconditions.ts`

- Tipos de D1, importando `VersionCheck` e `VersionChange` de `./reference-round` (só tipo, `import
  type`).
- `roundBlockers`: apagar o ramo de `phase_unavailable`; no fim, com `phase >= PHASE_4`, a regra de D2
  (`no_reference_round`) e, com `versions !== null`, `versions_changed` quando `versionChanges(...)` não
  é vazio.
- `roundBlockerSummary` e `roundBlockerMessage`: apagar `case 'phase_unavailable'`, acrescentar os dois
  de D3. O `switch` sem `default` faz o TypeScript cobrar.
- **Atenção ao bundle do cliente**: `new-round.tsx` (cliente) importa `preconditions.ts`. Importar
  valores de `./reference-round` é seguro (ele só importa `./round-status` e `pipeline/preconditions`);
  **nunca** de `./rounds`.

### 1.2 `(tabs)/rounds/actions.ts`

D5. Importar `listRounds` de `./rounds` (o arquivo já importa `isOpen`, `loadOpenRound`… de lá) e
`referenceVersionsOf` de `./reference-round`.

### 1.3 `(tabs)/rounds/page.tsx`

D6.

### 1.4 Testes da Parte 1

`(tabs)/rounds/preconditions.unit.test.ts`:

- [ ] O helper `inputs()` ganha `versions: null` no padrão. Nenhum caso antigo das Fases 1 a 3 muda.
- [ ] **O `describe('… rodada na Fase 4')` é reescrito** (teste antigo editado, citar no commit): os três
      casos de `phase_unavailable` dão lugar a:
  - [ ] **Versões iguais às da referência**: liberado, `canOpenRound` verdadeiro.
  - [ ] **Codebook mudou**, **prompt mudou**, **os dois mudaram** (`it.each`): um `versions_changed`
        com as `changes` certas, e `canOpenRound` falso.
  - [ ] **Sem rodada de referência** (`versions: null`, codebook completo, prompt): `[no_reference_round]`.
  - [ ] **Sem referência e sem prompt**: só `prompt` (D2, não acusa a referência).
  - [ ] **Ordem**: rodada aberta e versões diferentes → `['open_round', 'versions_changed']`.
  - [ ] **As Fases 2 e 3 ignoram `versions`**: com `versions` diferentes, nenhum bloqueio novo.
  - [ ] **Mensagens**: as três de `versions_changed` nomeiam o que mudou com os números e a rodada de
        referência, e contêm "volte à Fase 3"; a de `no_reference_round` também. Nenhuma contém "ICR",
        "Qualidade", "concordância" nem "ainda não está disponível".
- [ ] **`phase_unavailable` não existe mais**: nenhuma mensagem de nenhum bloqueio contém "ainda não está
      disponível" (varrer as chaves).

`(tabs)/rounds/actions.int.test.ts` (helper novo `phase4Project(admin)`: `readyProject(admin, PHASE_4)`
+ rodada 1 **fechada da Fase 3** com as versões v1, via `addRound(…, { status: 'closed', phase:
PHASE_3 })`; confira se `addRound` preenche `closedAt` com `status: 'closed'`. Se for útil, copie
`seedVersions` de `pipeline/advance-phase-3.int.test.ts`):

- [ ] **Cria e grava a fase 4**: `createRound` → `{ ok: true, roundNumber: 2 }`; a rodada 2 tem
      `phase: PHASE_4`, `status: 'open'` e as versões v1; `usedAt` das duas versões preenchido.
- [ ] **Codebook diferente** (v2 de codebook semeada depois da rodada 1, por baixo do congelamento):
      `{ error: roundBlockerMessage({ key: 'versions_changed', referenceRound: 1, changes: [{ subject:
      'codebook', reference: 1, current: 2 }] }) }`, nenhuma rodada criada, `usedAt` da v2 continua
      nulo.
- [ ] **Prompt diferente** e **os dois** (`it.each` com o anterior). A string dos dois tem os quatro
      números.
- [ ] **Sem rodada de referência**: **teste antigo editado** "criar rodada na Fase 4 é recusado, e nada
      muda" (projeto na Fase 4 sem rodada nenhuma) passa a esperar `no_reference_round`; o resto do
      teste (nada muda, `usedAt` nulo) fica.
- [ ] **De ponta a ponta**: **teste antigo editado** "de ponta a ponta: cria, fecha e avança da Fase 3,
      e a rodada seguinte é recusada na Fase 4" vira "…e a rodada seguinte abre na Fase 4": a rodada 2
      nasce com `phase: PHASE_4` e com **os mesmos** `codebookVersionId`/`promptVersionId` da rodada 1.
- [ ] **O Avaliador é barrado**: avaliador ativo do projeto na Fase 4 → `{ error: CREATE_DENIED }` (a
      string, se não for exportada, compare pelo texto como os testes vizinhos fazem), nenhuma rodada.
- [ ] **A recusa por rodada aberta continua igual na Fase 4**: com a rodada 2 (Fase 4) aberta, criar de
      novo → mensagem de `open_round` da rodada 2.

`(tabs)/rounds/page.int.test.ts`:

- [ ] **Teste antigo editado** "na Fase 4 a nova rodada fica recusada, e as rodadas da Fase 3 continuam
      listadas com a Qualidade": a cena (rodada 1 fechada da Fase 3, projeto na Fase 4, versões iguais)
      agora dá `blockers: []` e o botão habilitado; renomear para "na Fase 4, com as versões da rodada de
      referência, a nova rodada fica liberada…". As asserções da lista e da Qualidade ficam.
- [ ] **Versões diferentes na tela**: a mesma cena com v2 de codebook semeada → `blockers` com
      `versions_changed`, botão desabilitado, e o texto de `NewRound` contém o resumo de D3.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Testes antigos editados: o `describe` da Fase 4
em `preconditions.unit.test.ts`, os dois de `actions.int.test.ts` e o de `page.int.test.ts` citados
acima. Mais nenhum.

Commit sugerido: `feat(rodadas): abrir rodada na fase 4 com as versões da rodada de referência`.

### O que a Parte 2 herda

- **Nomes finais**: `RoundInputs.versions: VersionCheck | null` (obrigatório); bloqueios
  `{ key: 'no_reference_round' }` e `{ key: 'versions_changed'; referenceRound; changes }`, empurrados
  por último e só com `phase >= PHASE_4`. `phase_unavailable` não existe mais em lugar nenhum.
- **Textos finais**: os de D3, sem ajuste. O resumo de `versions_changed` sai de um helper privado
  `versionChangesSubject(changes)` ("O codebook mudou" / "O prompt mudou" / "O codebook e o prompt
  mudaram") + ` depois da rodada de referência, a rodada {r}.`; a mensagem começa com
  `versionChangesSentence(...)`.
- **D2 aplicada como recomendada** (recusar com `no_reference_round`, só se não houver `definition`,
  `criteria` nem `prompt`). Confirmar com o dono se quiser outra coisa.
- **Helper novo nos testes**: `phase4Project(admin)` em `rounds/actions.int.test.ts` (projeto na Fase 4 +
  rodada 1 fechada da Fase 3 com v1/v1). `addRound` com `status: 'closed'` já preenche `closedAt`; não
  marca `usedAt` das versões (só a action marca). A v2 "por baixo do congelamento" é semeada com
  `addCodebookVersion(..., { versionNumber: 2, ... })` / `addPromptVersion(..., { versionNumber: 2 })`;
  `seedVersions` não foi copiado.
- **Testes antigos editados**: o `describe('… rodada na Fase 4')` de `preconditions.unit.test.ts`
  (reescrito), "criar rodada na Fase 4 é recusado, e nada muda" (agora "…sem rodada de referência…") e
  "de ponta a ponta… recusada na Fase 4" (agora "…abre na Fase 4") em `actions.int.test.ts`, e "na Fase
  4 a nova rodada fica recusada…" (agora "…com as versões da rodada de referência, a nova rodada fica
  liberada…") em `page.int.test.ts`. O helper `inputs()` do unitário ganhou `versions: null`.
- **Divergências**: nenhuma de comportamento.
- **Suíte**: `npm test` com 84 arquivos e 1230 testes verdes; `lint` e `typecheck` verdes.

---

# Parte 2 — O ciclo

**Objetivo:** provar em integração que uma rodada da Fase 4 percorre o ciclo inteiro como uma da Fase 3,
e que a seguinte abre pelas mesmas regras. **Código de produção esperado: nenhum.** Se algum teste
cair, a causa é uma trava por fase que o `grep` não viu: corrija na menor mudança e anote em "o que a
Parte 3 herda".

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 2 herda", `(tabs)/rounds/generate-responses.int.test.ts`
(LLM falsa e o teste "a rodada da Fase 3 manda o codebook completo da versão congelada"),
`(tabs)/evaluate/actions.int.test.ts`, `(tabs)/rounds/outlier-actions.int.test.ts`,
`(tabs)/rounds/consensus-actions.int.test.ts` e `(tabs)/evaluate/access.int.test.ts` (ou onde estiver o
teste de `listReviewableRounds`).

### 2.1 Geração (`generate-responses.int.test.ts`)

- [ ] **A rodada da Fase 4 manda o codebook completo da versão congelada, não o da vigente**: espelho do
      teste da Fase 3 com `projectPhase: PHASE_4, roundPhase: PHASE_4`; depois da rodada, semear uma v2
      de codebook com outro título/critério; `llm.inputs` é `[await expectedInput(PHASE_4, project,
      codebookVersion, 'conteúdo do item 1')]`, contém `CODEBOOK_HEADING` e os critérios da v1, e não
      contém nada da v2. A entrada gravada (`sentInputsOf`) é a mesma enviada.
- [ ] Se o `it.each([PHASE_2, PHASE_3])` de "entrada gravada" couber, acrescente `PHASE_4` a ele em vez
      de um teste novo (é extensão, não edição de comportamento; citar no commit).

### 2.2 O ciclo de ponta a ponta (arquivo novo `(tabs)/rounds/phase-4-round.int.test.ts`)

Um arquivo só para a história 1 e 2, com o caminho real das actions. Cena: projeto na Fase 4, rodada 1
fechada da Fase 3 (a referência), dois avaliadores **novos** (Carla, Davi) que não avaliaram a rodada 1
e um **veterano** (Ana) que avaliou. LLM falsa como em `generate-responses.int.test.ts` (copie o
`vi.mock` de `@/lib/ai`).

- [ ] **Abrir e gerar**: `createRound` (rodada 2, Fase 4) → `generateResponses` com 2 itens novos → duas
      respostas com as versões da rodada.
- [ ] **Avaliar**: Ana, Carla e Davi enviam `submitEvaluation` nas duas respostas; uma segunda chamada
      sobre a mesma resposta é recusada como em qualquer fase (avaliação imutável).
- [ ] **Fechar**: `closeRound` → fechada; gerar ou avaliar depois é recusado com as mensagens de
      sempre.
- [ ] **Outlier**: `markOutlier` em Ana na rodada 2, com justificativa → gravado; `loadRoundOutliers`
      devolve Ana (é o caminho da emenda da ADR 0004 para tirar o veterano do cálculo).
- [ ] **Anotação de consenso**: `saveConsensusNote` numa célula da rodada 2 → gravada.
- [ ] **Revisão**: `listReviewableRounds` de Carla devolve **só** a rodada 2; o de Ana devolve 1 e 2.
      `requireReviewableRound` da rodada 1 para Carla é recusado (quem é novo na Fase 4 não alcança as
      atas da Fase 3).
- [ ] **A rodada seguinte**: `createRound` de novo → rodada 3, `phase: PHASE_4`, **as mesmas** versões
      da rodada 2 (história 2); a referência continua a rodada 1.
- [ ] **Avaliador barrado no ciclo**: Carla chamando `createRound` e `closeRound` → recusas de
      administrador.

Se o arquivo ficar grande, quebre em `describe`s, não em arquivos. Siga a memória: a suíte precisa de
`scores` vazia no início; use o `cleanup` dos helpers.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, sem teste antigo editado nesta Parte (salvo a
extensão opcional do `it.each`).

Commit sugerido: `test(rodadas): ciclo completo de uma rodada da fase 4`. Se algum código mudou, use
`fix(rodadas): …` e descreva no corpo.

### O que a Parte 3 herda

- **Código de produção: nenhum.** Nenhuma trava por fase apareceu no ciclo; geração, avaliação,
  fechamento, outlier, anotação e revisão funcionaram na Fase 4 sem mudança.
- **Geração**: teste novo "a rodada da Fase 4 manda o codebook completo da versão congelada, não o da
  vigente" em `generate-responses.int.test.ts` (a v2 semeada tem título próprio, para provar que nem os
  títulos da vigente vão). **Extensão** (citar no commit): o `it.each` de "entrada gravada" passou a
  `[PHASE_2, PHASE_3, PHASE_4]`, com a condição `phase === PHASE_3` trocada por `phase >= PHASE_3`.
- **Arquivo novo** `(tabs)/rounds/phase-4-round.int.test.ts`, com `describe`s por etapa (abrir e gerar,
  avaliar, fechar, depois de fechar, a rodada seguinte, o Avaliador é barrado). Cena: projeto na Fase 4,
  rodada 1 fechada da Fase 3 com resposta avaliada por Ana (veterana), Carla e Davi novos, três itens
  novos. Helpers `openPhase4Round` (cria + gera 2 itens) e `closedPhase4Round` (+ os três avaliam + fecha).
- **Gotcha**: `submitEvaluation` **redireciona** (`NEXT_REDIRECT:/projects/…/evaluate?response=…&sent=1`)
  enquanto sobra pendente na fila de quem avalia; só a última devolve `{ ok: true }`. O helper `evaluate`
  aceita os dois. O mock de `next/navigation` precisa de `notFound` para `requireReviewableRound`.
- **Divergências**: nenhuma. Sem teste antigo editado além da extensão do `it.each`.
- **Suíte**: `npm test` com 85 arquivos e 1240 testes verdes; `lint` e `typecheck` verdes; `scores` vazia
  depois da suíte.

---

# Parte 3 — Os textos e as telas

**Objetivo:** nenhuma tela diz coisa errada numa rodada da Fase 4, a confirmação do avanço ganha a frase
da história 9, e a tela do avaliador é provada igual nas três fases. No fim, a issue fecha.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, os dois "o que herda", `pipeline/preconditions.ts`
(`phase4ConfirmationLines`), `(tabs)/rounds/preconditions.ts` (`codebookLockedMessage`,
`closeConfirmationLines`, `roundInputSummary`), `new-round.tsx`, `close-round.tsx` e os testes da tela do
avaliador nas Fases 2 e 3.

### 3.1 `pipeline/preconditions.ts`

`phase4ConfirmationLines()` com a primeira linha de D7. As outras duas não mudam.

### 3.2 `(tabs)/rounds/preconditions.ts`

- D8: `phase4RoundLockedMessage(roundNumber)` e `closeConfirmationLines(roundNumber, phase)`.
- D9: `roundInputSummary` com a fase da rodada no ramo do codebook completo.

### 3.3 `new-round.tsx`, `close-round.tsx` e `(tabs)/rounds/page.tsx`

- `NewRound` recebe `phase` (de `project.phase`) e escolhe o tooltip do sucesso por D8.
- `CloseRound` escolhe o tooltip e as linhas da confirmação por `round.phase`.
- Nada de `InfoTooltip` dentro do `<dialog>` (memória): as linhas da confirmação continuam inline.

### 3.4 Testes da Parte 3

`pipeline/preconditions.unit.test.ts`:

- [ ] **A confirmação diz que a escolha é do Administrador**: o texto contém "itens de entrada novos e
      avaliadores novos" e "escolha do Administrador"; **não** contém "disponível", "marca", "voltar".
      Os testes antigos do `describe('phase4ConfirmationLines')` continuam verdes sem edição.

`(tabs)/rounds/preconditions.unit.test.ts`:

- [ ] **D8**: `phase4RoundLockedMessage(2)` nomeia a rodada, fala em congelado pela Fase 4 e **não**
      contém "Feche a rodada para voltar a editar"; `closeConfirmationLines(2, PHASE_4)` não contém
      "volta a ser editável"; `closeConfirmationLines(2, PHASE_3)` é igual ao de hoje (o teste "cabe em
      poucas linhas curtas" passa a chamar com a fase; edição mecânica, citar no commit).
- [ ] **D9**: `roundInputSummary(PHASE_4)` contém `Fase ${PHASE_4}` e "codebook completo", e difere de
      `roundInputSummary(PHASE_3)` só no número da fase. **Teste antigo editado** "a partir da Fase 3 a
      frase é a da Fase 3".

`(tabs)/rounds/page.int.test.ts`:

- [ ] **Rodada aberta da Fase 4**: o `CloseRound` recebe a rodada com `phase: PHASE_4`; o markup tem
      `roundInputSummary(PHASE_4)` e o tooltip de D8.

`(tabs)/evaluate/page.int.test.ts`:

- [ ] **A tela de avaliação é igual nas Fases 2, 3 e 4**: estender o teste "igual nas Fases 2 e 3" com
      `scenario(admin, { phase: PHASE_4 })` (a rodada da cena precisa nascer com `phase: 4`; confira se
      `scenario` usa a fase do projeto na rodada) e renomear. Extensão, citar no commit.
- [ ] **Na Fase 4, a tela não diz a fase**: espelho do teste "na Fase 3, a tela de avaliação não diz a
      fase…", para Avaliador e Administrador-avaliador; acrescentar `roundInputSummary(PHASE_4)` à lista
      proibida.

`(tabs)/page.int.test.ts`:

- [ ] O teste da confirmação (`advance!.lines` igual a `phase4ConfirmationLines()`) continua verde sem
      edição; conferir.

### 3.5 Conferência no navegador

Siga as memórias: `/dev/login` para entrar, `resize_window`/`get_page_text` se o pane mostrar a faixa
preta, e a **LLM falsa por fetch** (`NODE_OPTIONS=--require …`) para gerar respostas no dev local, que
não tem `OPENAI_API_KEY`. Roteiro:

1. Projeto na Fase 3 com uma rodada fechada da Fase 3 → avançar: a confirmação tem a frase de D7.
2. Na Fase 4, Rodadas: "Nova rodada" liberada, "Esta rodada vai congelar o codebook vX e o prompt vY"
   com as versões da rodada de referência → criar: sucesso com o tooltip de D8.
3. Gerar respostas (LLM falsa) → a rodada mostra "Rodada da Fase 4: …" e a entrada enviada com o
   codebook completo.
4. Entrar como avaliador: a tela de avaliação não diz a fase; avaliar.
5. Fechar a rodada: a confirmação não diz que o codebook volta a ser editável.
6. Abrir a rodada seguinte: abre na Fase 4 com as mesmas versões.
7. Recusa: semear por `psql` uma v2 de codebook no projeto e recarregar Rodadas → bloqueio com o resumo
   e o tooltip de D3, botão desabilitado.

A 375px, medido em iframe. **Apagar a cena antes de `npm test`** (`scores` vazia).

### 3.6 Varredura dos ACs

| AC da issue | Onde é provado |
|---|---|
| Abrir rodada na Fase 4, com as versões da referência, cria a rodada com a fase 4 | P1 (unitário + integração) + P2 (ponta a ponta) |
| A recusa "fase indisponível" deixa de existir | P1 (tipo, mensagens e varredura das chaves) |
| Versões diferentes recusadas no servidor, mensagem nomeia as versões | P1 (unitário, integração com a string exata, tela) |
| A geração envia o codebook completo da versão congelada | P2 (2.1) |
| Depois de fechar uma rodada da Fase 4, abre a seguinte com as mesmas regras | P1 (ponta a ponta editado) + P2 (rodada 3) |
| Avaliação, fechamento, revisão, anotações e outlier funcionam na Fase 4 | P2 (2.2) |
| A confirmação do avanço não fala em indisponível e diz que itens e avaliadores são escolha do Administrador | P3 (3.4) |
| A tela de avaliação não diz a fase | P3 (3.4) |
| O Avaliador é barrado ao criar rodada | P1 + P2 |

| Teste da issue | Onde |
|---|---|
| Unitário: pré-condições com versões iguais e diferentes | P1 |
| Integração: criar na Fase 4 grava a fase 4 | P1 |
| Integração: versões diferentes recusadas com a mensagem certa | P1 |
| Integração: a LLM falsa recebe o codebook completo da versão congelada | P2 |
| Integração: avaliar e fechar uma rodada da Fase 4 e abrir a seguinte | P2 |
| Integração: Avaliador barrado | P1 + P2 |
| Página: a tela de avaliação na Fase 4 é igual à das outras fases | P3 |
| Suíte verde | as três Partes |

Antes de fechar, marque os checkboxes da issue no GitHub e cite no comentário de fechamento o commit de
cada Parte.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, ACs conferidos um a um e a conferência no
navegador feita.

Commit sugerido: `feat(rodadas): textos da rodada na fase 4 e confirmação do avanço`.

### O que esta Parte fechou

_(preencher ao terminar)_

---

## 5. Fica para depois (registrar, não construir)

- **"Volte à Fase 3" sem botão.** As mensagens de D3 mandam voltar, e o retorno é da #86. Os dois
  bloqueios só acontecem em projeto que chegou à Fase 4 antes da #81 ou por fora do app. Se § 6
  encontrar algum em prod, a #86 deve ir junto ou antes.
- **"Esta rodada vai congelar…" na Fase 4** poderia dizer que são as versões da rodada de referência. A
  frase de entrada na Fase 4 é da #85; não duplicar aqui.
- **Orientação pelo ICR numa rodada da Fase 4**: nenhuma até a #85.
- **Bloco de comparação, séries e marca de participação**: #84 e #83.
- **Mensagem com rodada aberta e versões mudadas** (D1): o servidor fala só da rodada aberta, como no
  avanço (#81, D5).

## 6. Deploy

Sem migration e sem `db push`. **Antes do deploy, confira que prod não está atrasado em schema**
(memória: prod já atrasou duas vezes).

Além disso, rode em prod a consulta abaixo (somente leitura) para saber se algum projeto já está na
Fase 4 e se cairia em `no_reference_round` ou `versions_changed`. Se cair, decida antes do deploy se a
#86 vai junto.

```sql
select p.id, p.name,
       (select max(r.round_number) from rounds r
         where r.project_id = p.id and r.phase = 3 and r.status = 'closed') as referencia,
       (select max(version_number) from codebook_versions where project_id = p.id) as codebook_vigente,
       (select max(version_number) from prompt_versions where project_id = p.id) as prompt_vigente
from projects p
where p.phase = 4;
```

Compare `codebook_vigente`/`prompt_vigente` com as versões da rodada `referencia` (`rounds` →
`codebook_versions`/`prompt_versions` pelo id).
