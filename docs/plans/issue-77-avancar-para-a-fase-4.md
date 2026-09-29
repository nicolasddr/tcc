# Plano de implementação — Issue #77: "38 — Avançar da Fase 3 para a Fase 4"

Link: https://github.com/nicolasddr/tcc/issues/77
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (histórias 20 a 24, e a parte
de avanço da 25)
Blocked by: #70 (fechada) — "Rodada grava a fase" · #73 (fechada) — "Qualidade da rodada"

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu, como nos planos das #68 a #76.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Regras puras: pré-condições da Fase 3, confirmação da Fase 4, recusa de rodada na Fase 4 e contagem de rodadas por fase | ☑ |
| 2 | A action: ramo da Fase 3 em `advancePhase`, recusa de `createRound` na Fase 4 e a prova de que número não trava | ☑ |
| 3 | A tela: painel da Fase 3 com ICR e Qualidade na confirmação, recorte por fase nos painéis e varredura dos ACs | ☑ |

**Nenhuma ADR nova.** A regra inteira já está escrita: a **ADR 0004** (métrica não trava,
pré-condição estrutural trava; a Fase 4 congela codebook e prompt enquanto dura; emenda de
2026-09-22: nem ICR nem Qualidade travam o avanço da 3 para a 4) e o glossário (`docs/CONTEXT.md`,
verbete **Fase**). Esta fatia implementa o que está escrito. Se algo divergir, emende a ADR em vez
de improvisar no código.

**Sem migration.** A #70 já criou `rounds.phase` com `CHECK (phase >= 2 AND phase <= 4)` (D1 dela),
justamente para que a recusa de rodada na Fase 4 fosse regra de action e não erro `23514` do banco.
`projects.phase` já aceita 1 a 4. Nada de schema aqui.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Action de avanço | `pipeline/actions.ts` (`advancePhase`, `AdvanceOutcome`) | ganha o ramo `PHASE_3` (Parte 2) |
| Pré-condições da Fase 2 | `pipeline/preconditions.ts` (`phase2Blockers`, `phase2BlockerMessage`, `phase2BlockedMessage`, `wrongPhaseMessage`, `phase3ConfirmationLines`) | modelo das da Fase 3. **A API pública não muda** (§ 3, D1) |
| Contagem de fechadas | `(tabs)/rounds/rounds.ts` (`countClosedRounds`) | passa a filtrar pela fase da rodada (D2) |
| Rodada aberta | `(tabs)/rounds/rounds.ts` (`loadOpenRound`, `isOpen`, `focusRoundOf`) | sem mudança |
| Pré-condições de abrir rodada | `(tabs)/rounds/preconditions.ts` (`roundBlockers`, `roundBlockerSummary`, `roundBlockerMessage`) | ganha o bloqueio da Fase 4 (D6) |
| Criar rodada | `(tabs)/rounds/actions.ts` (`createRound`) | **sem mudança de código**: já chama `roundBlockers` dentro da transação com `FOR UPDATE` |
| Painel da Fase 2 | `pipeline/phase-2-checklist.tsx` (`Phase2Checklist`, `LastClosedRound`, `LastRoundSummary` local) | modelo do painel novo. O resumo sai para arquivo próprio (D7) |
| Botão + diálogo | `pipeline/advance-phase.tsx` (`AdvancePhase`) | **já é genérico** desde a #68 (`target`, `blocked`, `hint`, `lines`, `summary`). Não muda |
| Visão geral | `(tabs)/page.tsx` | já carrega `listRounds`, observações e outliers para o Administrador. Nenhuma consulta nova |
| ICR e faixa | `(tabs)/rounds/agreement-pair.ts`, `agreement-panel.tsx` (`AgreementValue`), `agreement-labels.ts` (`BAND_REFERENCE`, `notCalculableMessage`) | só importados |
| Qualidade | `(tabs)/rounds/quality.ts` (`qualityPair`, `qualityOf`, `hasQuality`), `quality-panel.tsx` (`QualityValue`), `quality-labels.ts` | só importados. A #73 já previu `QualityValue` para esta confirmação |
| Barra de fases | `phase-bar.tsx` (`PhaseBar`, `PROJECT_PHASES`) + o link `#avancar` em `(tabs)/page.tsx` | o link passa a aparecer na Fase 3 |
| Autorização | `lib/authz.ts` (`isProjectAdmin`) | sem mudança |
| Testes vizinhos | `pipeline/advance-phase-2.int.test.ts` (helpers `seedArtifacts`, `seedRound`, `rate`), `test/helpers.ts` (`addRound` já aceita `phase`) | copiar os helpers para o arquivo novo |

O que **falta**, e esta fatia cria: pré-condições puras da Fase 3, linhas da confirmação da Fase 4,
bloqueio de rodada na Fase 4, contagem por fase, ramo da action, painel da Fase 3 e o recorte por
fase nos dois painéis de avanço.

---

## 2. O avanço da Fase 3, por extenso

### O que trava e o que não trava

Duas pré-condições estruturais, no mesmo desenho do avanço da Fase 2:

1. **Nenhuma rodada aberta.** Com o projeto na Fase 3, a rodada aberta é necessariamente da Fase 3,
   porque o avanço 2 → 3 exige que não haja rodada aberta e, por isso, nenhuma rodada atravessa troca
   de fase.
2. **Ao menos uma rodada fechada *na Fase 3*.** Rodadas fechadas da Fase 2 **não contam**. É para
   isso que a #70 gravou a fase na rodada: sem rodada da Fase 3 fechada, ninguém avaliou uma resposta
   gerada com o codebook completo, e a Fase 3 não mediu nada.

**Não trava, nunca:** nem ICR (baixo, não calculável, ausente) nem Qualidade (concentrada em Baixo,
sem nota). A garantia é estrutural, como na Fase 2: `phase3Blockers` recebe
`{ openRoundNumber, closedRounds }` e não importa `lib/agreement`, `quality.ts` nem tipo nenhum de
observação. Para um número travar o avanço, alguém teria que mudar a assinatura, e isso aparece na
revisão.

### A corrida continua fechada

`createRound` e `advancePhase` travam a mesma linha de `projects` com `FOR UPDATE` e leem a fase
dentro da própria transação. Isso não muda. Consequência: uma rodada criada logo depois do avanço
enxerga a Fase 4 e é recusada pela regra nova (D6). Não há janela em que se abra uma rodada "da
Fase 4".

### O que o avanço não faz (AC)

- **Não congela nada.** Não toca em `used_at`. O congelamento da Fase 4 ("congela codebook e prompt
  enquanto durar") é do épico da Fase 4 (D5).
- **Não fecha rodada.** Com rodada aberta, recusa e manda fechar.
- **Não notifica ninguém.** Nenhuma linha em `notifications`.
- **Não apaga nem esconde nada.** Rodadas, notas, ICR, Qualidade, marcas de outlier e anotações da
  Fase 3 continuam onde estão (história 23).
- **Não constrói a Fase 4.** Move o número da fase e passa a recusar rodada nela.

### Rodada na Fase 4

Enquanto o épico da Fase 4 não existir, **abrir rodada num projeto na Fase 4 é recusado no servidor**
com mensagem própria, dizendo que a Fase 4 ainda não está disponível na ferramenta. O motivo é o da
história 24: uma rodada aberta ali mandaria à LLM o codebook completo (a composição é `>= PHASE_3`),
sobre um codebook que não está congelado e com os mesmos avaliadores. O dado pareceria da Fase 4 sem
ser.

---

## 3. Decisões desta fatia

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. A regra é uma só, e a API da Fase 2 não muda.** A lógica "rodada aberta primeiro, depois zero
fechadas" é idêntica nas duas fases. Ela vira um helper privado em `pipeline/preconditions.ts`, usado
por `phase2Blockers` e por `phase3Blockers`. Os tipos da Fase 3 são aliases:

```ts
export type Phase3Inputs = Phase2Inputs
export type Phase3Blocker = Phase2Blocker
```

As mensagens, porém, são próprias de cada fase (o texto fala da fase de destino e, na Fase 3, que as
rodadas da Fase 2 não contam). Assim, nenhum dos 17 testes unitários da Fase 2 é editado, e as duas
regras não divergem na primeira correção feita só de um lado.

**D2. `countClosedRounds` passa a exigir a fase.** A assinatura nova é
`countClosedRounds(projectId, phase, db = ownerDb)`, com a fase obrigatória na segunda posição, para
que nenhum chamador esqueça o recorte. O ramo da Fase 2 passa `PHASE_2`, o que fecha a pendência que
a #68 deixou no § 5 ("recorte de rodada por fase"). Hoje o resultado da Fase 2 não muda, porque num
projeto na Fase 2 toda rodada é da Fase 2.

**D3. A mensagem de "sem rodada fechada" diz que a Fase 2 não conta.** Quem acabou de avançar para a
Fase 3 tem várias rodadas fechadas na lista e precisa saber por que o botão está travado. Redação
(ajustar, preservando o conteúdo):

- `open_round`: `A rodada {n} ainda está aberta, e avançar para a Fase 4 deixaria para trás um ciclo
  que nunca se fecha. Feche a rodada {n} e avance de novo.`
- `no_closed_round`: `Nenhuma rodada da Fase 3 foi fechada, e sem isso a Fase 4 começaria de um prompt
  que ninguém avaliou com o codebook completo. As rodadas da Fase 2 não contam. Feche ao menos uma
  rodada da Fase 3 antes de avançar.`
- `phase3BlockedMessage`: `Não foi possível avançar para a Fase 4. ` + a mensagem do primeiro
  bloqueio. Com os dois bloqueios, acrescenta ` Como nenhuma rodada da Fase 3 foi fechada ainda,
  fechar a rodada aberta resolve as duas pendências de uma vez.` Sem bloqueio, devolve `''`. É o
  "mesmo formato das mensagens do avanço da Fase 2" que o issue pede.
- `wrongPhaseMessage(phase)` **não muda**. Passa a ser o que a Fase 4 recebe numa segunda chamada.

**D4 ⚠. A confirmação diz que a Fase 4 ainda não está disponível na ferramenta.** Hoje o avanço é
um caminho sem volta: o retorno 4 → 3 não existe, e na Fase 4 não se abre rodada. O issue proíbe
falar em retorno, mas não proíbe dizer o estado da ferramenta. Recomendação: incluir uma linha como
`A Fase 4 ainda não está disponível na ferramenta: depois do avanço, abrir rodada fica recusado até
ela existir.` Ela é honesta e não menciona voltar. Se a leitura preferida for "a confirmação só
descreve o processo", essa linha sai, e a recusa aparece só na aba Rodadas.

**D5 ⚠. "Congela codebook e prompt enquanto durar" é descrição do processo, não uma trava desta
fatia.** O AC exige as duas coisas ao mesmo tempo: a confirmação diz que a Fase 4 congela, e o avanço
não congela nada. A redação precisa manter as duas verdadeiras, por exemplo: `Na Fase 4, a avaliação
se repete com itens de entrada novos e avaliadores novos, sobre codebook e prompt congelados enquanto
ela durar, para medir se o codebook generaliza.` Na prática, **codebook e prompt continuam editáveis
num projeto na Fase 4** até o épico dela construir a trava. Isso vai para o § 5. Confirmar que isso
é aceitável. A alternativa (travar `saveCodebook`/`savePrompt` na Fase 4) é trava nova e fica fora
do AC.

**D6. Bloqueio próprio para a Fase 4 em `roundBlockers`.** Nova variante
`{ key: 'phase_unavailable'; phase: number }`, disparada com `phase >= PHASE_4`. Ela fica separada de
`{ key: 'phase' }` (que é `< PHASE_2` e manda avançar), porque a ação sugerida é a oposta: aqui não
há nada que o Administrador possa fazer. Entra primeiro na lista, como `phase`. Mensagens:

- resumo: `A Fase 4 ainda não está disponível na ferramenta.`
- completa: `Este projeto está na Fase 4, que ainda não está disponível na ferramenta. Uma rodada
  aberta agora produziria dado que parece da Fase 4 e não é, por isso abrir rodada fica recusado até
  ela existir.`

`createRound` não muda: ele já devolve `roundBlockerMessage(blockers[0])`, e a tela de rodadas já
lista os bloqueios com `roundBlockerSummary` e `InfoTooltip`.

**D7. A confirmação mostra a última rodada fechada da Fase 3, com ICR e Qualidade.** O resumo sai de
dentro de `phase-2-checklist.tsx` para `pipeline/last-round-summary.tsx`:

```ts
export type LastClosedRound = {
  roundNumber: number
  closedAt: string | null
  pair: AgreementPair
  quality?: QualityPair
}
export function LastRoundSummary({ round }: { round: LastClosedRound })
```

Com `quality`, acrescenta `QualityValue` abaixo do ICR, num bloco separado dele, mais uma frase curta
dizendo que a Qualidade não tem faixa de referência e que o julgamento é do Administrador. Nenhuma
cor nem palavra de juízo; a varredura da #73 continua valendo. Sem `quality`, o render fica igual ao
de hoje (é o caso da Fase 2). Os números vêm de `agreementPair` e `qualityPair`, as mesmas funções da
tela de rodadas. Não existe segundo cálculo.

Gotcha da memória: **não pôr `InfoTooltip` dentro do `<dialog>`**, porque o balão de 320px é
recortado. O texto de ajuda vai inline.

**D8. O painel da Fase 3 aparece a partir da Fase 3, empilhado sob o da Fase 2**, na mesma âncora
`#avancar`, e segue o desenho da #68 (divergência 3): título `Para avançar para a Fase 4`, itens
`Nenhuma rodada aberta` e `Ao menos uma rodada fechada na Fase 3`, link "Resolver" para
`/projects/<id>/rounds`. Com o projeto na Fase 4: `Badge` "Fase 3 concluída", nenhum botão e um
parágrafo dizendo que as rodadas, a concordância e a Qualidade da Fase 3 continuam ali para consulta,
sem falar em retorno. O link "Avançar fase" da `PhaseBar` passa a valer para `phase < PHASE_4`.

O painel **não** mostra a orientação pelo ICR (a #76 registrou que ela é leitura de rodada, não de
fase).

**D9. Os dois painéis passam a ler só as rodadas da sua fase.** Hoje a visão geral conta `closed` e
escolhe `lastRound` entre todas as rodadas. A #73 anotou (§ 4) que corrigir esse recorte é AC desta
fatia. Função pura nova em `(tabs)/rounds/rounds.ts`:

```ts
export function roundsInPhase<T extends { phase: number }>(rounds: readonly T[], phase: number): T[]
```

A página monta, para cada painel: `openRoundNumber` da aberta daquela fase, `closedRounds` das
fechadas daquela fase e `lastRound` da fechada de maior número daquela fase. Isso também corrige um
defeito que existe hoje: num projeto na Fase 3 com rodada aberta, o painel da Fase 2 (já concluída)
listaria "Nenhuma rodada aberta" como pendente. A tela e a action passam a contar do mesmo jeito.

**D10. `PHASE_4 = 4` e `phase4ConfirmationLines()` moram em `pipeline/preconditions.ts`**, ao lado
de `phase3ConfirmationLines`. As linhas, nesta ordem:

1. o que a Fase 4 é no processo e que ela congela codebook e prompt enquanto durar (D5), e que a
   Fase 3 continua visível como está;
2. `A decisão de avançar é do Administrador. Nenhum valor de concordância ou de Qualidade libera nem
   impede o avanço: a faixa de referência do ICR é leitura, não regra, e a Qualidade não tem faixa.`;
3. a linha de disponibilidade (D4), se confirmada;
4. `Cancelar não muda nada.` (sempre a última).

Nenhuma linha contém "voltar", "volta", "retorno" ou "retornar" (há teste).

---

## 4. Fronteira com as fatias vizinhas

- **#78 (CSV com fase e entrada enviada)** não encosta nesta fatia. Exportar continua valendo depois
  do avanço, porque a rodada é da Fase 3 e o dado não muda de dono.
- **#73/#74 (Qualidade)** continuam donas de `quality*.ts(x)`. Aqui só se importa `qualityPair` e
  `QualityValue`.
- **#76 (orientação)**: `reading-guidance*` não muda. Num projeto na Fase 4, a rodada em foco na aba
  Rodadas continua sendo a última da Fase 3, e a orientação dela continua aparecendo, porque é
  decidida pela fase *da rodada*. Isso fica registrado no § 5, sem mudança aqui.
- **#68 (avanço da Fase 2)**: `phase2Blockers`, as mensagens e `phase3ConfirmationLines` **não
  mudam**. O que muda no entorno: `countClosedRounds` ganha a fase (D2), o resumo sai para arquivo
  próprio (D7) e os inputs do painel passam a ser recortados (D9).
- **Épico da Fase 4 (futuro)** herda três coisas: o `phase_unavailable` de `roundBlockers` (é a
  linha a apagar), a linha de disponibilidade da confirmação (D4) e a trava de edição de
  codebook/prompt na Fase 4 (D5).

---

# Parte 1 — Regras puras

**Objetivo:** tudo o que é regra e texto, sem action e sem tela. No fim da Parte, `npm test` prova em
teste unitário o que trava e o que não trava o avanço da Fase 3 e a abertura de rodada na Fase 4.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `pipeline/preconditions.ts` (bloco da Fase 2),
`pipeline/preconditions.unit.test.ts`, `(tabs)/rounds/preconditions.ts` (`roundBlockers` e as duas
funções de mensagem) e `(tabs)/rounds/rounds.ts`.

### 1.1 `pipeline/preconditions.ts`

Acrescentar, sem mudar o comportamento de nada que já existe:

```ts
export const PHASE_4 = 4

export type Phase3Inputs = Phase2Inputs
export type Phase3Blocker = Phase2Blocker

export function phase3Blockers(inputs: Phase3Inputs): Phase3Blocker[]
export function canAdvanceFromPhase3(inputs: Phase3Inputs): boolean
export function phase3BlockerMessage(blocker: Phase3Blocker): string
export function phase3BlockedMessage(blockers: readonly Phase3Blocker[]): string
export function phase4ConfirmationLines(): string[]
```

`phase2Blockers` passa a delegar ao helper privado (D1), mantendo o mesmo retorno. Textos em D3 e D10.

### 1.2 `(tabs)/rounds/preconditions.ts`

- `RoundBlocker` ganha `{ key: 'phase_unavailable'; phase: number }` (D6).
- `roundBlockers`: `if (inputs.phase >= PHASE_4)` empurra o bloqueio, logo depois da checagem de
  `< PHASE_2`.
- `roundBlockerSummary` e `roundBlockerMessage` ganham o `case`. O `switch` sem `default` faz o
  TypeScript cobrar os dois.

### 1.3 `(tabs)/rounds/rounds.ts`

- `countClosedRounds(projectId, phase, db = ownerDb)`: acrescenta `eq(rounds.phase, phase)` ao
  `where` (D2). O único chamador, `advancePhase`, é ajustado na Parte 2. **Nesta Parte, passar
  `PHASE_2` no chamador existente** para o typecheck ficar verde.
- `roundsInPhase(rounds, phase)`: função pura (D9).

### 1.4 Testes da Parte 1

`pipeline/preconditions.unit.test.ts`, com um `describe` novo e sem mexer nos existentes:

- [ ] **Sem rodada nenhuma**: `no_closed_round`, e `canAdvanceFromPhase3` falso.
- [ ] **Rodada aberta e nenhuma fechada**: dois bloqueios, na ordem `open_round`, `no_closed_round`.
- [ ] **Rodada aberta e uma fechada**: só `open_round`.
- [ ] **Uma fechada ou várias fechadas, nenhuma aberta**: liberado.
- [ ] **A mensagem nomeia a pré-condição**: a de rodada aberta cita o número; a de rodada fechada fala
      em "Fase 3" e diz que a Fase 2 não conta. As duas começam por `Não foi possível avançar para a
      Fase 4.` quando passam por `phase3BlockedMessage`.
- [ ] **Os dois bloqueios juntos oferecem o gesto único.**
- [ ] **Mesmo formato da Fase 2**: para as mesmas entradas, `phase3Blockers` e `phase2Blockers`
      devolvem as mesmas chaves (prova de D1).
- [ ] **Confirmação**: diz o que é a Fase 4 e que congela codebook e prompt; diz que a decisão é do
      Administrador e cita ICR e Qualidade; a última linha é `Cancelar não muda nada.`; **nenhuma
      linha** contém `voltar`, `volta`, `retorno` ou `retornar`.

`(tabs)/rounds/preconditions.unit.test.ts`:

- [ ] **Fase 4 bloqueia com `phase_unavailable`**, mesmo com codebook completo e prompt.
- [ ] **Fases 2 e 3 não ganham o bloqueio novo.**
- [ ] **O resumo e a mensagem dizem que a Fase 4 não está disponível**, e a mensagem não manda
      avançar.

`(tabs)/rounds/rounds.unit.test.ts` (novo; hoje nenhuma função pura de `rounds.ts` tem teste próprio):

- [ ] **`roundsInPhase`** filtra pela fase e preserva a ordem.

`countClosedRounds` não ganha teste próprio nesta Parte: quem o exercita contra o banco é a Parte 2,
como na #68.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, sem nenhum teste antigo editado.

Commit sugerido: `feat(pipeline): pré-condições do avanço da fase 3 e recusa de rodada na fase 4`.

### O que a Parte 2 herda

- **D4 decidido: a linha de disponibilidade NÃO entra.** `phase4ConfirmationLines()` tem três
  linhas: o que a Fase 4 é (com o congelamento como descrição, D5) e que a Fase 3 continua visível; a
  decisão do Administrador sem trava por ICR nem Qualidade; `Cancelar não muda nada.`. A recusa de
  rodada na Fase 4 aparece só na aba Rodadas. No § 4 e no § 5, a "linha de disponibilidade" deixa de
  existir como herança do épico da Fase 4.
- **D5 confirmado:** congelamento é só descrição; codebook e prompt seguem editáveis na Fase 4.
- **Nomes finais, como no § 1.1:** `PHASE_4`, `Phase3Inputs`/`Phase3Blocker` (aliases),
  `phase3Blockers`, `canAdvanceFromPhase3`, `phase3BlockerMessage`, `phase3BlockedMessage`,
  `phase4ConfirmationLines`. O helper privado é `roundCycleBlockers`, usado pelas duas fases.
- **Textos:** os de D3, sem mudança de conteúdo. O gesto único da Fase 3 diz "nenhuma rodada da
  Fase 3 foi fechada ainda".
- **`roundBlockers`:** `phase_unavailable` entra logo depois de `phase`, com `phase >= PHASE_4`, e
  as duas mensagens usam `blocker.phase` no texto (para `PHASE_4`, ficam iguais às de D6).
- **`countClosedRounds(projectId, phase, db)`** já existe, e o ramo da Fase 2 em `advancePhase`
  **já passa `PHASE_2`**. A Parte 2 só acrescenta o ramo da Fase 3.
- **`roundsInPhase(rounds, phase)`** em `rounds.ts`, com `rounds.unit.test.ts` novo (2 testes).
- **Testes:** 5 `describe` novos em `pipeline/preconditions.unit.test.ts` e 1 em
  `rounds/preconditions.unit.test.ts`. Nenhum teste antigo editado. Suíte: 80 arquivos, 1114
  testes verdes.

---

# Parte 2 — A action

**Objetivo:** `advancePhase` avança da Fase 3 para a 4 com as pré-condições da Parte 1, e
`createRound` recusa a Fase 4. A integração prova que nenhum número trava e que a Fase 2 não conta.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 2 herda", `pipeline/actions.ts` (bloco
`advancePhase`, no fim), `pipeline/advance-phase-2.int.test.ts` inteiro (é o molde do arquivo novo) e
`(tabs)/rounds/actions.int.test.ts` (`readyProject`, `newRoundForm`).

### 2.1 `pipeline/actions.ts`

Depois do ramo `PHASE_2` e antes do `wrong_phase`:

```ts
if (project.phase === PHASE_3) {
  const open = await loadOpenRound(projectId, tx)
  const blockers = phase3Blockers({
    openRoundNumber: open?.roundNumber ?? null,
    closedRounds: await countClosedRounds(projectId, PHASE_3, tx),
  })
  if (blockers.length > 0) {
    return { status: 'incomplete', message: phase3BlockedMessage(blockers) }
  }

  await tx.update(projects).set({ phase: PHASE_4 }).where(eq(projects.id, projectId))
  return { status: 'advanced', phase: PHASE_4 }
}
```

O ramo `PHASE_2` passa `PHASE_2` a `countClosedRounds`, se a Parte 1 ainda não o fez. Não mude a
ordem `authz → transação → FOR UPDATE`, nem `ADVANCE_DENIED`, nem a revalidação
(`/projects/${id}` e `/projects/${id}/rounds` já cobrem as duas telas afetadas).

### 2.2 Testes que mudam de sentido (esperado, citar no commit)

- `pipeline/actions.int.test.ts` → `recusa avançar um projeto que já saiu da Fase 1, e a fase não
  muda`: semeia em `PHASE_3`, e a Fase 3 passa a ser avanço legítimo. Re-semear em `PHASE_4` e afirmar
  `wrongPhaseMessage(PHASE_4)`. A intenção se mantém.
- `pipeline/advance-phase-2.int.test.ts` → `o segundo avanço seguido devolve a mensagem de fase
  errada nomeando a Fase 3`: a segunda chamada agora cai no ramo da Fase 3 e é recusada por
  `no_closed_round`, **porque a rodada fechada é da Fase 2**. Renomear para algo como `o segundo
  avanço seguido é recusado: a rodada fechada da Fase 2 não conta para a Fase 4`, e afirmar
  `phase3BlockedMessage([{ key: 'no_closed_round' }])` com fase 3 no banco. Na prática, o teste vira
  mais uma prova do AC da Fase 2 não contar.

### 2.3 Arquivo novo: `pipeline/advance-phase-3.int.test.ts`

Um `describe` (`app/projects/[id]/pipeline/actions — avanço da Fase 3 para a Fase 4`). Copie o
cabeçalho de mocks e os helpers `newUser`/`newProject`/`seedArtifacts`/`seedRound`/`rate` de
`advance-phase-2.int.test.ts`. `seedRound` passa a aceitar `phase` (repassado a `addRound`). Use
`cleanup` no `afterEach`, porque a action commita.

Fixture base: projeto na **Fase 3** com uma rodada fechada da **Fase 2** (o histórico realista) e as
rodadas da Fase 3 que cada caso pedir.

- [ ] **Avança com uma rodada fechada da Fase 3 e nenhuma aberta**: `{ ok: true, phase: 4 }` e fase 4
      no banco.
- [ ] **Recusa com rodada aberta**: a mensagem cita o número da rodada e a fase continua 3.
- [ ] **Recusa sem rodada fechada na Fase 3, mesmo havendo rodadas fechadas da Fase 2**: semear duas
      fechadas da Fase 2 e nenhuma da Fase 3; esperar exatamente
      `phase3BlockedMessage([{ key: 'no_closed_round' }])`. É o AC central.
- [ ] **Rodada aberta e nenhuma fechada da Fase 3**: a mensagem cobre as duas pendências.
- [ ] **ICR baixo não impede**: rodada da Fase 3 fechada com dois avaliadores discordando. No próprio
      teste, afirmar que `ordinalAlpha` das observações daquela rodada é calculável e **abaixo de
      `AGREEMENT_BANDS.acceptable`**, e que mesmo assim avança.
- [ ] **Qualidade concentrada em Baixo não impede**: todos notam `low`. Afirmar, com `qualityOf` sobre
      as observações reais, que a fatia de Baixo é 100% (e que o ICR não é calculável, o que cobre esse
      caso também), e que avança.
- [ ] **O Avaliador é barrado**, com `ADVANCE_DENIED` e a fase intacta; **quem não é membro** recebe a
      mesma string.
- [ ] **A segunda chamada devolve fase errada**: `wrongPhaseMessage(PHASE_4)`, fase continua 4.
- [ ] **Avançar não muda nada além da fase**: rodadas (número, status, fase, `closedAt`), contagem de
      avaliações, `usedAt` das versões e **contagem de `notifications` do projeto** iguais antes e
      depois. Esse teste cobre "não congela, não fecha, não notifica, não apaga".

`(tabs)/rounds/actions.int.test.ts`:

- [ ] **Criar rodada na Fase 4 é recusado**: `readyProject(admin, PHASE_4)` →
      `{ error: roundBlockerMessage({ key: 'phase_unavailable', phase: PHASE_4 }) }`, nenhuma linha em
      `rounds`, `usedAt` intacto.
- [ ] **De ponta a ponta**: projeto na Fase 3 → cria, fecha, avança (`phase: 4`) → `createRound`
      recusado com a mensagem acima. Prova que a regra lê a fase na transação.
- [ ] Os casos parametrizados que já rodam em Fases 2 e 3 continuam verdes sem edição.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com só os dois testes do § 2.2 editados.

Commit sugerido: `feat(pipeline): avança da fase 3 para a fase 4 e recusa rodada na fase 4`.

### O que a Parte 3 herda

- **`advancePhase` avança da Fase 3 para a 4** exatamente como no § 2.1, sem divergência. A ordem
  `authz → transação → FOR UPDATE`, `ADVANCE_DENIED` e a revalidação não mudaram. A partir da Fase 4,
  a action devolve `wrongPhaseMessage(PHASE_4)`.
- **`createRound` não mudou**: a recusa na Fase 4 vem de `roundBlockers`, e o `usedAt` das versões
  fica intacto (há teste).
- **Testes editados, só os dois do § 2.2:** em `actions.int.test.ts`, o de "já saiu da Fase 1" semeia
  em `PHASE_4` (o import de `PHASE_3` saiu, porque só ele o usava); em `advance-phase-2.int.test.ts`,
  o segundo avanço agora espera `phase3BlockedMessage([{ key: 'no_closed_round' }])` e foi renomeado.
- **Arquivo novo** `pipeline/advance-phase-3.int.test.ts`, com 9 testes. O Avaliador e quem não é
  membro ficaram num teste só. O helper `seedPhase3Project` monta a fixture base (projeto na Fase 3
  com a rodada 1 fechada da Fase 2). "Notificações do projeto" é contada pelos usuários envolvidos,
  porque `notifications` não tem `project_id`.
- **`(tabs)/rounds/actions.int.test.ts`** ganhou 2 testes (Fase 4 isolada e de ponta a ponta).
- **Suíte:** 81 arquivos, 1125 testes verdes.

---

# Parte 3 — A tela

**Objetivo:** o Administrador vê, na visão geral, o que falta para avançar para a Fase 4 e confirma
com o ICR e a Qualidade da última rodada da Fase 3 à vista. Depois do avanço, o painel mostra "Fase 3
concluída". No fim da Parte, o issue fecha.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, os dois "o que herda", `pipeline/phase-2-checklist.tsx`,
`pipeline/advance-phase.tsx`, `(tabs)/page.tsx`, `(tabs)/rounds/quality-panel.tsx` (`QualityValue`),
`(tabs)/rounds/new-round.tsx` e os testes de avanço em `(tabs)/page.int.test.ts` (a partir do
`it('o botão de avançar fase da barra…')`).

### 3.1 `pipeline/last-round-summary.tsx` (novo)

Mover `LastClosedRound` e `LastRoundSummary` de `phase-2-checklist.tsx` para cá e acrescentar
`quality?` (D7). `phase-2-checklist.tsx` passa a importar daqui, e a página também (hoje ela importa
`LastClosedRound` de `phase-2-checklist`).

### 3.2 `pipeline/phase-3-checklist.tsx` (novo)

`Phase3Checklist({ projectId, phase, inputs, lastRound, className })`, espelhando `Phase2Checklist`
(D8). Ele chama `phase3Blockers(inputs)` sozinho. Quando `phase === PHASE_3`, renderiza
`AdvancePhase` com `target={PHASE_4}`, `lines={phase4ConfirmationLines()}` e
`summary={lastRound ? <LastRoundSummary round={lastRound} /> : null}`. Quando `phase > PHASE_3`,
mostra o `Badge` "Fase 3 concluída" e o parágrafo de consulta.

**A tela não trava por métrica:** `blocked` sai de `phase3Blockers(inputs)` e de nada mais. O
coeficiente e a Qualidade entram na árvore por um caminho só, que é `lastRound`.

### 3.3 `(tabs)/page.tsx`

- Com `roundsInPhase`, montar os inputs e o `lastRound` de cada painel (D9). O `lastRound` da Fase 3
  leva `quality: qualityPair(...)` com as observações e os outliers daquela rodada.
- Renderizar `Phase3Checklist` sob `Phase2Checklist`, dentro de `#avancar`, com
  `agreement && project.phase >= PHASE_3`.
- `PhaseBar`: o link `#avancar` passa a aparecer com `project.phase < PHASE_4` (mantendo Administrador
  e projeto ativo).
- Nenhuma consulta nova. Tudo sai de `agreement.rounds`, `observations` e `outliers`, que já existem.

### 3.4 Aba Rodadas na Fase 4

Não há código novo: `rounds/page.tsx` já passa `project.phase` para `roundBlockers`, e o `NewRound`
já lista os bloqueios. Conferir que o `phase_unavailable` aparece e que o botão de nova rodada fica
desabilitado.

### 3.5 Testes da Parte 3

`(tabs)/page.int.test.ts`:

- [ ] **Fase 3 liberada**: com uma rodada fechada da Fase 3, o painel "Para avançar para a Fase 4"
      aparece, `AdvancePhase` com `target: 4` e `blocked: false`, e o `summary` traz o ICR com
      `BAND_REFERENCE` e a Qualidade (`QualityValue`) da **última rodada da Fase 3**, e não da última
      rodada da Fase 2.
- [ ] **Fase 3 bloqueada por rodada aberta**: `blocked: true`, e o texto nomeia a rodada.
- [ ] **Fase 3 bloqueada só com rodadas da Fase 2 fechadas**: `blocked: true`, com a mensagem de
      `no_closed_round`.
- [ ] **ICR baixo e Qualidade toda em Baixo continuam liberados**, que é o AC mais fácil de furar no
      front.
- [ ] **Fase 4**: o painel mostra `Fase 3 concluída`, não há `AdvancePhase` com `target: 4`, e o texto
      não contém `voltar`/`retorno`.
- [ ] **Recorte do painel da Fase 2**: num projeto na Fase 3 com rodada aberta da Fase 3, o painel da
      Fase 2 não lista "Nenhuma rodada aberta" como pendente (D9).
- [ ] **O Avaliador não vê o painel da Fase 3**, nem na Fase 3 nem na Fase 4.
- [ ] **Barra**: o teste `o botão de avançar fase da barra…` passa a esperar `#avancar` **na Fase 3**
      e a não esperá-lo **na Fase 4**. É mudança esperada, a citar no commit. O Avaliador continua sem
      o link.

`(tabs)/rounds/page.int.test.ts`:

- [ ] **Fase 4**: `NewRound` recebe o bloqueio `phase_unavailable`, e as rodadas da Fase 3 continuam
      listadas, com a Qualidade da rodada em foco (história 23).

### 3.6 Conferência no navegador

Siga as memórias: `/dev/login` para entrar, `resize_window` e `get_page_text` se o pane mostrar a
faixa preta, e **limpar a cena do banco antes de `npm test`** (`scores` vazia). Conferir: painel da
Fase 3 liberado e bloqueado, diálogo com ICR + Qualidade (sem `InfoTooltip` recortado), avanço, badge
"Fase 3 concluída", aba Rodadas com a recusa na Fase 4. Largura de 375px medida em iframe.

### 3.7 Varredura dos ACs

| AC do issue | Onde é provado |
|---|---|
| Exige nenhuma rodada aberta e ao menos uma fechada na Fase 3 | P1 (unitário) + P2 (integração) + P3 (tela) |
| Rodadas fechadas da Fase 2 não contam | P2 (duas fechadas da Fase 2 → recusa; e o teste reescrito do § 2.2) + P3 (painel bloqueado) |
| Nenhum valor de ICR ou Qualidade impede | P2 (dois testes com asserção sobre o valor) + P3 (tela liberada) + assinatura de `phase3Blockers` |
| A mensagem nomeia a pré-condição, com o número da rodada aberta | P1 + P2 |
| A confirmação mostra ICR com faixa e a distribuição da Qualidade | P3 (`summary`) |
| A confirmação diz o que é a Fase 4, que congela, e não fala em retorno | P1 (`phase4ConfirmationLines` + varredura de palavras) |
| O avanço não congela, não fecha, não notifica, não apaga | P2 ("não muda nada além da fase") |
| Depois do avanço, "Fase 3 concluída" e sem avanço | P3 |
| Abrir rodada na Fase 4 é recusado no servidor, com mensagem própria | P1 (`roundBlockers`) + P2 (`createRound`, isolado e de ponta a ponta) + P3 (aba Rodadas) |
| O Avaliador não vê o painel e é barrado na ação | P2 (action) + P3 (tela) |

Antes de fechar, marque os checkboxes do issue no GitHub e cite no comentário de fechamento o commit
de cada Parte. Confira à mão que nenhum `disabled`, `if` ou texto do painel da Fase 3 consulta ICR ou
Qualidade.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, os dez ACs conferidos um a um e a conferência
no navegador feita.

Commit sugerido: `feat(visao-geral): painel de avanço para a fase 4 com icr e qualidade`.

### O que esta Parte fechou

- **`pipeline/last-round-summary.tsx`**: `LastClosedRound` (com `quality?`) e `LastRoundSummary`
  saíram de `phase-2-checklist.tsx`. Com `quality`, o cartão ganha, abaixo do ICR e separado por
  uma borda, o `QualityValue` e a frase `QUALITY_REFERENCE` (exportada dali, e não de
  `quality-labels.ts`, que continua da #73/#74). Sem `InfoTooltip` no diálogo.
- **`pipeline/phase-3-checklist.tsx`**: `Phase3Checklist` espelha o da Fase 2, como no § 3.2.
  `blocked` sai só de `phase3Blockers(inputs)`; o componente não importa nada de ICR nem de
  Qualidade além do resumo.
- **`(tabs)/page.tsx`**: a função local `phaseChecklistData(agreement, phase)` monta, com
  `roundsInPhase`, os `inputs` e o `lastRound` de cada painel (D9). O `quality` só entra quando
  `hasQuality(phase)`. O link `#avancar` da barra vale para `phase < PHASE_4`. Nenhuma consulta
  nova.
- **Aba Rodadas:** nenhum código; a recusa `phase_unavailable` e o botão desabilitado conferidos
  em teste e no navegador.
- **Testes:** 7 novos em `(tabs)/page.int.test.ts` e 1 em `(tabs)/rounds/page.int.test.ts`.
  Editado só o esperado: `o botão de avançar fase da barra…` passa a esperar `#avancar` na Fase 3
  e não na Fase 4 (e o Avaliador na Fase 3 continua sem o link). Suíte: 81 arquivos, 1133 testes.
- **Navegador:** painel bloqueado (as duas pendências, e o painel da Fase 2 sem a rodada aberta da
  Fase 3), diálogo com ICR 0,597 "questionável" e Qualidade liberado, sem rolagem horizontal,
  avanço, "Fase 3 concluída", aba Rodadas recusando na Fase 4. A 375px, medido em iframe, nada do
  `#avancar` passa da borda.
- **Pendente, fora do código:** marcar os checkboxes da #77 e fechá-la citando os três commits.

---

## 5. Fica para depois (registrar, não construir)

- **Trava de codebook e prompt na Fase 4** (D5). Hoje os dois continuam editáveis num projeto na Fase
  4. É do épico da Fase 4.
- **Retorno da Fase 4 para a Fase 3** (ADR 0004). Quando existir, a confirmação e o painel "Fase 3
  concluída" são revisitados.
- **Apagar `phase_unavailable`** e a linha de disponibilidade (D4) quando a Fase 4 abrir rodada.
- **Orientação pelo ICR num projeto na Fase 4**: a rodada em foco da aba Rodadas continua sendo a
  última da Fase 3, e a orientação dela (que fala em refinar) continua aparecendo (§ 4, #76).
- **Tela do Avaliador na Fase 4**: `evaluate/waiting.ts` trata `phase >= PHASE_2` com codebook
  completo como "esperando rodada". Numa Fase 4 sem rodada possível, a espera é indefinida. Nada de
  errado aparece, mas o texto pode ser revisto com o épico da Fase 4.
- **Avançar não checa `project.status`** (herdado da #68, vale para as três fases).
- **Registro de quem avançou e quando** (herdado da #68).

## 6. Deploy

Sem migration e sem `db push`. **Antes do deploy, confira que prod não está atrasado em schema**
(memória: prod já atrasou duas vezes). Esta fatia depende de `rounds.phase` (#70) e lê `sent_input`
indiretamente pelas telas da #71. Se prod não tiver essas colunas, o avanço quebra por um motivo que
não é desta fatia.
