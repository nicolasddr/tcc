# Plano de implementação — Issue #68: "30 — Avançar da Fase 2 para a Fase 3"

Link: https://github.com/nicolasddr/tcc/issues/68
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 58 e 59)
Blocked by: #62 (fechada) — "Concordância: módulo de cálculo e ICR da rodada" · vizinha de #67
(aberta) — "Exportação CSV da rodada"

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60 a #66.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | As pré-condições da Fase 2, puras, e a contagem de rodadas fechadas | ☑ |
| 2 | A action: um mecanismo de avanço, pré-condição por fase, e a prova de que métrica não trava | ☑ |
| 3 | A tela: painel de avanço, confirmação com o ICR da última rodada e a varredura dos ACs | ☑ |

**Nenhuma ADR nova.** A decisão inteira já está na **ADR 0004**, inclusive a distinção que este
issue cobra: métrica não trava, pré-condição estrutural trava. O glossário (`docs/CONTEXT.md`,
verbete **Fase**) já diz que o avanço é ação consciente do Administrador e que o único retorno é da
Fase 4 para a Fase 3. Esta fatia **implementa** o que está escrito; se algo divergir, o caminho é
emendar a ADR, não improvisar no código.

**Sem migration.** Nenhuma tabela nova, nenhuma coluna nova. O deploy desta fatia **não** precisa de
`db push` — é a primeira fatia do Épico 2 em que isso é verdade, e vale conferir antes de assumir
(prod já atrasou duas vezes por schema não empurrado, mas aqui não há schema a empurrar).

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Action de avanço de fase | `pipeline/actions.ts` (`advancePhase`, `AdvanceOutcome`, `AdvancePhaseState`) | **é reaproveitada**: ganha um ramo para a Fase 2 (Parte 2) |
| Pré-condições da Fase 1 | `pipeline/preconditions.ts` (`PHASE_1`, `PHASE_2`, `pendingRequirements`, `missingInputsMessage`) | onde `PHASE_3` e as pré-condições da Fase 2 nascem (Parte 1) |
| Botão + diálogo de avanço | `pipeline/advance-phase.tsx` (`AdvancePhase`) | generalizado na Parte 3; a cópia da Fase 1 não muda de sentido |
| Checklist da Fase 1 | `pipeline/pipeline-checklist.tsx` (`PipelineChecklist`) | modelo do painel novo, e passa a decidir sozinho o estado "fase concluída" |
| Rodada aberta | `(tabs)/rounds/rounds.ts` (`loadOpenRound`, `ROUND_CLOSED`, `isOpen`) | a primeira pré-condição lê daqui; a contagem de fechadas nasce ao lado (Parte 1) |
| Lista de rodadas | `(tabs)/rounds/rounds.ts` (`listRounds`) | a visão geral já carrega — a Parte 3 não abre consulta nova |
| Módulo puro do coeficiente | `lib/agreement.ts` (`ordinalAlpha`, `Agreement`) | **não muda**; só é exibido na confirmação |
| Par com e sem outliers | `(tabs)/rounds/agreement-pair.ts` (`agreementPair`) | monta o valor que a confirmação mostra (Parte 3) |
| Rótulos e faixa de referência | `(tabs)/rounds/agreement-labels.ts` (`BAND_REFERENCE`, `formatAlpha`, `agreementBand`, `bandLabel`, `bandTone`, `notCalculableMessage`, `NOT_CALCULABLE_LABEL`, `sampleSize`) | **a faixa do AC já existe escrita**; a confirmação importa, não reescreve |
| Série por rodada | `(tabs)/rounds/agreement-series.ts` + `(tabs)/page.tsx` | já carrega observações e outliers do projeto na visão geral |
| Autorização de Administrador | `lib/authz.ts` (`isProjectAdmin`) | a trava da action, sem mudança |
| Bloqueio de abertura de rodada | `(tabs)/rounds/preconditions.ts` (`roundBlockers`) | **vizinho, não é reusado** (§ 3) |
| Helpers de integração | `test/helpers.ts` (`addRound`, `addResponse`, `addEvaluation`, `memberId`, `cleanup`) | já bastam: nenhum helper novo nesta fatia |

O que **falta** e esta fatia cria: a função pura das pré-condições da Fase 2, a contagem de rodadas
fechadas, o ramo da Fase 2 na action e o painel de avanço com a confirmação que mostra o ICR.

---

## 2. O avanço da Fase 2, por extenso

### O que trava e o que não trava

Duas pré-condições, as duas estruturais:

1. **Nenhuma rodada aberta.** Avançar com rodada aberta deixaria para trás um ciclo que nunca se
   fecha: as respostas continuariam aceitando avaliação numa fase que acabou, e o codebook seguiria
   travado pela rodada (`codebookLockedMessage`) já dentro da Fase 3.
2. **Ao menos uma rodada fechada.** Sem isso, a Fase 3 começa de um codebook que ninguém aplicou do
   começo ao fim. A Fase 2 existe para medir ambiguidade, e uma fase sem nenhuma rodada fechada não
   mediu nada.

E **uma coisa que não trava, nunca**: o valor do ICR. Nem baixo, nem não calculável, nem ausente. É
o ponto inteiro da ADR 0004 e é a razão pela qual a Parte 1 tem um teste que parece bobo — o de que
a função pura **não recebe** coeficiente nenhum.

### A impossibilidade é estrutural, não disciplinar

`phase2Blockers` recebe `{ openRoundNumber, closedRounds }`. Não recebe `Agreement`, não recebe
observação, não importa `lib/agreement`. Um ICR não tem como travar o avanço porque **não existe
caminho** por onde ele chegaria à decisão: seria preciso mudar a assinatura, e mudar assinatura é
revisão, não descuido. Escrever a trava e depois se comprometer a não usá-la seria a versão frágil
da mesma regra.

O corolário vale para a tela: o coeficiente aparece na confirmação como **informação**, num bloco
que não tem relação de causa com o botão. O botão olha só para as duas pré-condições.

### "Rodada fechada na Fase 2" é, hoje, "rodada fechada"

O AC diz "ao menos uma rodada fechada **na Fase 2**", e a contagem que a Parte 1 escreve é de
rodadas fechadas do projeto, sem recorte de fase. Isso é correto **por construção, hoje**: rodada só
existe da Fase 2 em diante (`roundBlockers` recusa `phase < PHASE_2`, e o glossário registra o
mesmo), e este avanço só roda com o projeto **na** Fase 2. Logo, toda rodada fechada que existe no
momento da checagem é da Fase 2.

Isso deixa de ser verdade no Épico 3, quando o avanço da Fase 3 para a Fase 4 fizer a mesma
pergunta sobre rodadas que convivem com as da Fase 2. `rounds` não grava a fase em que nasceu, e vai
precisar gravar. Fica registrado no § 5 — **não** se constrói coluna agora, por dois motivos: é
migration fora do escopo do issue, e a forma certa dela depende do desenho da Fase 3, que ainda não
existe. O que a Parte 1 garante é que o custo dessa mudança seja uma consulta: a função pura recebe
`closedRounds: number` e não sabe de onde o número veio.

### A corrida já está fechada, e de graça

`createRound` trava a linha do projeto com `FOR UPDATE` antes de checar `roundBlockers`, e
`advancePhase` trava a mesma linha antes de checar as pré-condições. As duas transações serializam
sozinhas: não existe "abrir rodada no meio do avanço". E como `createRound` relê `project.phase`
dentro da própria transação, uma rodada criada logo depois do avanço obedece à fase nova. Nada a
acrescentar — só a não estragar.

### O que o avanço não faz

- **Não congela nada.** Quem congela codebook e prompt é a criação da rodada, desde a #57. Avançar
  não toca em `used_at`, exatamente como o avanço da Fase 1 (que já tem teste provando isso).
- **Não fecha rodada por você.** Se há rodada aberta, a action recusa e diz para fechar. Fechar é
  irreversível e é decisão explícita (#57): embutir um fechamento dentro de um avanço seria fazer o
  Administrador assinar duas decisões com um clique.
- **Não apaga, não arquiva e não esconde a Fase 2.** Rodadas, notas, ICR, marcas de outlier e
  anotações continuam onde estão, visíveis e imutáveis.
- **Não notifica ninguém.** Nenhuma linha em `notifications`, coerente com o avanço da Fase 1.
- **Não constrói nada da Fase 3.** O codebook completo indo à LLM é Épico 3. Esta fatia move um
  número de fase e registra a decisão.

---

## 3. Decisões desta fatia

**Um mecanismo de avanço, com pré-condição por fase.** `advancePhase` continua sendo a única action
de avanço, e ganha um ramo por fase de origem dentro da transação que já existe. É literalmente o
que o issue pede ("reaproveita o mecanismo de avanço que o Épico 1 já construiu"). A alternativa —
`advanceToPhase3` ao lado — duplicaria autorização, trava de fase, `revalidatePath`, formato de
estado e diálogo de confirmação, e as duas iam divergir na primeira correção feita só de um lado.
Bônus barato: o teste que lista os exports de `pipeline/actions.ts` continua passando sem edição, o
que é um sinal de que a superfície não cresceu.

**As pré-condições moram em `pipeline/preconditions.ts`, não em `rounds/preconditions.ts`.** A
pergunta aqui é "o que trava o avanço de fase", e não "o que trava abrir rodada". Quem procurar a
regra vai procurar junto de `PHASE_1`, `PHASE_2` e `missingInputsMessage`, que é onde a regra irmã
já está. O arquivo de rodadas continua dono de `roundBlockers`, e a única coisa que os dois trocam é
`loadOpenRound` — que `pipeline/actions.ts` já importa desde a #57.

**`phase2Blockers` devolve união discriminada, e não lista de pendências com texto pronto.** Mesma
forma de `roundBlockers`, pelo mesmo motivo: o bloqueio de rodada aberta carrega o **número** da
rodada, e mensagem com dado dentro não cabe em constante. A Fase 1 usa `PipelineRequirement` porque
as três pendências dela são estáticas; forçar as duas formas a serem uma só faria mal às duas.

**Fechar a rodada aberta resolve as duas pendências de uma vez, e a mensagem diz isso.** Quando o
projeto tem uma rodada aberta e nenhuma fechada — que é o caso comum na primeira rodada —, a
mensagem única evita mandar o Administrador procurar duas coisas quando existe um gesto só.

**A confirmação mostra o ICR da última rodada, e mostra o par quando ele existe.** O valor "com
todos" é o resultado da rodada (#65) e aparece sempre; quando há alguém marcado como outlier, o
segundo valor aparece ao lado, com os mesmos rótulos da tela de rodadas. Esconder o par justamente na
tela onde a decisão é tomada seria a pior hora para esconder. Nada disso é recalculado no cliente: a
página monta com `agreementPair` e passa pronto.

**O coeficiente exibido vem da mesma função da tela de rodadas — não existe segundo cálculo.** Se
o número da confirmação puder divergir do número do painel, a ferramenta perde a credibilidade que
o Épico 2 inteiro está construindo. `ordinalAlpha` continua sendo chamado por `agreementPair`, e só.

**O avanço da Fase 2 aparece na visão geral, junto do da Fase 1.** Mesma tela, mesma âncora
`#avancar`, painel irmão do checklist. O avanço é do **projeto**, não da rodada: colocá-lo na aba
Rodadas diria que ele pertence a um ciclo, e a #39 já moveu esse componente uma vez para justamente
deixar de espalhar a decisão de fase pela ferramenta.

**`AdvancePhase` fica genérico e burro; quem sabe da fase é o painel.** O componente vira "botão,
diálogo, estado da action, alerta de erro", recebendo `target`, as linhas da confirmação e um bloco
opcional de resumo. O ramo "a fase já passou" sai de dentro dele e vira responsabilidade de cada
painel, que é quem sabe dizer "Fase 1 concluída" ou "Fase 2 concluída". Isso muda props que dois
testes de página leem hoje — está anotado como gotcha na Parte 3.

**A confirmação não promete tela que ainda não existe.** A cópia descreve o que a Fase 3 é no
processo (o codebook completo passa a ir à LLM junto com o prompt) e o que o avanço faz no projeto.
Não afirma que há telas novas esperando do outro lado, porque não há: o Épico 3 ainda não foi
escrito. Quando ele existir, esta cópia é revisitada (§ 5).

**A confirmação diz, em texto, que a decisão é do Administrador** — é AC, e é a frase que separa
informar de obedecer. Ela mora numa função pura (`phase3ConfirmationLines`), para que o teste possa
afirmar sobre ela sem varrer JSX.

---

## 4. Fronteira com as fatias vizinhas

**#67 (exportação CSV)** é a outra fatia aberta do Épico 2 e não encosta nesta: nenhuma das duas lê
ou escreve o que a outra toca. Podem ser feitas em qualquer ordem. Se a #67 vier depois do avanço
ter sido usado num projeto real, lembrar que exportar continua valendo na Fase 3 — a rodada é da
Fase 2 e o dado não muda de dono.

**#62 (módulo de cálculo)** continua dona de `lib/agreement.ts`. O módulo **não muda** aqui, e a
regra do § 2 é a garantia disso: quem avança não pergunta o coeficiente.

**#65 (outliers)** continua dona do par de valores. Esta fatia **usa** `agreementPair` e não
acrescenta nenhuma regra de exclusão. Em particular: não existe "avançar considerando o ICR sem os
outliers" — não há decisão nenhuma pendurada em nenhum dos dois números.

**Épico 3 (Fase 3)** herda três coisas escritas aqui: o ramo por fase em `advancePhase` (é onde a
Fase 3 → 4 vai entrar), a necessidade de recortar rodadas por fase, e a cópia da confirmação. Nada
disso é construído nesta fatia.

---

# Parte 1 — As pré-condições da Fase 2, puras

**Objetivo:** a função pura, as mensagens e a contagem de rodadas fechadas. Nenhuma action, nenhuma
tela. No fim da Parte, `npm test` prova em teste unitário o que trava e o que não trava o avanço.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `pipeline/preconditions.ts`,
`(tabs)/rounds/preconditions.ts` (a forma de `roundBlockers` e de `roundBlockerMessage`) e
`(tabs)/rounds/rounds.ts`.

### 1.1 `pipeline/preconditions.ts`

Acrescentar, sem mexer no que já existe:

```ts
export const PHASE_3 = 3

export type Phase2Inputs = {
  openRoundNumber: number | null
  closedRounds: number
}

export type Phase2Blocker =
  | { key: 'open_round'; roundNumber: number }
  | { key: 'no_closed_round' }

export function phase2Blockers(inputs: Phase2Inputs): Phase2Blocker[]
export function canAdvanceFromPhase2(inputs: Phase2Inputs): boolean
export function phase2BlockerMessage(blocker: Phase2Blocker): string
export function phase2BlockedMessage(blockers: readonly Phase2Blocker[]): string
export function wrongPhaseMessage(phase: number): string
export function phase3ConfirmationLines(): string[]
```

Ordem dos bloqueios: `open_round` primeiro, `no_closed_round` depois. É a ordem do gesto — fechar a
rodada aberta costuma resolver as duas.

`phase2BlockedMessage` é quem monta o texto que a action devolve: prefixo "Não foi possível avançar
para a Fase 3." mais a mensagem do primeiro bloqueio, e, quando os dois estão presentes, a frase que
diz que fechar a rodada aberta resolve os dois. Espelhar o tom de `missingInputsMessage`.

Conteúdo mínimo das mensagens (ajustar a redação, preservar o que cada uma **precisa** dizer):

- `open_round`: nomeia o número da rodada, diz que ela ainda está aberta e que avançar deixaria para
  trás uma rodada que nunca se fecha, e manda fechá-la e avançar de novo.
- `no_closed_round`: diz que nenhuma rodada foi fechada nesta fase e que, sem isso, a Fase 3
  começaria de um codebook que ninguém aplicou do começo ao fim.
- `wrongPhaseMessage(phase)`: substitui o `ADVANCE_WRONG_PHASE` de hoje, que crava "não está mais na
  Fase 1". Passa a nomear a fase atual e a mandar recarregar a página.

`phase3ConfirmationLines()` devolve as linhas do diálogo (§ 3), entre elas, obrigatoriamente:

- o que a Fase 3 é no processo, e que a Fase 2 continua visível como está;
- **que a decisão é do Administrador**, e que nenhum valor de concordância libera nem impede o
  avanço — a faixa ao lado é referência de leitura (AC);
- que não existe voltar da Fase 3 para a Fase 2 (ADR 0004);
- "Cancelar não muda nada.", como em `closeConfirmationLines`.

### 1.2 `(tabs)/rounds/rounds.ts`

```ts
export async function countClosedRounds(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<number>
```

`count()` sobre `rounds` com `projectId` e `status = ROUND_CLOSED`. Uma consulta, sem join. Mora
aqui, e não em `pipeline/`, porque quem conta rodada é o módulo de rodadas.

### 1.3 Testes da Parte 1

`pipeline/preconditions.unit.test.ts` (acrescentar um `describe` novo; não mexer nos que existem):

- [ ] **Sem rodada nenhuma**: bloqueia com `no_closed_round`, e `canAdvanceFromPhase2` é falso.
- [ ] **Rodada aberta e nenhuma fechada**: dois bloqueios, nesta ordem.
- [ ] **Rodada aberta e uma fechada**: só `open_round`.
- [ ] **Uma fechada e nenhuma aberta**: nenhum bloqueio.
- [ ] **Várias fechadas e nenhuma aberta**: nenhum bloqueio (o AC é "ao menos uma").
- [ ] **A mensagem nomeia a pré-condição**: a de rodada aberta cita o número da rodada; a de rodada
      fechada fala em fechar rodada. As duas mencionam a Fase 3.
- [ ] **A mensagem dos dois bloqueios junta oferece o gesto único** (fechar a rodada aberta).
- [ ] **`wrongPhaseMessage` nomeia a fase recebida**.
- [ ] **A confirmação diz que a decisão é do Administrador e que a métrica não trava** — asserção
      sobre `phase3ConfirmationLines()`, que é o AC virado teste.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com os testes novos acima passando e nenhum
teste antigo alterado.

### O que a Parte 2 herda

**Nada divergiu do plano.** Assinaturas, nomes e ordem dos bloqueios saíram exatamente como o § 1.1
previa. `npm run lint`, `npm run typecheck` e `npm test` verdes (69 arquivos, 863 testes); nenhum
teste antigo foi alterado, e os 17 testes novos moram todos em
`pipeline/preconditions.unit.test.ts`.

**O que existe agora, em `pipeline/preconditions.ts`** (nada mais do arquivo foi tocado):

```ts
export const PHASE_3 = 3
export type Phase2Inputs = { openRoundNumber: number | null; closedRounds: number }
export type Phase2Blocker = { key: 'open_round'; roundNumber: number } | { key: 'no_closed_round' }
export function phase2Blockers(inputs: Phase2Inputs): Phase2Blocker[]
export function canAdvanceFromPhase2(inputs: Phase2Inputs): boolean
export function phase2BlockerMessage(blocker: Phase2Blocker): string
export function phase2BlockedMessage(blockers: readonly Phase2Blocker[]): string
export function wrongPhaseMessage(phase: number): string
export function phase3ConfirmationLines(): string[]
```

`phase2Blockers` não importa `lib/agreement` e não recebe `Agreement` — é a garantia estrutural do
§ 2, e o teste de `phase3ConfirmationLines` é a versão em texto dela.

**Redação exata das mensagens** (a Parte 2 devolve estas, não as reescreve):

- `open_round`: `A rodada {n} ainda está aberta, e avançar para a Fase 3 deixaria para trás um ciclo
  que nunca se fecha. Feche a rodada {n} e avance de novo.`
- `no_closed_round`: `Nenhuma rodada foi fechada nesta fase, e sem isso a Fase 3 começaria de um
  codebook que ninguém aplicou do começo ao fim. Feche ao menos uma rodada antes de avançar.`
- `phase2BlockedMessage`: `Não foi possível avançar para a Fase 3. ` + a mensagem do **primeiro**
  bloqueio; com os dois presentes, acrescenta ` Como nenhuma rodada foi fechada ainda, fechar a
  rodada aberta resolve as duas pendências de uma vez.` Sem bloqueio nenhum, devolve `''` (mesma
  convenção de `missingInputsMessage`).
- `wrongPhaseMessage(phase)`: `Este projeto está na Fase {phase}, então não há o que avançar aqui.
  Recarregue a página para ver a fase atual.`

**`phase3ConfirmationLines()` devolve 4 linhas**, nesta ordem: (1) o que a Fase 3 é no processo e
que a Fase 2 continua visível; (2) `A decisão de avançar é do Administrador.` + `Nenhum valor de
concordância libera nem impede o avanço: a faixa de referência ao lado é leitura, não regra.`; (3)
que não existe voltar da Fase 3 para a Fase 2; (4) `Cancelar não muda nada.` A Parte 3 pode contar
com a linha 4 ser a última — há teste sobre isso.

**`countClosedRounds(projectId, db = ownerDb)`** está em `(tabs)/rounds/rounds.ts`, logo depois de
`loadOpenRound`. Um `count()` sobre `rounds` filtrando `projectId` e `ROUND_CLOSED`, sem join,
devolvendo `0` quando não há linha. Sem teste de integração nesta Parte, de propósito: quem a
exercita contra o banco são os testes da Parte 2 — se a contagem estiver errada, eles ficam
vermelhos.

**O que a Parte 1 deliberadamente NÃO fez:** `actions.ts` não foi tocado. `ADVANCE_WRONG_PHASE`
continua lá, crava "não está mais na Fase 1" e ainda é o que a action devolve; trocá-lo por
`wrongPhaseMessage` é § 2.1. Até lá, `wrongPhaseMessage` e as outras funções novas existem sem
nenhum chamador — o lint não reclama.

---

# Parte 2 — A action: pré-condição por fase

**Objetivo:** `advancePhase` passa a saber avançar da Fase 2 para a Fase 3, com as pré-condições da
Parte 1, e o teste de integração prova que nenhum valor de ICR interfere.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, o "o que a Parte 2 herda" da Parte 1,
`pipeline/actions.ts` (o bloco `advancePhase`, no fim do arquivo), `(tabs)/rounds/actions.ts`
(`createRound`, pelo lock) e o `describe` de avanço em `pipeline/actions.int.test.ts`.

### 2.1 `pipeline/actions.ts`

O ramo por fase, dentro da transação que já existe e já trava a linha do projeto:

```ts
if (!project) return { status: 'denied' }

if (project.phase === PHASE_1) {
  const pending = pendingRequirements(await loadPipelineInputs(projectId, tx))
  if (pending.length > 0) {
    return { status: 'incomplete', message: missingInputsMessage(pending) }
  }
  await tx.update(projects).set({ phase: PHASE_2 }).where(eq(projects.id, projectId))
  return { status: 'advanced', phase: PHASE_2 }
}

if (project.phase === PHASE_2) {
  const open = await loadOpenRound(projectId, tx)
  const blockers = phase2Blockers({
    openRoundNumber: open?.roundNumber ?? null,
    closedRounds: await countClosedRounds(projectId, tx),
  })
  if (blockers.length > 0) {
    return { status: 'incomplete', message: phase2BlockedMessage(blockers) }
  }
  await tx.update(projects).set({ phase: PHASE_3 }).where(eq(projects.id, projectId))
  return { status: 'advanced', phase: PHASE_3 }
}

return { status: 'wrong_phase', phase: project.phase }
```

`AdvanceOutcome` ganha `phase` em `advanced` e em `wrong_phase`; `AdvancePhaseState` já devolve
`phase` e não muda de forma. A mensagem de fase errada passa a sair de `wrongPhaseMessage`.

Revalidação: além de `/projects/${projectId}`, revalidar `/projects/${projectId}/rounds` — a aba de
rodadas mostra estado que depende da fase. Não inventar mais nada: as telas de codebook e prompt já
são revalidadas por quem as edita.

**Não** mexer em `isProjectAdmin`, nem na leitura de `project_id`, nem na ordem `authz` antes de
transação. O Avaliador é barrado pelo mesmo `if` de hoje.

### 2.2 Testes da Parte 2

Arquivo novo: `pipeline/advance-phase-2.int.test.ts` — `actions.int.test.ts` já passa de 1900 linhas,
e o assunto é autocontido. Copiar o cabeçalho de mocks e os helpers `newUser`/`newProject`/`cleanup`
do arquivo vizinho.

Fixture base: projeto na Fase 2, com versão de codebook e de prompt, e as rodadas semeadas por
`addRound` com `status`.

- [ ] **Com uma rodada fechada e nenhuma aberta, o Administrador avança**: resultado `ok` com
      `phase: 3`, e a fase no banco é 3.
- [ ] **Rodada aberta é recusada, e a mensagem diz isso**: erro citando o número da rodada, e a fase
      continua 2.
- [ ] **Sem nenhuma rodada, é recusado**, com mensagem de rodada fechada, e a fase continua 2.
- [ ] **Só com rodada aberta** (nenhuma fechada): recusado, e a mensagem cobre os dois pontos.
- [ ] **ICR baixo não impede**: rodada fechada com dois avaliadores discordando célula a célula;
      afirmar, no próprio teste, que `ordinalAlpha` sobre as observações daquela rodada é calculável
      e **abaixo de `AGREEMENT_BANDS.acceptable`**, e que mesmo assim o avanço aconteceu. Sem essa
      asserção sobre o valor, o teste não prova o AC — prova só que a action não quebrou.
- [ ] **ICR não calculável não impede**: rodada fechada com um avaliador só (ou nenhuma avaliação);
      afirmar `calculable: false` e que o avanço aconteceu.
- [ ] **O Avaliador é barrado**: erro de autorização e fase intacta, com um avaliador ativo do
      próprio projeto.
- [ ] **Quem não é membro é barrado**, com a mesma mensagem.
- [ ] **Avançar duas vezes**: a segunda chamada devolve a mensagem de fase errada nomeando a Fase 3,
      e a fase continua 3.
- [ ] **Avançar não muda nada além da fase**: contagem e status das rodadas iguais antes e depois;
      nenhuma avaliação nova; nenhuma versão congelada a mais (`usedAt` das versões não muda).
- [ ] **A Fase 1 continua funcionando** — um teste de fumaça chamando `advancePhase` num projeto de
      Fase 1 completo, para garantir que o ramo novo não mudou o antigo (os testes de
      `actions.int.test.ts` continuam sendo a prova principal e **não** devem precisar de edição).

Gotcha: a action commita, então usar `cleanup` no `afterEach` como os testes de `rounds`, e não
`inRollbackTx`.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, sem edição nos testes de avanço da Fase 1.

### O que a Parte 3 herda

**Divergiu em um ponto, e era inevitável.** O "Pronto quando" prometia `npm test` verde **sem edição
nos testes de avanço da Fase 1**, e um teste de `actions.int.test.ts` teve de mudar:
`recusa avançar um projeto que já saiu da Fase 1, e a fase não muda` semeava o projeto em
`PHASE_2` e afirmava `stringContaining('Fase 1')`. Com o ramo novo, um projeto na Fase 2 deixa de
ser "fase errada" — passa a ser um avanço legítimo, recusado por rodada. O teste foi semeado em
`PHASE_3` e afirma `wrongPhaseMessage(PHASE_3)`, o que preserva a intenção ("já saiu da Fase 1, não
há o que avançar aqui") e cobre a troca de `ADVANCE_WRONG_PHASE` por `wrongPhaseMessage`. Nenhum
outro teste de Fase 1 foi tocado. Os demais 13 testes daquele `describe` passaram sem edição,
inclusive o do segundo avanço seguido.

**`npm run lint`, `npm run typecheck` e `npm test` verdes** — 70 arquivos, 874 testes (eram 69 e 863
no fim da Parte 1): +1 arquivo, +11 testes, todos em `pipeline/advance-phase-2.int.test.ts`.

**Forma final de `AdvanceOutcome`** (interna a `pipeline/actions.ts`, não exportada):

```ts
type AdvanceOutcome =
  | { status: 'advanced'; phase: number }
  | { status: 'denied' }
  | { status: 'wrong_phase'; phase: number }
  | { status: 'incomplete'; message: string }
```

`AdvancePhaseState` **não mudou de forma** — continua `{ error } | { ok: true; nonce; phase } | null`
—, mas `phase` agora é `outcome.phase` e não a constante `PHASE_2`: numa confirmação vinda da Fase 2
ele vale `3`. É o que a Parte 3 usa para escrever o alerta de sucesso a partir de `target`.

**Mensagens que a action devolve** (a tela não reescreve nenhuma):

- autorização: `ADVANCE_DENIED`, constante local, sem mudança. Avaliador e não-membro recebem a
  mesma string, e há teste afirmando que as duas recusas são iguais.
- fase sem ramo de avanço (Fase 3 em diante): `wrongPhaseMessage(project.phase)`.
  `ADVANCE_WRONG_PHASE` **foi apagado** — não havia outro chamador.
- Fase 1 incompleta: `missingInputsMessage(pending)`, sem mudança.
- Fase 2 bloqueada: `phase2BlockedMessage(blockers)`, exatamente como a Parte 1 a escreveu.

**Revalidação**: `/projects/${projectId}` e, novo, `/projects/${projectId}/rounds`. Nada mais.

**A ordem do corpo ficou como o § 2.1 previa**: `authz` fora da transação, `select ... for update`,
`if (!project) → denied`, ramo `PHASE_1`, ramo `PHASE_2`, e `wrong_phase` como saída final. O ramo da
Fase 2 lê `loadOpenRound(projectId, tx)` e `countClosedRounds(projectId, tx)` **dentro** da
transação que já trava a linha do projeto — é o que fecha a corrida com `createRound` de graça.

**O arquivo de teste novo é `pipeline/advance-phase-2.int.test.ts`**, com um `describe` só
(`app/projects/[id]/pipeline/actions — avanço da Fase 2 para a Fase 3`) e os 11 casos do § 2.2, na
ordem em que o plano os lista. Helpers locais que a Parte 3 pode copiar se precisar:
`seedArtifacts` (versão de codebook com uma célula + versão de prompt, as duas já com `usedAt`,
como ficam depois de uma rodada), `seedRound` (rodada por número/status, com N respostas) e `rate`
(um avaliador notando N respostas). O teste de concordância baixa afirma sobre `ordinalAlpha` das
observações reais da rodada, e não sobre um valor cravado.

**O que a Parte 2 deliberadamente NÃO fez:** nenhum arquivo `.tsx` foi tocado. `AdvancePhase`
continua com as props antigas (`{ projectId, phase, pending }`) e continua sem saber avançar da Fase
2 — hoje a Fase 2 cai no ramo `phase !== PHASE_1`, que mostra "A Fase 1 já foi concluída". A action
já aceita o avanço, mas **não há tela que o dispare**; é a Parte 3 que fecha isso, junto do gotcha
de `(tabs)/page.int.test.ts` anotado no § 3.3.

---

# Parte 3 — A tela: painel, confirmação com ICR e varredura

**Objetivo:** o Administrador vê, na visão geral, o que falta para avançar, e confirma com o ICR da
última rodada e a faixa de referência à vista. No fim da Parte, o issue fecha.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, os dois "o que herda" anteriores,
`pipeline/advance-phase.tsx`, `pipeline/pipeline-checklist.tsx`, `(tabs)/page.tsx`,
`(tabs)/rounds/agreement-panel.tsx` (como o valor e a faixa já são exibidos) e
`(tabs)/rounds/agreement-labels.ts`.

### 3.1 `AdvancePhase` fica genérico

Props novas: `{ projectId, target, blocked, hint, lines, summary }`, onde `target` é a fase de
destino, `hint` é a frase ao lado do botão, `lines` são as linhas da confirmação e `summary` é um
bloco opcional acima delas (é onde o ICR entra). Sai de dentro do componente o ramo
`phase !== PHASE_1`; o alerta de sucesso passa a ser escrito a partir de `target`.

O diálogo, o `useActionState`, o fechamento no retorno da action e o `Alert` de erro continuam
exatamente como estão. Nenhuma regra nova de cliente: o botão desabilita por `blocked`, que vem
pronto do servidor, e a action recusa de novo do lado de lá.

### 3.2 O painel da Fase 2

Arquivo novo ao lado do checklist da Fase 1, com o mesmo `Panel`, título "Para avançar para a Fase
3", e dois itens — "Nenhuma rodada aberta" e "Ao menos uma rodada fechada" — cada um com estado
pronto/pendente, a mensagem da Parte 1 quando pendente e o link "Resolver" para
`/projects/<id>/rounds`.

Acima do botão, o resumo da última rodada, montado pela página e passado como `summary`:

- o número da rodada e a data de fechamento (`formatDate`, como na aba de rodadas);
- o valor com todos, com o `Badge` da faixa (`agreementBand` + `bandLabel` + `bandTone`) ou
  `NOT_CALCULABLE_LABEL` com o motivo (`notCalculableMessage`);
- o segundo valor, **só** quando há marcados como outlier, com os rótulos de `agreement-labels`;
- `BAND_REFERENCE` por extenso — é o texto da faixa que o AC pede, e ele já existe.

Quando a fase já passou (projeto na Fase 3 ou adiante), o painel mostra `Badge` "Fase 2 concluída" e
não oferece avanço, espelhando o que o checklist da Fase 1 faz.

### 3.3 `(tabs)/page.tsx`

A página já carrega `listRounds`, `loadProjectObservations` e `loadProjectOutliers` para o
Administrador (é o que alimenta a série). O painel novo se serve do que já está lá:

- `openRoundNumber` de `rounds.find(isOpen)`;
- `closedRounds` contando `rounds` fechadas — **sem** consulta nova nesta tela (a action é que
  precisa de `countClosedRounds`, porque lá não há lista carregada);
- última rodada = a de maior número entre as fechadas; o par vem de `agreementPair` com as
  observações e os outliers daquela rodada.

O link "Avançar fase" da `PhaseBar` passa a aparecer também na Fase 2 (mesma âncora `#avancar`,
mesma condição de Administrador e projeto ativo).

**Gotcha herdado:** dois testes de `(tabs)/page.int.test.ts` afirmam hoje sobre as props antigas de
`AdvancePhase` (`{ phase, pending }`) e um deles afirma que o link `#avancar` **não** aparece na Fase
2. Os dois passam a valer sobre a forma nova — é mudança esperada, e a Parte 3 atualiza os dois
citando este parágrafo na mensagem de commit.

### 3.4 Testes da Parte 3

`(tabs)/page.int.test.ts`:

- [ ] **Fase 2 com rodada fechada**: o painel de avanço para a Fase 3 aparece liberado, com o ICR da
      última rodada e a faixa de referência no texto.
- [ ] **Fase 2 com rodada aberta**: o painel aparece travado e nomeia a rodada aberta.
- [ ] **Fase 2 sem rodada nenhuma**: o painel aparece travado e nomeia a pendência de rodada fechada.
- [ ] **ICR não calculável na última rodada**: o painel mostra "não calculável" **e continua
      liberado** — a métrica não trava nem na tela, que é o AC mais fácil de furar no front.
- [ ] **ICR baixo**: o painel mostra o valor com a faixa "questionável" e continua liberado.
- [ ] **Fase 3**: o painel mostra "Fase 2 concluída" e não oferece avanço.
- [ ] **O Avaliador não vê o painel**, nem em Fase 2 nem em Fase 3, e a visão geral dele continua sem
      falar de concordância.
- [ ] **A barra leva ao painel na Fase 2** (`#avancar`), e não leva para o Avaliador.

### 3.5 Varredura dos ACs

| AC do issue | Onde é provado |
|---|---|
| Avançar com rodada aberta é recusado, e a mensagem diz isso | Parte 1 (unitário) + Parte 2 (integração) + Parte 3 (tela) |
| Avançar sem rodada fechada é recusado, e a mensagem diz isso | Parte 1 + Parte 2 + Parte 3 |
| Nenhum valor de ICR impede o avanço, inclusive baixo ou não calculável | Parte 2 (dois testes com asserção sobre o valor) + Parte 3 (dois testes de tela) + assinatura de `phase2Blockers` |
| A confirmação mostra o ICR da última rodada com a faixa ao lado | Parte 3 (§ 3.2 e testes) |
| A confirmação diz em texto que a decisão é do Administrador | Parte 1 (`phase3ConfirmationLines`) + Parte 3 (diálogo) |
| A checagem acontece no servidor | Parte 2 (a action recusa mesmo com o botão liberado) |
| O Avaliador é barrado | Parte 2 (action) + Parte 3 (tela) |

Antes de fechar, passar a lista do issue item a item e anotar no comentário de fechamento o commit de
cada Parte. O que costuma passar despercebido aqui: **a tela também não pode travar por métrica** —
conferir que nenhum `disabled`, nenhum `if` e nenhum texto do painel olha para o coeficiente.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, os sete ACs conferidos um a um, e o Épico 2
com uma fatia só em aberto (#67).

### O que esta Parte fechou

**`npm run lint`, `npm run typecheck` e `npm test` verdes** — 70 arquivos, 881 testes (eram 70 e 874
no fim da Parte 2): +7 testes, nenhum arquivo novo de teste. Os sete ACs do issue estão cobertos
pela varredura do § 3.5, e o Épico 2 fica com a #67 como única fatia em aberto.

**Arquivos e componentes finais:**

- `pipeline/advance-phase.tsx` — `AdvancePhase({ projectId, target, blocked, hint, lines, summary })`,
  exatamente as props do § 3.1. `lines` é `readonly string[]`; `summary` é `React.ReactNode`
  opcional. O `id` do diálogo passou a ser `avancar-fase-${target}-titulo`, para os dois painéis
  poderem conviver na mesma tela.
- `pipeline/phase-2-checklist.tsx` — novo, `Phase2Checklist({ projectId, phase, inputs, lastRound,
  className })` e o tipo exportado `LastClosedRound = { roundNumber, closedAt, pair }`. Recebe o
  `Phase2Inputs` da Parte 1 e chama `phase2Blockers` sozinho, espelhando `PipelineChecklist`, que
  também chama `pendingRequirements` a partir de `inputs`. O resumo da última rodada é o
  `LastRoundSummary` local, que reusa `AgreementValue` de `rounds/agreement-panel.tsx` — o par com e
  sem outliers, os rótulos e os `Badge` de faixa saem todos de lá, sem segundo cálculo.
- `pipeline/pipeline-checklist.tsx` — só se adaptou às props novas: monta `hint` a partir de
  `missingInputsList` e passa `lines={phase2ConfirmationLines()}`.
- `(tabs)/page.tsx` — calcula `closed`, `latest` e `lastRound` da lista que já carregava, sem
  consulta nova, e renderiza `Phase2Checklist` abaixo do checklist da Fase 1, dentro da mesma âncora
  `#avancar`.

**Divergiu em três pontos:**

1. **O `summary` vai dentro do diálogo, acima das linhas** (§ 3.1), e não no corpo do painel acima do
   botão (§ 3.2). Os dois parágrafos do plano diziam coisas diferentes; o AC é *"a **confirmação**
   mostra o ICR da última rodada com a faixa ao lado"*, então o diálogo ganhou. Quem quiser o número
   sem abrir o diálogo já o tem na série de concordância, logo acima na mesma tela.
2. **Nasceu `phase2ConfirmationLines()`** em `pipeline/preconditions.ts`, ao lado de
   `phase3ConfirmationLines()`. `AdvancePhase` genérico recebe as linhas prontas, e as três frases
   que estavam em JSX dentro do componente precisavam de um lugar; o texto foi preservado palavra
   por palavra.
3. **O painel da Fase 2 só aparece a partir da Fase 2** (`phase >= PHASE_2`), empilhado sob o
   checklist da Fase 1. Na Fase 1 ele não teria o que dizer — rodada só existe da Fase 2 em diante.

**Os dois gotchas herdados vieram como previsto**, em `(tabs)/page.int.test.ts`: o teste das props de
`AdvancePhase` passou a afirmar `target`/`blocked` (e que a Fase 2 não oferece mais avanço *pelo
checklist da Fase 1*), e o teste da âncora `#avancar` passou a esperar `true` na Fase 2. Foi
acrescentada ali uma terceira asserção — Fase 3 não mostra a âncora — e um segundo Avaliador, na
Fase 2, para provar que a barra continua sendo só do Administrador.

**Consequência do § 3.1 que vale registrar:** com o ramo "a fase já passou" fora de `AdvancePhase`,
cada painel deixa de renderizar o componente assim que a fase avança, e o `Alert` de sucesso dele só
aparece enquanto o painel ainda o renderiza. O retorno visível do avanço passa a ser a `PhaseBar`
mudando de fase e o `Badge` "Fase N concluída" no painel — que é o mesmo par de sinais que o
Administrador já lia.

**A tela não trava por métrica**, conferido item a item como o § 3.5 pede: `blocked` sai de
`phase2Blockers(inputs)` e de mais nada; `inputs` é só `{ openRoundNumber, closedRounds }`; o
coeficiente entra na árvore por um caminho só, o `lastRound.pair` que o `LastRoundSummary` exibe, e
nenhum `if`, `disabled` ou texto do painel o consulta para decidir. O único `if` sobre o valor é
`all.calculable ? BAND_REFERENCE : notCalculableMessage(...)`, que escolhe qual frase mostrar.

---

## 5. Fica para depois (registrar, não construir)

- **Recorte de rodada por fase.** `rounds` não grava a fase em que nasceu, e o avanço da Fase 3 para
  a Fase 4 vai precisar disso (§ 2). É coluna nova, migration e decisão de desenho do Épico 3.
- **Cópia da confirmação quando a Fase 3 existir.** Hoje ela descreve o processo; quando houver tela
  do outro lado, ela pode dizer para onde ir.
- **Avançar não checa `project.status`.** O avanço da Fase 1 também não checa, e a tela esconde o
  botão em projeto não ativo. Uniformizar isso é fatia própria, e vale para as duas fases.
- **Retorno da Fase 4 para a Fase 3**, previsto na ADR 0004, que é o único movimento para trás do
  processo. Nada nesta fatia o impede nem o prepara.
- **Registro de quem avançou e quando.** Hoje o projeto guarda só o número da fase. Um histórico de
  transições seria útil para a banca, e não é AC de lugar nenhum ainda.

## 6. Deploy

Sem migration e sem `db push`. O deploy desta fatia é o deploy do código. Conferir, ainda assim, que
prod não está atrasado em schema por causa das fatias anteriores (#65 e #66 criaram tabelas) — se
estiver, o avanço vai quebrar por um motivo que não é este.
