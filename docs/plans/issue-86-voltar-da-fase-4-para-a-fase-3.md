# Plano de implementação — Issue #86: "46 — Voltar da Fase 4 para a Fase 3"

Link: https://github.com/nicolasddr/tcc/issues/86
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (história 9, só a frase sobre o
retorno; histórias 17 a 21; a 22 na parte do retorno; "Decisões de Implementação › Avanço e retorno";
"Testing Decisions › Retorno")
Blocked by: #80 ✅ e #84 ✅ (fechadas). A #81, a #82, a #83 e a #85 também já estão no `main`
(`53dec1e`). Pode começar.

**A executar em 3 partes, uma por chat.** As seções 1 a 7 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas sete seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | Regras puras: pré-condições do retorno, mensagens, linhas da confirmação, a rodada da Fase 4 que a confirmação mostra e a frase nova na confirmação do avanço da Fase 3 | ✅ |
| 2 | A action `returnToPhase3`: recusa com rodada aberta, papel, fase errada; prova de que nada além da fase muda, de que ninguém é notificado e de que o descongelamento e o novo avanço seguem as regras | ✅ |
| 3 | A tela: painel "Para voltar à Fase 3" com a confirmação, link na barra de fases, testes de página, navegador e varredura dos ACs. Fecha a issue | ☐ |

**Duas decisões ⚠ precisam de confirmação** (D4, antes da Parte 1, e D7, antes da Parte 3). Perguntar
cada uma antes de escrever código da Parte em que entra.

**Nenhuma ADR nova.** A regra está escrita na **ADR 0004** ("existe um retorno explícito da Fase 4 para
a Fase 3, como ação confirmada do Administrador… a rodada da Fase 4 já executada fica preservada…
único movimento para trás"; emenda de 2026-10-02, "O fim da Fase 4") e no glossário
(`docs/CONTEXT.md`, verbete **Fase**: "O único retorno possível é da Fase 4 para a Fase 3, e ele só
exige que não haja rodada aberta"; verbete **Rodada de referência**: "Depois de um retorno à Fase 3 e
de um novo avanço, as rodadas da passagem anterior continuam com a referência delas"). Esta fatia
implementa o que está escrito. Se algo divergir, emende a ADR em vez de improvisar no código.

**Sem migration.** `projects.phase` já aceita 1 a 4; o retorno é um `UPDATE` de uma coluna.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Action de avanço | `pipeline/actions.ts` (`advancePhase`, `AdvancePhaseState`, `AdvanceOutcome`, `ADVANCE_DENIED`) | **modelo** da action nova; ela própria não muda |
| Pré-condições de fase | `pipeline/preconditions.ts` (`roundCycleBlockers`, `phase3BlockerMessage`, `phase3BlockedMessage`, `wrongPhaseMessage`, `phase4ConfirmationLines`) | ganha o bloco do retorno (D1 a D3) e uma linha em `phase4ConfirmationLines` (D5) |
| Congelamento | `pipeline/freeze.ts` (`isFrozen(phase) = phase >= PHASE_4`, `frozenMessage`) | **sem mudança**: com o projeto na Fase 3, `isFrozen` já devolve falso. É isso que "descongela" |
| Versionamento | `lib/versioning` (`decideSave`, `decideTextSave`, `isUsed`) | **sem mudança**: salvar sobre versão usada já cria a seguinte |
| Rodadas | `(tabs)/rounds/rounds.ts` (`loadOpenRound(projectId, tx)`, `listRounds`, `roundsInPhase`, `isOpen`) | só usados |
| Rodada de referência | `(tabs)/rounds/reference-round.ts` (`projectReferenceRound`, `referenceRoundOf`) | ganha a função da rodada da Fase 4 da passagem atual (D4) |
| Comparação | `(tabs)/rounds/reference-comparison.ts` (`referenceComparison`, `ComparedRound`), `reference-comparison-panel.tsx` (`ReferenceComparisonPanel`) | reaproveitados na confirmação (D6). **Não existe segundo cálculo** |
| Botão + diálogo | `pipeline/advance-phase.tsx` (`AdvancePhase`, `dialogClass`) | modelo do componente novo (D8); exporta `dialogClass` |
| Painel da Fase 3 | `pipeline/phase-3-checklist.tsx` (`Phase3Checklist`) | modelo do painel novo; **sem mudança** |
| Visão geral | `(tabs)/page.tsx` (`roundCycleInputs`, `phase3ChecklistData`, `#avancar`, `PhaseBar` com "Avançar fase" quando `phase < PHASE_4`) | monta o painel novo e o link da barra (Parte 3), sem consulta nova |
| "O que mudou" | `(tabs)/rounds/round-changes.ts` | **sem mudança**: o teste "o retorno da Fase 4 para a Fase 3 muda a fase sem ser a entrada na Fase 3" já existe (#85) |
| Séries | `(tabs)/rounds/agreement-series.ts` (`phaseRuns`), `quality-series.ts` | **sem mudança**: "a volta a uma fase abre um grupo novo" já é testado nas duas |
| Testes vizinhos | `pipeline/advance-phase-3.int.test.ts` (helpers `seedPhase3Project`, `seedArtifacts`, `seedRound`, `rate`, `seedVersions`, `seedReferenceRound`, `currentVersionsOf`; o teste "avançar não muda nada além da fase"), `pipeline/phase-4-freeze.int.test.ts` (`codebookForm`), `pipeline/preconditions.unit.test.ts`, `(tabs)/page.int.test.ts` (`findElement`, `phase3Of`, `phase3TextOf`, `roundWith`) | copiar helpers e espelhar os casos |

O que **falta**, e esta fatia cria: as pré-condições puras do retorno e os seus textos, a rodada da
Fase 4 que a confirmação mostra, a action `returnToPhase3`, o componente de botão e diálogo do retorno,
o painel "Para voltar à Fase 3", o link da barra na Fase 4 e a frase nova na confirmação do avanço da
Fase 3.

---

## 2. A fatia, por extenso

### O que trava

**Uma pré-condição, e só uma: nenhuma rodada aberta.** Com o projeto na Fase 4, a rodada aberta é
necessariamente da Fase 4, porque o avanço exige que não haja rodada aberta e nenhuma rodada atravessa
troca de fase. Mesmo assim, a regra lê "qualquer rodada aberta do projeto" (`loadOpenRound`), que é o
que importa e não depende desse raciocínio.

### O que não trava, nunca

- **Não ter rodada da Fase 4.** O Administrador pode voltar sem ter rodado nada.
- **ICR e Qualidade.** `returnBlockers` recebe só `{ openRoundNumber }`. A garantia é estrutural, como
  nos avanços: a função não tem como ler métrica.

### O que o retorno faz

Trava a linha de `projects` com `FOR UPDATE` (a mesma que `advancePhase`, `createRound`,
`saveCodebook` e `savePrompt` travam), confere a fase **dentro** da transação, muda `phase` para 3 e
**nada mais**: não toca em rodada, resposta, avaliação, nota, marca de outlier ou anotação de consenso,
não mexe em versão e não cria notificação.

### Por que isso basta para descongelar

O congelamento da Fase 4 é regra de fase (`isFrozen(phase)`), não marca nas versões. Com a fase em 3,
`saveCodebook` e `savePrompt` voltam ao comportamento de sempre: as versões usadas por rodadas já estão
congeladas pelo uso, então a primeira edição cria a versão seguinte.

### Depois do retorno

- **O histórico fica.** Rodadas, notas, ICR, Qualidade, marcas e anotações da Fase 4 seguem nas telas
  de sempre. A série de ICR mostra a sequência como aconteceu (Fase 3, Fase 4, Fase 3) porque
  `phaseRuns` abre um grupo novo a cada troca. A primeira rodada da Fase 3 depois do retorno diz "Fase:
  4 → 3" no "o que mudou", como qualquer troca de fase, sem frase própria. **Nada disso pede código
  novo**; a Parte 3 prova na página.
- **Voltar à Fase 4 segue as regras do avanço.** As três pré-condições de `phase3Blockers` valem de
  novo: nenhuma rodada aberta, ao menos uma rodada fechada da Fase 3 e versões vigentes iguais às da
  rodada de referência. Consequência que vale deixar explícita num teste: **voltar e avançar de novo sem
  editar nada é permitido**, com a mesma rodada de referência, porque as rodadas fechadas da Fase 3 da
  passagem anterior contam. Editou o codebook ou o prompt: o avanço recusa com `versions_changed` até
  que uma rodada da Fase 3 com as versões novas seja aberta e fechada.

### A Fase 4 não tem encerramento

O painel da Fase 4 mostra o retorno e nada mais: nenhum botão de concluir, nenhum "tudo pronto" que soe
como fim do processo, nenhuma palavra como "concluída", "aprovada", "replicou", "generalizou" ou
"próxima etapa".

### Quem vê

Só o Administrador. A visão geral só carrega `artifacts` e `agreement` para ele, e o painel vive dentro
desse bloco, como os de avanço. A action recusa quem não é Administrador **antes** de abrir a transação,
com a mesma mensagem para Avaliador e para quem não é membro.

---

## 3. Decisões

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. As pré-condições moram em `pipeline/preconditions.ts`**, junto das dos avanços, que é onde o
leitor procura regra de fase. Exportações novas:

```ts
export type ReturnInputs = { openRoundNumber: number | null }

export type ReturnBlocker = { key: 'open_round'; roundNumber: number }

export function returnBlockers(inputs: ReturnInputs): ReturnBlocker[]
export function canReturnFromPhase4(inputs: ReturnInputs): boolean
export function returnBlockerMessage(blocker: ReturnBlocker): string
export function returnBlockedMessage(blockers: readonly ReturnBlocker[]): string
export function returnWrongPhaseMessage(phase: number): string
export function returnConfirmationLines(): string[]
```

`ReturnBlocker` é união de um caso só de propósito: o `switch` de `returnBlockerMessage` continua sem
`default`, e o TypeScript cobra se um dia entrar outro bloqueio. **Não reaproveitar
`roundCycleBlockers`**: ele também cobra rodada fechada, que o retorno não exige.

**D2. Mensagens.** Ajustar a redação à vontade, preservando o conteúdo (o número da rodada, o que
fazer, o formato "Não foi possível…" dos avanços):

- `returnBlockerMessage(open_round)`: `A rodada {n} ainda está aberta, e voltar à Fase 3 deixaria para
  trás um ciclo que nunca se fecha. Feche a rodada {n} e volte de novo.`
- `returnBlockedMessage([b])`: `Não foi possível voltar à Fase 3. ` + a mensagem do bloqueio.
- `returnWrongPhaseMessage(p)`: `Este projeto está na Fase {p}, então não há de onde voltar aqui: o
  único retorno é da Fase 4 para a Fase 3. Recarregue a página para ver a fase atual.` Não reaproveitar
  `wrongPhaseMessage`, que fala em "avançar".
- `RETURN_DENIED` (constante privada em `actions.ts`, como `ADVANCE_DENIED`): `Não foi possível voltar
  de fase. Apenas o administrador do projeto pode fazê-lo.`

Nenhuma delas fala em ICR, Qualidade, concordância, aprovação ou conclusão.

**D3. As linhas da confirmação do retorno.** `returnConfirmationLines()`, na ordem:

1. `As rodadas da Fase 4 ficam como estão: notas, ICR, Qualidade, marcas de outlier e anotações de
   consenso continuam visíveis, como histórico.`
2. `Codebook e prompt voltam a ser editáveis. As versões que as rodadas usaram não mudam: a próxima
   edição cria uma versão nova.`
3. `Para voltar à Fase 4, valem de novo as regras do avanço: nenhuma rodada aberta, ao menos uma rodada
   fechada da Fase 3 e codebook e prompt iguais aos da rodada de referência, a última rodada fechada da
   Fase 3. Se você editar o codebook ou o prompt, será preciso abrir e fechar mais uma rodada da Fase 3
   antes de avançar.`
4. `A decisão de voltar é do Administrador. Nenhum valor de concordância ou de Qualidade libera,
   impede ou sugere o retorno.`
5. `Cancelar não muda nada.`

Texto inline, sem `InfoTooltip` (não cabe em `<dialog>`, memória).

**D4 ⚠. Qual rodada da Fase 4 a confirmação mostra — confirmada (a) em 2026-10-06.** A issue diz "se
houver rodada fechada da Fase 4, a confirmação mostra a última delas ao lado da sua referência". Depois
de um retorno e de um novo avanço, o projeto tem rodadas da Fase 4 de **duas passagens**. Se a passagem
atual ainda não fechou nenhuma, "a última fechada da Fase 4" do projeto é da passagem anterior, que já
foi deixada para trás num retorno anterior.

- **(a) Recomendado: só a passagem atual.** A rodada mostrada é a última fechada da Fase 4 com número
  maior que o da rodada de referência do projeto (`projectReferenceRound`). Sem referência (dado
  anterior à #81), todas as rodadas da Fase 4 contam. Sem nenhuma na passagem atual, a confirmação não
  mostra comparação. Assim o bloco sempre fala do que este retorno deixa para trás.
- (b) A última fechada da Fase 4 do projeto, de qualquer passagem. Mais literal, mas pode mostrar uma
  rodada que nada tem a ver com o retorno em curso.

Com (a), função pura nova em `(tabs)/rounds/reference-round.ts`:

```ts
export function lastClosedPhase4RoundOfPassage<T extends ReferenceCandidate>(
  rounds: readonly T[],
): T | null
```

Ela fica em `reference-round.ts` porque depende de `projectReferenceRound` e importa de
`./round-status` (nunca de `./rounds`: levaria `@/lib/db` ao bundle do cliente, gotcha da #81).

**D5. A frase nova na confirmação do avanço da Fase 3.** `phase4ConfirmationLines()` ganha, **antes**
de `Cancelar não muda nada.`, a linha `Se o resultado não for o esperado, é possível voltar à Fase 3
para refinar de novo; as rodadas da Fase 4 ficam como histórico.` Dois testes antigos de
`preconditions.unit.test.ts` proíbem "voltar"/"retorno" nessas linhas e **precisam ser editados** (a
#81 já registrou que eles eram desta issue): o `expect(text).not.toContain('voltar')` de "diz que
itens e avaliadores novos são escolha do Administrador…" sai, e "não fala em retorno" vira "fala do
retorno só na penúltima linha" (a frase nova contém "voltar à Fase 3"; as outras linhas continuam sem
"voltar", "volta", "retorno" e "retornar"). Citar os dois no commit.

O teste de página "na Fase 4 o painel diz que a Fase 3 foi concluída, não oferece avanço e não fala em
retorno" (`(tabs)/page.int.test.ts`) **não muda**: `phase3TextOf` lê só o `Phase3Checklist`, que na
Fase 4 não renderiza o diálogo, e o painel novo é outro componente.

**D6. A comparação na confirmação reaproveita a da #84.** A página calcula
`referenceComparison(rounds, round, agreement, quality)` para a rodada de D4, montando os dois mapas só
com as rodadas necessárias (a da Fase 4 e a referência dela) a partir de `observations` e `outliers`, que
ela já carrega. O resumo do diálogo é um título curto (`Última rodada fechada da Fase 4, ao lado da sua
rodada de referência`) + `<ReferenceComparisonPanel roundNumber={…} comparison={…} />`. Sem rodada da
Fase 4 na passagem: sem resumo, só as linhas. `kind: 'no_reference'` (dado legado): o painel já mostra
`noReferenceMessage`. Sem veredito, sem diferença calculada, sem cor de faixa (o `band={false}` da #84
já vale dentro do painel).

Conferir no navegador o grid `sm:grid-cols-2` dentro do diálogo de 32rem: a 640 px os dois lados ficam
com ~235 px cada; a 375 px empilham.

**D7 ⚠. O peso visual do retorno — a confirmar antes da Parte 3.** O retorno não é próxima etapa, e a
spec proíbe "nada que soe como conclusão ou próxima etapa". Recomendação:

- **Barra de fases na Fase 4**: `ButtonLink variant="secondary"` "Voltar à Fase 3" apontando para
  `#voltar` (hoje a barra fica sem ação na Fase 4). Alternativa: barra sem ação na Fase 4.
- **Botão do painel**: `variant="secondary"`, sem ícone de seta (não existe `ArrowLeftIcon` em
  `ui/icons.tsx`; criar um só para isso não paga). Alternativa: primário, como nos avanços.
- **Badge do painel**: `liberado` (tom neutro/sucesso) em vez de `tudo pronto`; bloqueado,
  `1 pendência` (tom warning). Alternativa: os mesmos badges dos avanços ("tudo pronto", "1 de 1
  pendentes").

**D8. Componente novo `pipeline/return-phase.tsx` (`ReturnPhase`), irmão de `AdvancePhase`.** Não
parametrizar `AdvancePhase`: rótulos, mensagem de sucesso, action e texto de carregamento mudam todos,
e o componente viraria uma tabela de strings. `advance-phase.tsx` passa a **exportar** `dialogClass`
para os dois compartilharem o desenho do diálogo. Props:
`{ projectId, blocked, hint, lines, summary? }`. Textos: botão `Voltar à Fase 3`, título do diálogo
`Voltar à Fase 3 — Validação do prompt?`, confirmar `Confirmar retorno`, carregando `Voltando…`,
sucesso `O projeto voltou para a Fase 3 — Validação do prompt. As rodadas da Fase 4 continuam
acessíveis para consulta.` (o nome da fase sai de `PROJECT_PHASES`, como no avanço).

**D9. O painel `pipeline/phase-4-return.tsx` (`Phase4Return`).** Espelha `Phase3Checklist`, com um
item só:

```ts
Phase4Return({ projectId, inputs, summary, className }: {
  projectId: string
  inputs: ReturnInputs
  summary?: React.ReactNode
  className?: string
})
```

- `Panel` com título `Para voltar à Fase 3`, badge de D7.
- Item `Nenhuma rodada aberta`: pendente → `returnBlockerMessage(blocker)` + "Resolver" para
  `/projects/<id>/rounds`; pronto → `CheckCircleIcon` + badge "pronto".
- `hint` do botão: liberado → `Nenhuma rodada aberta. O retorno pede confirmação antes de mudar
  qualquer coisa.`; bloqueado → `Falta 1 pendência para liberar o retorno.`
- `blocked` sai **só** de `returnBlockers(inputs)`.
- Renderizado só com `project.phase === PHASE_4`, dentro de um bloco próprio `id="voltar"` com
  `scroll-mt-6`, depois do `#avancar`. Nas Fases 1 a 3 o painel não existe.

**D10. A action `returnToPhase3` em `pipeline/actions.ts`.** Mesma ordem de `advancePhase`:

```ts
export type ReturnPhaseState = AdvancePhaseState

export async function returnToPhase3(_prev: ReturnPhaseState, formData: FormData): Promise<ReturnPhaseState>
```

`requireUserId` → `project_id` → `isProjectAdmin` (senão `RETURN_DENIED`) → `transaction` →
`select … for('update')` → sem projeto: `denied`; `phase !== PHASE_4`: `wrong_phase` → `loadOpenRound(
projectId, tx)` → `returnBlockers` → bloqueado: `incomplete` com `returnBlockedMessage` → `update
projects set phase = 3` → `{ status: 'returned', phase: PHASE_3 }`. Reaproveitar o tipo
`AdvanceOutcome` acrescentando `'returned'` ou declarar um `ReturnOutcome` próprio (escolher o que
deixar a action mais legível). Revalidar `/projects/<id>`, `/rounds`, `/codebook` e `/prompt` (as duas
últimas saem do modo leitura da Fase 4).

**D11. Testes em arquivos novos.** `pipeline/return-phase-3.int.test.ts` para a action (copiar os
helpers de `advance-phase-3.int.test.ts` e, para o codebook, `codebookForm` de
`phase-4-freeze.int.test.ts`); `(tabs)/phase-4-return.int.test.ts` para a página
(`(tabs)/page.int.test.ts` já tem 1.654 linhas; copiar `findElement` e `roundWith`).

---

## 4. Critérios de aceite × onde são provados

Preencher a coluna "Teste" com o nome real de cada teste ao fim de cada Parte.

| AC da issue | Onde | Teste |
|---|---|---|
| O retorno é recusado no servidor com rodada aberta, com mensagem que nomeia a rodada | P1 (unitário) + P2 (integração) | P1: `returnBlockers › trava com rodada aberta, nomeando a rodada`; `returnBlockerMessage… › nomeia a rodada aberta duas vezes e manda fechá-la`. P2: `recusa o retorno com rodada aberta, nomeando a rodada, e nada muda` |
| O retorno funciona sem nenhuma rodada da Fase 4 | P2 | P2: `sem nenhuma rodada da Fase 4, o Administrador volta para a Fase 3` |
| O retorno funciona depois de rodadas fechadas da Fase 4, e elas continuam intactas | P2 | P2: `depois de rodadas fechadas da Fase 4, volta e não muda nada além da fase` |
| Nenhum valor de ICR ou de Qualidade trava o retorno | P1 (assinatura) + P2 (ICR baixo e Qualidade em Baixo) + P3 (painel liberado) | P1: `returnBlockers › só lê a rodada aberta: nem rodada fechada nem métrica entram`. P2: `concordância baixa e Qualidade concentrada em Baixo na rodada da Fase 4 não impedem o retorno` |
| Depois do retorno, salvar o codebook e o texto do prompt funciona e cria versão nova | P2 | P2: `na Fase 4 o codebook é recusado, e depois do retorno salvá-lo cria a versão seguinte`; `na Fase 4 o prompt é recusado, e depois do retorno salvar o texto cria a versão seguinte` |
| A confirmação diz o que fica, o que destrava e que voltar à Fase 4 segue as regras do avanço | P1 (linhas) + P3 (`lines` no `ReturnPhase`) | P1: `describe('returnConfirmationLines')` (6 testes) |
| Com rodada fechada da Fase 4, a confirmação mostra a última delas ao lado da sua referência, sem veredito | P1 (D4) + P3 | P1: `reference-round — a rodada da Fase 4 da passagem atual` (6 testes) |
| O retorno não notifica ninguém | P2 | P2: `o retorno não notifica ninguém` (e a contagem em `depois de rodadas fechadas da Fase 4…`) |
| A confirmação do avanço da Fase 3 para a 4 diz que é possível voltar | P1 (D5) + P3 | P1: `phase4ConfirmationLines › fala do retorno só na penúltima linha` |
| O painel da Fase 4 não tem botão de concluir nem texto de aprovação | P3 (varredura de texto) | |
| O Avaliador não vê o painel e é barrado na ação | P2 (action) + P3 (página) | P2: `o Avaliador é recusado, e quem não é membro recebe a mesma mensagem, sem mudar a fase` |

| Teste da issue | Onde |
|---|---|
| Unitário: pré-condições do retorno com e sem rodada aberta | P1 |
| Integração: recusa com rodada aberta | P2 |
| Integração: volta sem rodada da Fase 4 e volta depois de rodadas fechadas, que ficam intactas | P2 |
| Integração: depois do retorno, salvar o codebook cria versão nova | P2 |
| Integração: segunda chamada devolve a mensagem de fase errada | P2 |
| Integração: nenhuma notificação criada; Avaliador barrado | P2 |
| Integração: avançar de novo para a Fase 4 depois do retorno segue a regra da rodada de referência | P2 |
| Página: painel liberado e bloqueado; confirmação com e sem rodada fechada da Fase 4; o Avaliador não vê o painel | P3 |
| A fatia entra com a suíte verde | as três Partes |

---

## 5. Fronteira com as fatias vizinhas

- **#80 (congelamento)**: `freeze.ts` não muda. A mensagem `frozenMessage` já diz "é preciso voltar à
  Fase 3"; agora isso existe de fato (ver § 7, link a partir dela).
- **#81 (versões no avanço)**: `phase3Blockers`, `referenceVersionsOf` e `versionChangesSentence` não
  mudam. Esta fatia só **prova** que eles valem depois de um retorno. A #81 deixou explícito que o
  teste de `phase4ConfirmationLines` que proíbe "voltar" é desta issue de editar (D5).
- **#82 (rodada na Fase 4)**: `roundBlockers` não muda. As mensagens "voltar à Fase 3" da abertura de
  rodada continuam como estão.
- **#84 (comparação)**: `referenceComparison` e `ReferenceComparisonPanel` só importados (D6).
- **#85 ("o que mudou")**: o retorno já é "troca de fase comum" em `roundChanges`; nada novo.
- **#67/#78 (CSV)**: sem relação.

---

## 6. Gotchas herdados

- **⚠ antes do código**: D4 antes da Parte 1, D7 antes da Parte 3, com `AskUserQuestion`, mesmo que o
  pedido seja só "implemente a Parte N".
- **TDD do plano: ver o vermelho.** Passo marcado (TDD) = teste escrito e rodado **falhando** antes do
  código. Asserção negativa sobre prop nova passa antes do código e não conta como vermelho; dizer isso
  no handoff. Vermelho de página por reversão: reverter só a peça que põe o dado na tela.
- **Grep do texto antigo nos testes** antes de mexer em `phase4ConfirmationLines`:
  `rg "voltar|retorno" app/projects` (já feito para este plano: os dois testes de D5 e o de página, que
  não muda).
- **Cena no banco quebra teste de integração**: depois da conferência no navegador, `scores` vazia antes
  de `npm test`.
- **Vitest com `[id]` no caminho**: filtrar por substring (`npx vitest run return-phase`), sem
  colchetes; idem `grep --include` no zsh.
- **Sem comentários no código** e **sem Prettier**.
- **Âncora única em edição por script**: títulos de teste se repetem entre `describe`s.
- **Texto em prop some das asserções**: `lines` e `summary` do `ReturnPhase` são props; ler pelo
  elemento (`findElement(tree, ReturnPhase).props`) ou por `renderToStaticMarkup`.
- **Notificações não têm `project_id`**: contar pelas `user_id` dos envolvidos (Administrador e
  avaliadores da cena), como em `advance-phase-3.int.test.ts`.
- **`reference-round.ts` não importa `./rounds`** (bundle do cliente, gotcha da #81).
- **LLM ausente no local**: rodada nova da Fase 3 depois do retorno, no navegador, sai por semeadura
  (`psql`) ou com a LLM falsa por `NODE_OPTIONS=--require`.
- **Preview pane com faixa preta**: provar por DOM (`get_page_text`, `read_page`); 375 px só vale medido
  em iframe.
- **Commit**: Partes 1 e 2 levam `Refs #86`; a Parte 3 leva `Closes #86`.

---

## 7. Fora de escopo

- **Retorno da Fase 3 para a Fase 2**, reabrir rodada fechada, notificar avaliadores (PRD, Out of
  Scope).
- **Frase própria para a primeira rodada da Fase 3 depois de um retorno** (PRD: "como qualquer outra").
- **Link de `frozenMessage` (codebook e prompt em leitura) e das recusas da #82 para `#voltar`.** A
  mensagem manda voltar à Fase 3 e agora o caminho existe; um link ajudaria, mas mexe em telas de
  outras fatias. Registrar como sugestão no handoff da Parte 3.
- **O texto "Fase 3 concluída" do `Phase3Checklist` na Fase 4.** Com o retorno existindo, "concluída"
  pode soar definitivo. Não é o painel da Fase 4 e o teste antigo o fixa; anotar se incomodar no
  navegador.
- **Achado da #85**: a ajuda da seção de Concordância em `rounds/page.tsx` fala em refinar também numa
  rodada da Fase 4. Continua fora.

---

# Parte 1 — Regras puras

**Objetivo:** tudo o que é regra e texto, sem banco e sem tela. No fim, `npm test` prova em unitário
quando o retorno trava, o que a confirmação diz, qual rodada da Fase 4 ela mostra e que a confirmação
do avanço da Fase 3 fala do retorno.

**Antes de começar:** perguntar a D4.

**Ler antes:** `AGENTS.md`, §§ 1 a 7, `pipeline/preconditions.ts` (do `phase3ConfirmationLines` até o
fim), `pipeline/preconditions.unit.test.ts` (a partir de `describe('phase3Blockers…`),
`(tabs)/rounds/reference-round.ts` e `reference-round.unit.test.ts`.

### 1.1 Pré-condições e mensagens (TDD, unitário) — `pipeline/preconditions.unit.test.ts`

`describe` novo do retorno:

- [ ] **Sem rodada aberta**: `returnBlockers({ openRoundNumber: null })` é `[]` e
      `canReturnFromPhase4` verdadeiro.
- [ ] **Com rodada aberta**: `[{ key: 'open_round', roundNumber: 7 }]` e `canReturnFromPhase4` falso.
- [ ] **Não exige rodada fechada**: não existe campo de rodadas fechadas em `ReturnInputs`; o caso
      acima já prova, e um `expectTypeOf<ReturnInputs>().toEqualTypeOf<{ openRoundNumber: number | null }>()`
      fixa a assinatura (é ela que garante que métrica não entra).
- [ ] **Mensagem do bloqueio**: nomeia a rodada duas vezes e manda fechar; `returnBlockedMessage`
      começa com `Não foi possível voltar à Fase 3.`; `returnBlockedMessage([])` é `''`.
- [ ] **Fase errada**: `returnWrongPhaseMessage(3)` nomeia a Fase 3 e diz que o único retorno é da 4
      para a 3.
- [ ] **Varredura**: nenhuma das mensagens contém `ICR`, `Qualidade`, `concordância`, `aprova`,
      `conclu`.

Depois: o bloco do retorno em `preconditions.ts` (D1, D2).

### 1.2 Linhas da confirmação do retorno (TDD, unitário)

- [ ] Diz que as rodadas da Fase 4 ficam como estão, citando notas, ICR, Qualidade, marcas e anotações.
- [ ] Diz que codebook e prompt voltam a ser editáveis e que a próxima edição cria versão nova.
- [ ] Diz que voltar à Fase 4 segue as regras do avanço e cita a rodada de referência.
- [ ] Diz que nenhum valor de concordância ou de Qualidade libera, impede ou sugere o retorno.
- [ ] Termina com `Cancelar não muda nada.`
- [ ] Nenhuma linha contém `aprova`, `conclu`, `replic`, `generaliz`, `próxima etapa`.

Depois: `returnConfirmationLines()` (D3).

### 1.3 A frase na confirmação do avanço (TDD, unitário)

- [ ] Editar os dois testes antigos (D5) e acrescentar: **a penúltima linha diz que é possível voltar
      à Fase 3** e que as rodadas da Fase 4 ficam como histórico; **as demais linhas continuam sem
      "voltar"/"retorno"**.

Ver o vermelho, depois a linha nova em `phase4ConfirmationLines()`.

### 1.4 A rodada da Fase 4 da confirmação (TDD, unitário) — `(tabs)/rounds/reference-round.unit.test.ts`

Com D4 (a):

- [ ] **Uma passagem**: `1 (F2) · 2 (F3) · 3 (F4 fechada) · 4 (F4 fechada)` → a 4.
- [ ] **Rodada aberta da Fase 4 não conta**: `… · 3 (F4 fechada) · 4 (F4 aberta)` → a 3.
- [ ] **Sem rodada da Fase 4**: `null`.
- [ ] **Passagem anterior não conta**: `2 (F3) · 3 (F4) · 4 (F3)` → `null`; e com `· 5 (F4 fechada)` → a 5.
- [ ] **Sem referência (legado)**: só rodadas das Fases 2 e 4 → a última fechada da Fase 4.
- [ ] **Ordem de entrada não importa.**

Depois: `lastClosedPhase4RoundOfPassage`. (Com D4 (b), os casos de passagem viram "a última fechada da
Fase 4 do projeto" e a função fica mais simples; ajustar a lista.)

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Testes antigos editados: só os dois de D5.

Commit sugerido:

```
feat(pipeline): pré-condições e textos do retorno da fase 4 para a fase 3

Refs #86
```

### O que a Parte 2 herda

- **D4 = (a)**, confirmada antes do código.
- **Nomes finais**, todos como em D1: `ReturnInputs`, `ReturnBlocker`, `returnBlockers`,
  `canReturnFromPhase4`, `returnBlockerMessage`, `returnBlockedMessage`, `returnWrongPhaseMessage` e
  `returnConfirmationLines` em `pipeline/preconditions.ts`; `lastClosedPhase4RoundOfPassage` em
  `(tabs)/rounds/reference-round.ts` (importa `PHASE_4` de `preconditions` e `isOpen` de
  `./round-status`; nada de `./rounds`).
- **Textos finais**: exatamente os de D2, D3 e D5, sem ajuste de redação. `RETURN_DENIED` ainda não
  existe (é da Parte 2, em `actions.ts`).
- **`lastClosedPhase4RoundOfPassage`**: conta as rodadas fechadas da Fase 4 com número maior que o de
  `projectReferenceRound(rounds)`; sem referência, o limite é `-Infinity` (todas contam).
- **Testes antigos editados**: só os dois de D5 em `preconditions.unit.test.ts` — saiu o
  `expect(text).not.toContain('voltar')` de "diz que itens e avaliadores novos são escolha do
  Administrador…", e "não fala em retorno" virou "fala do retorno só na penúltima linha". O teste de
  página "…não fala em retorno" passou sem mudança, como previsto.
- **Vermelho visto**: `reference-round.unit` falhou nos 6 casos novos (`not a function`);
  `preconditions.unit` primeiro quebrou na coleta (falta de `returnConfirmationLines`), depois, com o
  bloco do retorno já escrito e sem a frase de D5, falhou por asserção só em "fala do retorno só na
  penúltima linha". A asserção de tipo (`expectTypeOf<ReturnInputs>`) não tem vermelho em runtime: ela
  é cobrada pelo `typecheck`.
- **Divergências**: nenhuma em relação ao plano.
- **Suíte**: `npm run lint` e `npm run typecheck` limpos; `npm test` 89 arquivos, 1346 testes verdes.

---

# Parte 2 — A action

**Objetivo:** `returnToPhase3` volta o projeto da Fase 4 para a 3 no servidor, com as recusas certas, sem
tocar em nada além da fase e sem notificar ninguém. A integração prova também que o descongelamento e o
novo avanço seguem as regras de sempre.

**Ler antes:** `AGENTS.md`, §§ 1 a 7, "o que a Parte 2 herda", `pipeline/actions.ts` (`advancePhase`,
`saveCodebook`, `savePrompt`), `pipeline/advance-phase-3.int.test.ts` inteiro e o começo de
`pipeline/phase-4-freeze.int.test.ts` (fixture e `codebookForm`).

### 2.1 Testes (TDD, integração) — `pipeline/return-phase-3.int.test.ts` (novo)

Fixture base `seedPhase4Project(admin)`: rodada 1 fechada da Fase 2, rodada 2 fechada da Fase 3 com
v1 de codebook e prompt (a referência) e o projeto na Fase 4. Variações acrescentam rodadas da Fase 4.

- [ ] **Sem rodada da Fase 4**: `{ ok: true, phase: 3 }`, e `projects.phase` é 3.
- [ ] **Com rodada aberta da Fase 4**: `{ error: returnBlockedMessage([{ key: 'open_round',
      roundNumber: 3 }]) }`, fase continua 4, rodada 3 continua aberta.
- [ ] **Depois de rodadas fechadas da Fase 4, que ficam intactas**: rodadas 3 e 4 fechadas da Fase 4,
      com avaliações, notas, uma marca de outlier e uma anotação de consenso. Fotografar antes e depois:
      rodadas (número, status, fase, `closedAt`, versões), contagem de `evaluations`, `scores`,
      outliers e anotações, e `usedAt` das versões. Tudo igual; só `projects.phase` muda.
- [ ] **ICR baixo e Qualidade toda em Baixo não travam**: rodada 3 da Fase 4 fechada com notas que dão
      α abaixo de 0,667 e Qualidade concentrada em Baixo → volta. (Reaproveitar a cena de "concordância
      baixa" de `advance-phase-3.int.test.ts`.)
- [ ] **Segunda chamada**: `{ error: returnWrongPhaseMessage(3) }`. Também na Fase 2 e na Fase 1 (pode
      ser `it.each`), sem mudar a fase.
- [ ] **Papel**: o Avaliador ativo e quem não é membro recebem `RETURN_DENIED` (exportar a constante ou
      comparar a string), e a fase continua 4.
- [ ] **Ninguém é notificado**: contagem de `notifications` do Administrador e dos avaliadores da cena
      igual antes e depois.
- [ ] **Depois do retorno, salvar o codebook cria versão nova**: `saveCodebook` com conteúdo novo →
      `ok`, a vigente vira v2, a v1 (usada pela rodada 2) não muda.
- [ ] **Depois do retorno, salvar o texto do prompt cria versão nova**: idem com `savePrompt`.
- [ ] **Antes do retorno os dois são recusados** (controle): mesmo projeto, na Fase 4, `saveCodebook`
      devolve `frozenMessage('codebook')`. Prova que é o retorno que libera, e não a fixture.
- [ ] **Voltar e avançar de novo sem editar** → `advancePhase` devolve `{ ok: true, phase: 4 }`, com a
      mesma rodada de referência (§ 2).
- [ ] **Voltar, editar e avançar** → `advancePhase` recusa com `phase3BlockedMessage([{ key:
      'versions_changed', referenceRound: 2, changes: [codebook 1 → 2] }])`; semear a rodada 5 da Fase 3
      fechada com a v2 → avança. É o AC "segue a regra da rodada de referência".

Ver todos falharem (a action ainda não existe: o import quebra; para um vermelho por asserção, criar
primeiro a action devolvendo `{ error: '' }` e rodar).

### 2.2 `pipeline/actions.ts`

`returnToPhase3` e `RETURN_DENIED` (D10). `advancePhase` não muda.

### 2.3 Regressão

`advance-phase-3.int.test.ts`, `phase-4-freeze.int.test.ts` e `(tabs)/rounds/actions.int.test.ts`
seguem verdes **sem edição**.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, sem teste antigo editado nesta Parte.

Commit sugerido:

```
feat(pipeline): voltar da fase 4 para a fase 3

Refs #86
```

### O que a Parte 3 herda

- **A action**: `returnToPhase3(_prev, formData)` e o tipo `ReturnPhaseState = AdvancePhaseState` em
  `pipeline/actions.ts`. Sucesso: `{ ok: true, nonce, phase: PHASE_3 }` (o `ReturnPhase` lê `phase`
  para o nome da fase, como o `AdvancePhase`). Recusas, nesta ordem: `Projeto inválido.` sem
  `project_id`; `RETURN_DENIED` (privada, texto exato de D2) para quem não é Administrador, antes da
  transação; `returnWrongPhaseMessage(fase)` fora da Fase 4; `returnBlockedMessage(blockers)` com
  rodada aberta. Revalida `/projects/<id>`, `/rounds`, `/codebook` e `/prompt`.
- **Outcome**: tipo próprio `ReturnOutcome` (`returned` sem `phase`, `denied`, `wrong_phase`,
  `incomplete`), não o `AdvanceOutcome`. `advancePhase` não mudou.
- **`RETURN_DENIED` não é exportada**: arquivo `'use server'` só exporta funções assíncronas. O teste
  compara a string literal.
- **Testes**: `pipeline/return-phase-3.int.test.ts`, 13 casos (o `it.each` de fase errada cobre as
  Fases 1 e 2; a 3 é o "segundo retorno seguido"). O controle "antes do retorno é recusado" ficou
  dentro dos testes do codebook e do prompt, no mesmo projeto, em vez de teste separado.
- **Vermelho visto**: com a action provisória devolvendo `{ error: '' }`, os 13 falharam por
  asserção. Depois do código, um falhou por erro do próprio teste (comparava a v1 inteira, e o
  `isLatest` dela muda por definição); passou a comparar definições, critérios e `usedAt`.
- **Divergência**: um teste antigo editado, que o plano não previu — `pipeline/actions.int.test.ts ›
  não existe ação de apagar versão` lista as exportações de `actions.ts` e ganhou `'returnToPhase3'`
  (o mesmo aconteceu com `advancePhase` em `f3fc54a`). `advance-phase-3`, `phase-4-freeze` e
  `(tabs)/rounds/actions` passaram sem edição.
- **Suíte**: `npm run lint` e `npm run typecheck` limpos; `npm test` 90 arquivos, 1359 testes
  verdes.

---

# Parte 3 — A tela

**Objetivo:** na Fase 4, o Administrador vê o painel "Para voltar à Fase 3", liberado ou bloqueado pela
rodada aberta, e confirma vendo o que fica, o que destrava e, se houver, a última rodada fechada da
Fase 4 ao lado da sua referência. A confirmação do avanço da Fase 3 fala do retorno. No fim, a issue
fecha.

**Antes de começar:** perguntar a D7.

**Ler antes:** `AGENTS.md`, §§ 1 a 7, os dois "o que herda", `pipeline/advance-phase.tsx`,
`pipeline/phase-3-checklist.tsx`, `(tabs)/page.tsx`, `(tabs)/rounds/reference-comparison-panel.tsx` e,
em `(tabs)/page.int.test.ts`, os helpers do topo e os testes da Fase 4 (a partir de "na Fase 4 o painel
diz que a Fase 3 foi concluída…").

### 3.1 Testes de página (TDD) — `(tabs)/phase-4-return.int.test.ts` (novo)

- [ ] **Liberado**: Fase 4 sem rodada aberta → `Phase4Return` presente, `ReturnPhase` com
      `blocked: false`, item "Nenhuma rodada aberta" pronto, `lines` iguais a
      `returnConfirmationLines()`.
- [ ] **Bloqueado**: rodada 3 da Fase 4 aberta → `blocked: true`, o texto do painel tem
      `returnBlockerMessage` com "rodada 3" e um "Resolver" para `/projects/<id>/rounds`.
- [ ] **Confirmação sem rodada fechada da Fase 4**: `summary` vazio.
- [ ] **Confirmação com rodada fechada da Fase 4**: `summary` com a rodada 4 (a última da passagem) e a
      rodada 2 (a referência), ICR e Qualidade dos dois lados (`AgreementValue`/`QualityValue`), sem
      `BandBadge` e sem diferença.
- [ ] **Passagem anterior** (se D4 = a): `2 (F3) · 3 (F4 fechada) · 4 (F3 fechada)` e projeto de novo na
      Fase 4 → `summary` vazio.
- [ ] **Sem conclusão nem aprovação**: o texto do painel e do diálogo não contém `conclu`, `aprova`,
      `replic`, `generaliz`, `próxima etapa`, `tudo pronto`; não há outro botão além do `ReturnPhase`.
- [ ] **Só na Fase 4**: nas Fases 2 e 3 o `Phase4Return` não existe.
- [ ] **Barra de fases** (conforme D7): na Fase 4, a ação aponta para `#voltar`; nas Fases 1 a 3 continua
      "Avançar fase" para `#avancar`.
- [ ] **O Avaliador não vê o painel** nem o link da barra, com e sem rodada fechada da Fase 4.
- [ ] **A confirmação do avanço fala do retorno**: na Fase 3, as `lines` do `AdvancePhase` do
      `Phase3Checklist` contêm `voltar à Fase 3`.
- [ ] **Histórico depois do retorno**: projeto com `2 (F3) · 3 (F4) · 4 (F3)`, de volta à Fase 3 pela
      action → a série de Concordância tem três grupos, Fases 3, 4 e 3, nessa ordem.

Ver o vermelho: os testes que leem `Phase4Return`/`ReturnPhase` falham por elemento ausente. As
asserções negativas do Avaliador passam antes do código; dizer no handoff.

### 3.2 `pipeline/return-phase.tsx` (novo) e `advance-phase.tsx`

`ReturnPhase` (D8); `advance-phase.tsx` exporta `dialogClass`.

### 3.3 `pipeline/phase-4-return.tsx` (novo)

`Phase4Return` (D9, badges e botão conforme D7).

### 3.4 `(tabs)/page.tsx`

- `returnInputs = { openRoundNumber: agreement.rounds.find(isOpen)?.roundNumber ?? null }`.
- `returnSummary`: com `lastClosedPhase4RoundOfPassage(agreement.rounds)`, montar os mapas das duas
  rodadas e `referenceComparison` (D6). Uma função pequena ao lado de `phase3ChecklistData`.
- `<div id="voltar" className="scroll-mt-6">` com o `Phase4Return`, só com `artifacts && agreement &&
  project.phase === PHASE_4`.
- `PhaseBar.action`: na Fase 4, o link de D7.
- Nenhuma consulta nova.

### 3.5 Conferência no navegador

`/dev/login`. Cena por `psql`: projeto na Fase 4 com rodada 2 fechada da Fase 3 e rodada 3 fechada da
Fase 4, ambas com notas.

1. Painel liberado; a barra leva a `#voltar`; o diálogo mostra as linhas e a comparação 3 × 2 lado a
   lado; Cancelar não muda nada.
2. Abrir uma rodada da Fase 4 (semeada): painel bloqueado nomeando a rodada, "Resolver" leva a Rodadas,
   botão desabilitado. Fechar a rodada.
3. Confirmar o retorno: alerta de sucesso, barra na Fase 3, o codebook sai do modo leitura e salvar
   cria versão nova; as rodadas da Fase 4 seguem na lista; a série mostra 3, 4 e 3 depois de semear a
   rodada seguinte da Fase 3; a revisão dela mostra "Fase: 4 → 3".
4. Avançar de novo: o painel da Fase 3 bloqueia por versões (codebook editado), com os números.
5. 375 px medido em iframe (painel e diálogo); 640 px para os dois lados da comparação no diálogo.
6. Entrar como Avaliador: nada de painel nem de link.

**Apagar a cena antes de `npm test`** (`scores` vazia).

### 3.6 Varredura dos ACs

Preencher a tabela da § 4 com o nome de cada teste. Marcar os checkboxes da issue no GitHub e citar,
no fechamento, o commit de cada Parte. Conferir à mão que nada em `phase-4-return.tsx` decide `blocked`
por ICR ou Qualidade.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, navegador conferido, tabela da § 4 preenchida.

Commit sugerido:

```
feat(visao-geral): painel para voltar da fase 4 para a fase 3

Closes #86
```

### Handoff

_(preencher ao fim da Parte: suíte, divergências, vermelho visto, achados do navegador)_

---

## 8. Deploy

Sem migration e sem `db push`. **Antes do deploy, confira que prod não está atrasado em schema**
(memória: já atrasou duas vezes). Com esta fatia o Épico 4 (#79) fica completo; conferir se o épico
pode ser fechado.
