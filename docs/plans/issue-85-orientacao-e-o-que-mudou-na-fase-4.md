# Plano de implementação — Issue #85: "45 — Orientação de leitura e "o que mudou" na Fase 4"

Link: https://github.com/nicolasddr/tcc/issues/85
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 15 e 16; "Decisões de
Implementação › Leitura" — "a orientação de leitura passa a receber a fase da rodada e ganha os três
textos da Fase 4. Continua sem receber Qualidade" e "as mudanças entre rodadas ganham o caso de entrada
na Fase 4"; NFR de Usabilidade "nenhuma tela usa palavra de juízo sobre a Fase 4"; "Testing Decisions ›
Orientação" e "› Mudanças entre rodadas")
Blocked by: #82 ✅ (fechada). A #83 e a #84 também já estão no `main` (`98645ef`): a rodada da Fase 4
já tem o bloco "Comparação com a rodada de referência", que é para onde o texto dentro da faixa aponta.
Pode começar.

**A executar em 2 partes, uma por chat.** As seções 1 a 7 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas sete seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A orientação da Fase 4: a função passa a receber a fase da rodada, os três textos novos com as varreduras, e a orientação aparecendo na rodada da Fase 4 da tela de rodadas | ☑ |
| 2 | O "o que mudou" da entrada na Fase 4: o caso novo em `roundChanges`, a frase com o número da rodada de referência, na revisão da rodada e no cartão da lista; verificação no navegador e varredura dos ACs | ☑ |

As duas Partes são independentes no código (arquivos diferentes), mas a Parte 2 fecha a issue e faz a
varredura de todos os ACs, então vai por último.

**Duas decisões ⚠ precisam de confirmação antes da Parte 1** (D3 e D5). Perguntar as duas de uma vez,
antes de escrever código.

**Sem migration, sem ADR nova, sem deploy especial.** Tudo é derivado do que a página já carrega. O
verbete **Refinar** de `docs/CONTEXT.md` já descreve a leitura da Fase 4 ("Na Fase 4 não se refina:
com ICR baixo…; com ICR alto, olha-se a Qualidade ao lado da rodada de referência. Refinar de novo
exige voltar à Fase 3, e a ferramenta não diz quando fazê-lo"), e a emenda de 2026-10-02 da **ADR
0004** fecha a porta: "a orientação pelo ICR nunca diz que é hora de voltar à Fase 3, assim como nunca
diz que é hora de avançar". A ADR 0011 (ICR invisível ao Avaliador) cobre o "não aparece para o
Avaliador". Nada desta fatia entra em `roundBlockers`, `canAdvance*` nem em botão nenhum.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Escolha da orientação | `(tabs)/rounds/reading-guidance.ts` (`ReadingGuidance`, `readingGuidance(agreement)`, `hasReadingGuidance(phase) = phase === PHASE_3`) | **muda**: recebe a fase da rodada; `hasReadingGuidance` passa a aceitar a Fase 4 |
| Palavras da orientação | `(tabs)/rounds/reading-guidance-labels.ts` (`GUIDANCE_HEADING`, `BELOW_BAND_GUIDANCE`, `WITHIN_BAND_GUIDANCE`, `notCalculableReasonText`, `notCalculableGuidance`, `guidanceText`) | **cresce**: os três textos da Fase 4; os da Fase 3 ficam **byte a byte** iguais |
| Componente | `(tabs)/rounds/reading-guidance-note.tsx` (`ReadingGuidanceNote({ guidance })`, `Card tone="subtle"`) | não muda: continua chamando `guidanceText(guidance)` |
| Tela de rodadas | `(tabs)/rounds/page.tsx`, linhas 278-280: `focusRound && hasReadingGuidance(focusRound.phase) ? <ReadingGuidanceNote guidance={readingGuidance(focusPair.all)} />`, entre a `Section` de Concordância e a de Qualidade; o bloco de comparação vem depois da Qualidade | muda uma linha: passa `focusRound.phase` |
| Faixa | `(tabs)/rounds/agreement-labels.ts` (`agreementBand`, `AGREEMENT_BANDS`) | só importada, igual à Fase 3 |
| Rodada de referência | `(tabs)/rounds/reference-round.ts` (`referenceRoundOf`), `reference-comparison.ts`, `reference-comparison-labels.ts` (`REFERENCE_COMPARISON_TITLE` = "Comparação com a rodada de referência") | o texto dentro da faixa aponta para o bloco; a frase do "o que mudou" diz o número da referência |
| O que mudou | `(tabs)/rounds/round-changes.ts` (`RoundVersions`, `RoundChanges` com `entersPhase3`, `roundChanges(round, previous)`, `previousRoundOf`) | **cresce**: `entersPhase4` |
| Palavras do que mudou | `(tabs)/rounds/round-changes-labels.ts` (`ENTERS_PHASE_3_NOTE`, avisos de codebook e prompt) | **cresce**: a frase da entrada na Fase 4 |
| Nota do que mudou | `(tabs)/rounds/round-changes-note.tsx` (`RoundChangesNote({ changes, compact })`; a frase da Fase 3 sai fora do `compact`, então aparece no cartão e na revisão) | **muda**: mostra a frase da Fase 4 do mesmo jeito |
| Quem mostra o que mudou | `[roundId]/page.tsx` (`changesOf`, só `isAdmin`) e `round-list.tsx` (`changesOf`, `compact`, só no ramo do Admin de `rounds/page.tsx`) | não mudam |
| Fases | `pipeline/preconditions.ts` (`PHASE_3 = 3`, `PHASE_4 = 4`, literais) | o tipo `GuidedPhase` sai daqui |
| Testes unitários | `reading-guidance.unit.test.ts` (8), `reading-guidance-labels.unit.test.ts` (11, varreduras sobre `Object.values(labels)`), `round-changes.unit.test.ts` (inclui "o retorno da Fase 4 para a Fase 3 muda a fase sem ser a entrada na Fase 3" e a lista de chaves), `round-changes-labels.unit.test.ts` (varredura **"nenhum texto menciona a Fase 4"** e `JUDGEMENT_WORDS` com `'fase 4'`) | as varreduras precisam ser **reescopadas** (D4, D7) |
| Testes de página | `rounds/page.int.test.ts` (6 asserções `expect(guidanceOf(tree)).toEqual({ guidance: { kind: … } })`, linhas 1848, 1861, 1883, 1916, 1940, 1985), `rounds/phase-4-reading.int.test.ts` (`phase4Scene(admin, specs)` com `absent`, `basicScene`, `findElement`, `blockIndexOf`, `markupTextOf`, `JUDGMENT_WORDS` com `'generaliz'`), `[roundId]/page.int.test.ts` (`roundWith`, `nextRoundWith`, `changesTextOf`) | onde entram as provas de página |

O que **falta** e esta fatia cria: a fase dentro de `ReadingGuidance`, os três textos da Fase 4, o
`entersPhase4` com a sua frase, e os testes.

---

## 2. A fatia por extenso

### Orientação (história 15)

Numa rodada da **Fase 4**, o Administrador lê, no mesmo lugar onde a Fase 3 lê a dela (entre o bloco de
Concordância e o de Qualidade da rodada em foco), um de três textos, escolhido **só** pelo ICR da
rodada e pela faixa de referência, com os mesmos cortes da Fase 3:

| Caso | Quando | O que o texto diz |
|---|---|---|
| Abaixo da faixa | `agreementBand(alpha) === 'questionable'` | os avaliadores não estão aplicando o codebook da mesma forma, o que indica que ele não se estendeu a essas pessoas ou a esses itens (D3 ⚠) |
| Não calculável | `calculable === false` | por que não há número (o mesmo motivo curto da Fase 3) e que a comparação com a rodada de referência ainda não é possível |
| Dentro da faixa | banda `acceptable` ou `good` | os avaliadores concordam entre si, e é hora de olhar a Qualidade ao lado da rodada de referência |

Rascunho dos textos (os definitivos saem na Parte 1, depois da resposta à D3):

- **Abaixo da faixa:** "O ICR desta rodada ficou abaixo da faixa de referência: os avaliadores não
  estão aplicando o codebook da mesma forma, o que indica que ele não se estendeu a essas pessoas ou a
  esses itens."
- **Não calculável:** "Não há ICR nesta rodada: {motivo}. Sem esse número não se sabe se os
  avaliadores aplicam o codebook da mesma forma, e por isso a comparação com a rodada de referência
  ainda não é possível."
- **Dentro da faixa:** "O ICR desta rodada está dentro da faixa de referência: os avaliadores
  concordam entre si, e é hora de olhar a Qualidade ao lado da rodada de referência."

O que o texto da Fase 4 **nunca** faz: manda refinar, diz que é hora de voltar (ou fala da Fase 3),
fala em aprovação, replicação ou generalização, qualifica a Qualidade, ou esconde/desabilita qualquer
coisa. Os textos da Fase 3 **não mudam**.

### O que mudou (história 16)

A primeira rodada da Fase 4 ganha, junto das linhas de codebook, prompt e fase que já existem, uma frase
própria:

> "Primeira rodada da Fase 4: o codebook e o prompt são os mesmos da rodada de referência, a rodada
> {N}. O que deve mudar são os itens de entrada e os avaliadores."

A frase é informação: não olha itens nem avaliadores, e aparece mesmo que a rodada use os mesmos
itens e as mesmas pessoas da referência.

### Quem vê

| | Administrador | Avaliador |
|---|---|---|
| Orientação na rodada em foco da Fase 4 (`rounds/page.tsx`) | sim | **não** (o ramo do Avaliador retorna antes e nunca calcula ICR) |
| Frase da Fase 4 na revisão da rodada (`[roundId]/page.tsx`) | sim | **não** (`isAdmin && changes`) |
| Frase da Fase 4 no cartão da lista de rodadas | sim | **não** (`RoundList` só existe no ramo do Admin) |

---

## 3. Decisões desta fatia

**D1. A fase entra no tipo, e a função passa a recebê-la.** Em `reading-guidance.ts`:

```ts
export type GuidedPhase = typeof PHASE_3 | typeof PHASE_4

export type ReadingGuidance = { phase: GuidedPhase } & (
  | { kind: 'below_band' }
  | { kind: 'not_calculable'; reason: NotCalculableReason }
  | { kind: 'within_band' }
)

export function readingGuidance(agreement: Agreement, phase: GuidedPhase): ReadingGuidance

export function hasReadingGuidance(phase: number): phase is GuidedPhase
```

- `hasReadingGuidance` vira **type guard** e passa a ser `phase === PHASE_3 || phase === PHASE_4`. A
  Fase 2 continua sem orientação. Com o guard, a chamada da página (`hasReadingGuidance(focusRound.phase)
  ? readingGuidance(focusPair.all, focusRound.phase)`) compila sem cast.
- A escolha do caso **não muda**: `calculable`, depois `agreementBand(alpha)`. A fase só é carregada
  para o texto. As duas fases usam a mesma faixa porque a régua é a mesma (ADR 0004).
- A fase vem **da rodada**, como pede a issue e como a #76 já fazia (D5).
- Consequência nos testes existentes: as 6 asserções de página da #76 que comparam
  `{ guidance: { kind: … } }` ganham `phase: PHASE_3`, e os unitários da #76 passam a chamar
  `readingGuidance(…, PHASE_3)`. Os **textos** da Fase 3 não mudam; o formato do objeto muda.

**D2. Continua sem receber Qualidade, provado do mesmo jeito.**
`expectTypeOf(readingGuidance).parameters.toEqualTypeOf<[Agreement, GuidedPhase]>()` e
`expect(readingGuidance).toHaveLength(2)`. `reading-guidance.ts` continua sem importar `./quality` nem
`./quality-labels`. A prova de página da #76 ("notas todas em Alto e todas em Baixo dão o mesmo
texto") continua valendo, porque o caminho é o mesmo para as duas fases.

**D3. ⚠ As palavras do texto abaixo da faixa — a confirmar antes da Parte 1.** Há um conflito entre
três fontes:

- a issue e o verbete **Refinar** dizem "o que indica que ele **não generalizou**";
- a própria issue pede, nos testes, "varredura de palavras (`"voltar"`, `"aprovad"`, `"generalizou"`)
  nos textos da Fase 4", e o AC diz que nenhum texto "fala em … generalização confirmada";
- a NFR de Usabilidade da PRD proíbe "generalizou" em qualquer tela da Fase 4, e o teste da #84
  (`phase-4-reading.int.test.ts`, `JUDGMENT_WORDS`) já varre `'generaliz'` no bloco de comparação.

A frase "não generalizou" contém "generalizou", então a varredura pedida pela própria issue falharia.

- **(a) Recomendada:** trocar a palavra e manter a varredura literal. "o que indica que ele **não se
  estendeu a essas pessoas ou a esses itens**". Diz o mesmo (o ICR baixo indica que o codebook não
  vale para esse grupo e esses dados), não usa a raiz que a PRD proíbe, e a varredura fica simples
  (`'generaliz'`, igual à da #84).
- **(b)** Manter "não generalizou" (fiel à issue e ao glossário) e varrer só as formas positivas
  (`"generalizou."` sem "não" antes, "generalização confirmada", "generalizou para"). A varredura fica
  frágil: qualquer frase futura com "generalizou" passa se tiver "não" antes.

Junto com a D3, confirmar também **"os avaliadores"** em vez de **"os avaliadores novos"**. A issue
diz "novos", mas a #84 acabou de pôr no painel a marca de quem já avaliou antes, justamente porque a
rodada da Fase 4 pode ter veteranos; o texto não verifica isso e chamar todos de "novos" seria afirmar
o que a tela, logo acima, mostra que pode ser falso. Recomendação: "os avaliadores" (o rascunho da § 2
já está assim). Se preferir "novos", é só trocar a palavra.

**D4. As palavras moram no mesmo `reading-guidance-labels.ts`.**

- Novos: `PHASE_4_BELOW_BAND_GUIDANCE`, `PHASE_4_WITHIN_BAND_GUIDANCE`,
  `phase4NotCalculableGuidance(reason)` (reusa `notCalculableReasonText(reason)`, para que o motivo seja
  idêntico nas duas fases).
- `GUIDANCE_HEADING` ("Por onde ler esta rodada") é o mesmo nas duas fases.
- `guidanceText(guidance)` despacha por `guidance.phase` e depois por `guidance.kind`. A forma mais
  legível é um objeto por fase (`{ below_band, within_band, notCalculable }`) indexado pela fase; decidir
  no código, desde que os `switch` continuem exaustivos.
- "Qualidade" no texto dentro da faixa vem de `QUALITY_LABEL`, como na Fase 3. "rodada de referência"
  pode ficar literal (é o termo do glossário; `REFERENCE_COMPARISON_TITLE` é o título inteiro do bloco,
  e citá-lo entre aspas no texto deixaria a frase pesada).
- As constantes da Fase 3 **não são tocadas**: o diff do arquivo só tem linhas novas e o `guidanceText`.

**Varreduras reescopadas.** Hoje `allTexts()` em `reading-guidance-labels.unit.test.ts` junta
`Object.values(labels)`, então os textos da Fase 4 cairiam nas varreduras da Fase 3. Trocar por duas
listas explícitas, `phase3Texts()` e `phase4Texts()`, e um teste que prova que a soma das duas alcança
todas as strings exportadas (para nenhuma exportação nova escapar):

| Varredura | Sobre | Palavras |
|---|---|---|
| Juízo (existente) | as duas fases | `melhor`, `pior`, `boa`, `ruim`, `aprovad`, `suficiente`, `basta`, `pronto`, `questionável` |
| Trava (existente) | as duas fases | `bloque`, `trava`, `impede`, `não pode`, `desabilit` |
| Fase 4 e avanço (existente) | as duas fases (os textos da Fase 4 também não falam "Fase 4" nem "avançar") | `fase 4`, `avançar`, `avance`, `próxima fase` |
| **Retorno e veredito (nova)** | Fase 4 | `voltar`, `volte`, `retorn`, `fase 3`, `refin`, `aprova`, `reprova`, `replic`, `generaliz`, `confirmad` |

`refin` não está nos ACs, mas é o motivo da história 15 ("para que o texto não me mande refinar algo
que está congelado"); custa uma palavra na lista.

**D5. ⚠ A fase que decide é a da rodada, também num projeto já na Fase 4 — a confirmar antes da Parte
1.** A issue diz "a função de orientação passa a receber a fase da rodada", e a #76 fixou num teste
"a fase da rodada decide, e não a do projeto". Consequência: logo depois do avanço para a Fase 4, antes
de abrir a primeira rodada dela, a rodada em foco é a última da Fase 3 (a de referência), e a tela
mostra o **texto da Fase 3**, que com ICR abaixo da faixa diz "o caminho é refinar o codebook" — com o
codebook congelado.

- **(a) Recomendada:** manter a fase da rodada. O texto descreve como ler **aquela** rodada, que foi da
  Fase 3; o projeto mostra em outros lugares que está congelado (painel de nova rodada e modo de leitura
  do codebook), e a janela dura até a primeira rodada da Fase 4 abrir. Simétrico: depois de um retorno
  (#86), a rodada em foco da Fase 4 continua com o texto da Fase 4. Um teste de página fixa o
  comportamento.
- **(b)** Esconder a orientação quando `focusRound.phase !== project.phase`. Evita o texto que manda
  refinar, mas some com a orientação exatamente na rodada de referência, e muda o que a #76 testou.
- **(c)** Usar a fase do projeto. Contraria a letra da issue e a #76.

**D6. A frase da entrada na Fase 4: `entersPhase4` em `RoundChanges`.**

```ts
entersPhase4: previous.phase < PHASE_4 && round.phase >= PHASE_4
```

(o mesmo desenho de `entersPhase3`). A frase é `entersPhase4Note(referenceRoundNumber)` em
`round-changes-labels.ts`, e `RoundChangesNote` a mostra no mesmo lugar e do mesmo jeito que
`ENTERS_PHASE_3_NOTE` (fora do `compact`, então na revisão e no cartão).

**O número da referência é `changes.previousRoundNumber`.** `roundChanges` recebe só a rodada e a
anterior, e não precisa mudar de assinatura, porque quando `entersPhase4` é verdadeiro a anterior **é**
a rodada de referência:

- `entersPhase4` exige anterior com fase menor que 4, e só se chega à Fase 4 a partir da 3, então a
  anterior é da Fase 3;
- o avanço da Fase 3 exige nenhuma rodada aberta (`phase3Blockers`, `open_round`), e rodada nasce na
  fase do projeto, então nenhuma rodada da Fase 3 abre depois do avanço: a anterior está fechada;
- a anterior é a de maior número antes da rodada; sendo da Fase 3 e fechada, é a mesma que
  `referenceRoundOf` acha (a última fechada da Fase 3 antes dela).

Um teste de página cruza o número da frase com o da referência do bloco de comparação, para que a
igualdade seja verificada e não só argumentada.

Casos de borda, todos coerentes com "a primeira rodada da Fase 4 **depois de uma rodada de outra
fase**":
- retorno e novo avanço **com** rodadas da Fase 3 no meio: a primeira rodada da Fase 4 da nova
  passagem mostra a frase, com a referência nova;
- retorno e novo avanço **sem** rodada da Fase 3 no meio: a anterior é da Fase 4, `entersPhase4` é
  falso, a frase não aparece (a fase não mudou entre as duas rodadas);
- retorno da Fase 4 para a Fase 3: `entersPhase3` e `entersPhase4` falsos; troca de fase comum (o teste
  da linha 99 de `round-changes.unit.test.ts` já existe e ganha a asserção de `entersPhase4`).

**Os avisos de codebook e prompt não mudam.** Na entrada da Fase 4 as versões são as da referência por
regra do servidor (#81), então `codebook.changed` e `prompt.changed` são falsos e `noticeOf` devolve
`null`. `noticeOf` não ganha ramo novo.

**"Não verifica nada", por construção.** `RoundVersions` não tem itens nem avaliadores; o teste de
chaves de `RoundChanges` fixa isso. Na página, a cena da #84 usa os **mesmos** três avaliadores na
referência e na rodada da Fase 4, e a frase aparece assim mesmo.

**D7. A varredura do "o que mudou" é reescopada.** `round-changes-labels.unit.test.ts` tem "nenhum
texto menciona a Fase 4" e `'fase 4'` dentro de `JUDGEMENT_WORDS`, ambos sobre `Object.values(labels)`.
A frase nova menciona a Fase 4 por definição. Mudar para:

- `'fase 4'` sai de `JUDGEMENT_WORDS` (não é palavra de juízo; estava ali como trava de escopo do
  Épico 3);
- "nenhum texto menciona a Fase 4" vira "**só a frase da entrada na Fase 4** menciona a Fase 4";
- a frase da Fase 4 entra em `allTexts()` (`entersPhase4Note(7)`) e passa pelas varreduras de juízo e
  de trava, mais `voltar`, `retorn`, `aprova`, `replic`, `generaliz`, `novos` (não afirma que itens ou
  avaliadores são novos; diz o que **deve** mudar).

**D8. Nada some, nada trava.** `readingGuidance` e `entersPhase4` não entram em `roundBlockers`,
`NewRound`, `CloseRound`, `GenerateResponses`, `phase3Blockers` nem no bloco de comparação. Qualidade e
comparação continuam renderizadas nas mesmas condições de hoje.

---

## 4. Critérios de aceite × onde são provados

| AC da issue | Parte | Prova |
|---|---|---|
| A rodada da Fase 4 mostra a orientação própria nos três casos de ICR | 1 | unitário (`readingGuidance(…, PHASE_4)` nos três casos; `guidanceText` com `phase: 4` devolve os textos da Fase 4) + página (`phase-4-reading.int.test.ts`: abaixo, dentro, não calculável) |
| Nenhum texto da Fase 4 diz que é hora de voltar, nem fala em aprovação, replicação aprovada ou generalização confirmada | 1 | varredura "retorno e veredito" sobre `phase4Texts()` (D4) + página: texto renderizado nos três casos passa pela mesma lista |
| Os textos da Fase 3 não mudam | 1 | unitário: `guidanceText({ phase: 3, … })` devolve exatamente `BELOW_BAND_GUIDANCE`, `WITHIN_BAND_GUIDANCE`, `notCalculableGuidance(reason)`; os testes de conteúdo da #76 seguem verdes sem edição de texto; diff de `reading-guidance-labels.ts` sem linha removida |
| A função de orientação não recebe Qualidade | 1 | `expectTypeOf(…).parameters.toEqualTypeOf<[Agreement, GuidedPhase]>()` + aridade 2 |
| A primeira rodada da Fase 4 mostra a frase sobre a rodada de referência e sobre itens e avaliadores | 2 | unitário (`entersPhase4`, `entersPhase4Note`) + página da revisão (`[roundId]`) + cartão da lista de rodadas |
| A orientação e a frase não aparecem para o Avaliador | 1, 2 | página: Avaliador na rodada da Fase 4 sem `ReadingGuidanceNote` nem os textos (Parte 1); Avaliador na revisão da rodada da Fase 4 sem `RoundChangesNote` nem a frase (Parte 2) |
| Testes: unitário dos textos, varredura, mudanças na entrada da Fase 4, página, suíte verde | 1, 2 | — |

A tabela "AC → nome do teste" é preenchida no fim da Parte 2:

| AC | Testes |
|---|---|
| Orientação própria nos três casos de ICR ☑ | `reading-guidance.unit`: "na Fase 4, os mesmos cortes dão os mesmos casos, com a fase da rodada"; `reading-guidance-labels.unit`: "na Fase 4, guidanceText devolve os textos da Fase 4", "na Fase 4, abaixo da faixa…", "na Fase 4, não calculável…", "na Fase 4, dentro da faixa…"; `phase-4-reading.int`: "numa rodada da Fase 4 abaixo da faixa…", "… dentro da faixa…", "… com um avaliador só…" |
| Nenhum texto da Fase 4 fala em voltar, aprovação, replicação, generalização ☑ | `reading-guidance-labels.unit`: "nenhum texto da Fase 4 fala em voltar, refinar ou veredito"; `phase-4-reading.int`: "nenhum texto renderizado da orientação da Fase 4 fala em voltar, refinar ou veredito"; `round-changes-labels.unit`: "a frase da Fase 4 não fala em voltar, veredito nem novidade" |
| Textos da Fase 3 não mudam ☑ | `reading-guidance-labels.unit`: "guidanceText devolve o texto de cada caso", "abaixo da faixa manda refinar…", "não calculável diz o motivo…", "dentro da faixa manda olhar a Qualidade…" (sem edição de texto); `phase-4-reading.int`: "num projeto na Fase 4 sem rodada da Fase 4, a rodada em foco da Fase 3 mostra o texto da Fase 3" |
| A função não recebe Qualidade ☑ | `reading-guidance.unit`: "recebe só o Agreement e a fase, e nada de Qualidade" |
| Primeira rodada da Fase 4 mostra a frase ☑ | `round-changes.unit`: "a primeira rodada da Fase 4 entra na Fase 4, com as mesmas versões", "a segunda rodada da Fase 4 não é mais a entrada na Fase 4", "retorno e novo avanço sem rodada da Fase 3 no meio…", "o retorno da Fase 4 para a Fase 3…"; `round-changes-labels.unit`: "a frase da Fase 4 nomeia a rodada de referência e diz o que deve mudar", "só a frase da entrada na Fase 4 menciona a Fase 4"; `[roundId]/page.int`: "na primeira rodada da Fase 4, a revisão diz…", "a frase da Fase 4 aparece mesmo com os mesmos itens e avaliadores da referência", "a segunda rodada da Fase 4 não repete a frase"; `phase-4-reading.int`: "no cartão da rodada da Fase 4, a frase nomeia a mesma rodada de referência do bloco de comparação", "depois de um retorno e de um novo avanço, a frase nomeia a referência da passagem" |
| Orientação e frase não aparecem para o Avaliador ☑ | `phase-4-reading.int`: "o Avaliador não vê comparação, rodada de referência, Concordância nem Qualidade" (estendido com `RoundChangesNote` e a frase); `[roundId]/page.int`: "o avaliador na primeira rodada da Fase 4 não recebe o que mudou nem a frase" |
| Testes, suíte verde ☑ | 89 arquivos, 1326 testes |

---

## 5. Fronteira com as fatias vizinhas

**#84 (rodada da Fase 4 ao lado da referência, fechada)**: `reference-comparison*` e
`ReferenceComparisonPanel` **não mudam**. O texto dentro da faixa aponta para o bloco, sem citar o
título. O `JUDGMENT_WORDS` de `phase-4-reading.int.test.ts` pode ser reusado nas provas de página desta
fatia.

**#86 (voltar da Fase 4 para a Fase 3, aberta)**: nada desta fatia cria o retorno. O caso "retorno
tratado como troca de fase comum" já está coberto em `round-changes.unit.test.ts` por dado puro, e a D5
deixa o comportamento depois do retorno decidido (a rodada da Fase 4 continua com o texto da Fase 4).
Se a #86 achar que precisa de frase própria para a primeira rodada da Fase 3 depois do retorno, a PRD
diz que não ("como qualquer outra").

**#76 / #75 (orientação e o que mudou da Fase 3, fechadas)**: textos intactos; o formato de
`ReadingGuidance` ganha `phase` (D1) e as varreduras são reescopadas (D4, D7).

**#78 (CSV)**: nem a orientação nem a frase viram coluna.

---

## 6. Gotchas herdados

- **TDD do plano: ver o vermelho.** Passo marcado (TDD) = teste escrito e rodado **falhando** antes do
  código. Asserção negativa sobre prop nova ("o Avaliador não recebe…") passa antes do código e não
  conta como vermelho; dizer isso no handoff.
- **Grep do texto antigo nos testes** antes de mudar a forma de `ReadingGuidance`: `rg "kind: '" app/`
  acha todos os `toEqual` que precisam de `phase`.
- **Cena no banco quebra teste de integração**: se a conferência no navegador deixar notas no banco
  local, `scores` precisa ficar vazia antes de `npm test`.
- **Vitest com `[id]` no caminho**: filtrar por substring (`npx vitest run reading-guidance`), sem
  colchetes.
- **Sem comentários no código** e **sem Prettier** (`npx prettier` reformata o arquivo inteiro).
- **Âncora única em edição por script**: títulos de teste se repetem entre `describe`s; conferir
  `count == 1` antes de substituir.
- **Texto em prop some das asserções**: `title`/`help` de `Section` não aparecem em `textOf`; usar
  `markupTextOf(createElement(ReadingGuidanceNote, props))`, como a #76.
- **ICR da cena**: conferir o `alpha`/`reason` pela prop do `AgreementPanel` antes de afirmar sobre a
  orientação, para o teste não passar pelo motivo errado. Em `phase4Scene`, as notas padrão (Carla
  invertida) devem dar abaixo da faixa; `absent: ['carla']` dá Ana e Bruno idênticos com variação
  (dentro); `absent: ['bruno', 'carla']` dá `few_evaluators`.
- **Captura do preview**: se o screenshot sair preto, provar por DOM (`get_page_text`, `read_page`).
- **Commit da última Parte leva `Closes #85`**; a Parte 1 leva `Refs #85`.

---

## 7. Fora de escopo

- A orientação na revisão da rodada (`[roundId]`) e na visão geral; continua só na tela de rodadas,
  como na #76.
- Considerar a Qualidade, o ICR sem outliers, a amostra pequena ou a participação dos avaliadores na
  escolha do texto.
- Qualquer texto que compare o ICR da Fase 4 com o da referência ("subiu", "caiu"); a comparação é o
  bloco da #84, sem veredito.
- Verificar se itens e avaliadores da rodada da Fase 4 são de fato novos (história 16: "a frase é
  informação").
- Frase própria para a primeira rodada da Fase 3 depois de um retorno (#86; PRD: "como qualquer outra").
- Atualizar o verbete **Refinar** de `docs/CONTEXT.md` se a D3 sair como (a): o glossário descreve a
  ideia, não o texto da tela. Se o usuário quiser alinhar, é uma linha.

---

# Parte 1 — A orientação da Fase 4

**Objetivo:** a função recebe a fase da rodada, os três textos da Fase 4 existem e passam pelas
varreduras, e o Administrador lê a orientação certa na rodada em foco da Fase 4. Os textos da Fase 3
não mudam.

**Ler antes:** seções 1 a 7, `reading-guidance.ts`, `reading-guidance-labels.ts` e os dois unitários,
`reading-guidance-note.tsx`, `rounds/page.tsx` (linhas 150-330), e em `phase-4-reading.int.test.ts` a
`phase4Scene`, `basicScene`, `blockIndexOf` e os testes "o bloco aparece logo abaixo da Qualidade…" e
"o Avaliador não vê comparação…". Nos testes de página da #76 (`page.int.test.ts`, 1840-2050), os
helpers `guidanceOf`/`guidanceTextOf`.

**Antes de começar:** perguntar a D3 (palavra "generalizou" e "avaliadores novos") e a D5 (fase da
rodada num projeto já na Fase 4), juntas.

### 1.1 Tipo e escolha (TDD, unitário) — `reading-guidance.unit.test.ts`

Primeiro os testes, ver o vermelho (o typecheck e a aridade falham, `hasReadingGuidance(PHASE_4)` dá
falso), depois o código do D1.

- [ ] Os 5 testes de caso da #76 passam a chamar `readingGuidance(…, PHASE_3)` e esperam `phase: 3` no
      resultado.
- [ ] **Fase 4, os três casos:** abaixo, no corte, dentro e não calculável com `PHASE_4` → mesmo `kind`
      da Fase 3, com `phase: 4`.
- [ ] **A fase não muda o caso:** para uma lista de `Agreement` (abaixo, no corte, acima, os três
      motivos), `readingGuidance(a, 3).kind === readingGuidance(a, 4).kind`.
- [ ] **Não recebe Qualidade:** `parameters.toEqualTypeOf<[Agreement, GuidedPhase]>()` e
      `toHaveLength(2)`.
- [ ] **`hasReadingGuidance`:** `PHASE_1`/`PHASE_2` falso, `PHASE_3`/`PHASE_4` verdadeiro, `5` falso.
      Renomear o teste "só a Fase 3 mostra a orientação" para "as Fases 3 e 4 mostram a orientação".

### 1.2 Palavras (TDD, unitário) — `reading-guidance-labels.unit.test.ts`

Primeiro os testes, ver o vermelho (as exportações novas não existem), depois os textos do D3/D4.

- [ ] **Reescopar as listas (D4):** `phase3Texts()` (o que `allTexts()` junta hoje, com
      `guidanceText({ phase: 3, … })`) e `phase4Texts()` (os três textos da Fase 4, os três motivos, e
      `guidanceText({ phase: 4, … })`). Teste: `phase3Texts() ∪ phase4Texts()` contém toda string de
      `Object.values(labels)`.
- [ ] **Fase 3 não muda:** `guidanceText({ phase: 3, kind })` devolve exatamente as constantes de
      sempre, nos três casos e três motivos. Os testes de conteúdo da #76 continuam sem edição de texto.
- [ ] **Abaixo da faixa (Fase 4):** contém "abaixo da faixa de referência", "não estão aplicando o
      codebook da mesma forma" e a frase escolhida na D3 ("não se estendeu a essas pessoas ou a esses
      itens").
- [ ] **Não calculável (Fase 4):** um texto por motivo, contém `notCalculableReasonText(reason)` e "a
      comparação com a rodada de referência ainda não é possível"; **não** contém `QUALITY_LABEL`
      ("ainda não é uma leitura confiável" é da Fase 3).
- [ ] **Dentro da faixa (Fase 4):** contém "dentro da faixa de referência", "concordam entre si" e
      `é hora de olhar a ${QUALITY_LABEL} ao lado da rodada de referência`; **não** contém
      `scaleLabel('medium')`, "LLM", "prompt" (o ramo de refinamento da Fase 3 não se aplica).
- [ ] **Cada fase tem texto próprio:** para cada `kind` (e cada motivo), o texto da Fase 4 difere do da
      Fase 3; os seis textos de cada fase são distintos entre si.
- [ ] **"é hora de" só no dentro da faixa, nas duas fases;** os outros dois casos da Fase 4 dizem "ainda
      não" ou descrevem o que o ICR indica — ajustar a asserção à forma final do texto abaixo da faixa
      (ele não diz "ainda não"; basta `not.toContain('é hora de')`).
- [ ] **Varredura "retorno e veredito" (nova) sobre `phase4Texts()`** com a lista da D4.
- [ ] As três varreduras existentes (juízo, trava, Fase 4/avanço) passam a correr sobre
      `[...phase3Texts(), ...phase4Texts()]`.

### 1.3 A página — `rounds/page.tsx`

Uma linha: `readingGuidance(focusPair.all, focusRound.phase)`. O guard de `hasReadingGuidance` estreita
`focusRound.phase` para `GuidedPhase`. Nada mais muda no arquivo.

### 1.4 Testes de página

Em `page.int.test.ts` (Fase 3, existentes):

- [ ] As 6 asserções `{ guidance: { kind: … } }` ganham `phase: PHASE_3`. Nenhuma outra mudança.

Em `phase-4-reading.int.test.ts` (novos, TDD — o vermelho é a orientação ausente na Fase 4):

- [ ] **"numa rodada da Fase 4 abaixo da faixa, a orientação é a da Fase 4"**: `basicScene`, conferir
      pelo `AgreementPanel` que o `alpha` está abaixo de `AGREEMENT_BANDS.acceptable`;
      `guidanceOf(tree)` = `{ guidance: { phase: PHASE_4, kind: 'below_band' } }`; texto renderizado =
      `PHASE_4_BELOW_BAND_GUIDANCE`.
- [ ] **"… dentro da faixa …"**: `absent: ['carla']`, texto = `PHASE_4_WITHIN_BAND_GUIDANCE`.
- [ ] **"… com um avaliador só, a orientação diz por que não há ICR e que a comparação ainda não é
      possível"**: `absent: ['bruno', 'carla']`, `phase4NotCalculableGuidance('few_evaluators')`.
- [ ] **"nenhum texto renderizado da Fase 4 fala em voltar, refinar ou veredito"**: nos três casos, o
      `markupTextOf` da orientação passa pela lista da D4 e pelo `JUDGMENT_WORDS` do arquivo; e não
      contém nenhum dos textos da Fase 3.
- [ ] **"a orientação fica entre a Concordância e a Qualidade, e a comparação continua depois"**:
      `blockIndexOf` de `AgreementPanel` < `ReadingGuidanceNote` < `QualityPanel` <
      `ReferenceComparisonPanel`.
- [ ] **"num projeto na Fase 4 sem rodada da Fase 4, a rodada em foco da Fase 3 mostra o texto da Fase
      3"** (fixa a D5, na forma confirmada): `phase4Scene` só com a rodada 1 da Fase 3 fechada;
      `guidance.phase === PHASE_3`.
- [ ] **Avaliador:** estender "o Avaliador não vê comparação, rodada de referência, Concordância nem
      Qualidade" com `findElement(tree, ReadingGuidanceNote)` nulo e nenhum dos textos da Fase 4 no
      texto da árvore. (Asserção negativa: passa antes do código; dizer no handoff.)

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Diff de `reading-guidance-labels.ts` sem
linhas removidas nas constantes da Fase 3.

Commit sugerido:

```
feat(rodadas): orientação de leitura da fase 4

Refs #85
```

### O que a Parte 2 herda

**Respostas:** D3 = (a) "não se estendeu a essas pessoas ou a esses itens", e "os avaliadores" (sem
"novos"). D5 = (a), a fase da rodada decide.

**Nomes finais** (`reading-guidance.ts`): `GuidedPhase`, `ReadingGuidance = { phase } & (…)`,
`readingGuidance(agreement, phase)`, `hasReadingGuidance(phase): phase is GuidedPhase`.
(`reading-guidance-labels.ts`): `PHASE_4_BELOW_BAND_GUIDANCE`, `PHASE_4_WITHIN_BAND_GUIDANCE`,
`phase4NotCalculableGuidance(reason)`; `guidanceText` despacha por um `GUIDANCE_TEXTS` interno
(`Record<GuidedPhase, { belowBand, withinBand, notCalculable }>`), não exportado.

**Textos definitivos:**
- abaixo: "O ICR desta rodada ficou abaixo da faixa de referência: os avaliadores não estão aplicando o
  codebook da mesma forma, o que indica que ele não se estendeu a essas pessoas ou a esses itens."
- dentro: "O ICR desta rodada está dentro da faixa de referência: os avaliadores concordam entre si, e
  é hora de olhar a Qualidade ao lado da rodada de referência."
- não calculável: "Não há ICR nesta rodada: {motivo}. Sem esse número não se sabe se os avaliadores
  aplicam o codebook da mesma forma, e por isso a comparação com a rodada de referência ainda não é
  possível."

**Suíte:** 89 arquivos, 1315 testes verdes; lint e typecheck verdes. Diff de
`reading-guidance-labels.ts` só remove a linha do import de tipo e os três `return` do `guidanceText`.

**O que divergiu:**
- O teste existente da #84 "o bloco aparece logo abaixo da Qualidade…" exigia `quality === agreement +
  1`; com a orientação no meio, quebrou. Ganhou `guidance === agreement + 1` e `quality === guidance +
  1`, e com isso virou a prova da ordem Concordância < orientação < Qualidade < comparação; o teste
  separado "a orientação fica entre…" do 1.4 não foi criado (seria repetido).
- Vermelho visto: unitários de escolha (8 falhas) e de palavras (12 falhas) antes do código; nos de
  página, 5 falhas com `hasReadingGuidance` revertido só para a Fase 3. Passaram antes do código, como
  esperado: o teste da D5 (a rodada da Fase 3 já mostrava o texto da Fase 3) e a extensão do teste do
  Avaliador (asserção negativa).
- Varredura de página da Fase 4 usa `RETURN_AND_VERDICT_WORDS` (cópia local da lista da D4) mais o
  `JUDGMENT_WORDS` do arquivo; `PHASE_3_GUIDANCE_TEXTS` e `PHASE_4_GUIDANCE_TEXTS` estão em
  `phase-4-reading.int.test.ts` e podem ser reusados na Parte 2.

---

# Parte 2 — O "o que mudou" da entrada na Fase 4, e a varredura

**Objetivo:** a primeira rodada da Fase 4 diz, na revisão e no cartão da lista, que codebook e prompt
são os da rodada de referência (com o número) e que o que deve mudar são itens e avaliadores. O
Avaliador não vê. Conferir tudo no navegador e fechar a issue.

**Ler antes:** seções 1 a 7, o "o que herda" da Parte 1, `round-changes.ts`, `round-changes-labels.ts`,
`round-changes-note.tsx`, `round-list.tsx`, `[roundId]/page.tsx` (`changesOf`), os dois unitários do
"o que mudou", e em `[roundId]/page.int.test.ts` os helpers `roundWith`/`nextRoundWith`/`changesTextOf`
e os testes "na primeira rodada da Fase 3, com as mesmas versões, aparece a frase…" e "o avaliador na
mesma rodada não recebe a entrada, nem o texto do bloco, nem a frase".

### 2.1 `entersPhase4` (TDD, unitário) — `round-changes.unit.test.ts`

Primeiro os testes, ver o vermelho, depois o campo do D6.

- [ ] **"a primeira rodada da Fase 4 entra na Fase 4, com as mesmas versões"**:
      `roundChanges(versions(4, 4, 3, 2), versions(3, 3, 3, 2))` → `entersPhase4: true`,
      `entersPhase3: false`, `phase` de 3 para 4, codebook e prompt sem mudança,
      `codebookAndPrompt: false`.
- [ ] **"a segunda rodada da Fase 4 não é mais a entrada"**: anterior da Fase 4 → `entersPhase4: false`.
- [ ] **Retorno**: o teste existente "o retorno da Fase 4 para a Fase 3…" ganha
      `expect(changes!.entersPhase4).toBe(false)`.
- [ ] **"retorno e novo avanço sem rodada da Fase 3 no meio não é entrada"**: anterior da Fase 4,
      rodada da Fase 4 → falso.
- [ ] **Chaves**: "não recebe nem devolve ICR ou Qualidade, só versões" passa a esperar `entersPhase4`
      na lista — e nada sobre itens ou avaliadores.

### 2.2 A frase (TDD, unitário) — `round-changes-labels.unit.test.ts`

- [ ] **"a frase da Fase 4 nomeia a rodada de referência e diz o que deve mudar"**:
      `entersPhase4Note(7)` contém "Primeira rodada da Fase 4", "os mesmos da rodada de referência",
      "a rodada 7", "itens de entrada" e "avaliadores".
- [ ] **Reescopar (D7):** `'fase 4'` sai de `JUDGEMENT_WORDS`; `allTexts()` ganha `entersPhase4Note(7)`;
      "nenhum texto menciona a Fase 4" vira "só a frase da entrada na Fase 4 menciona a Fase 4".
- [ ] **"a frase da Fase 4 não fala em voltar, veredito nem novidade"**: sem `voltar`, `retorn`,
      `aprova`, `replic`, `generaliz`, `novos`.

### 2.3 A nota — `round-changes-note.tsx`

Logo depois do bloco de `ENTERS_PHASE_3_NOTE`, no mesmo formato:

```tsx
{changes.entersPhase4 ? (
  <p className="m-0 text-[13px] text-ink">{entersPhase4Note(changes.previousRoundNumber)}</p>
) : null}
```

`noticeOf` não muda (D6).

### 2.4 Testes de página

Em `[roundId]/page.int.test.ts` (TDD — o vermelho é a frase ausente):

- [ ] **"na primeira rodada da Fase 4, a revisão diz que codebook e prompt são os da rodada de
      referência e que mudam itens e avaliadores"**: rodada 1 da Fase 3 fechada, rodada 2 da Fase 4
      com as mesmas versões (`nextRoundWith`, `phase: PHASE_4`); `changesTextOf` contém
      `Fase: 3 → 4`, "Codebook: v1, o mesmo", "Prompt: v1, o mesmo" e `entersPhase4Note(1)`; não
      contém `ENTERS_PHASE_3_NOTE` nem os avisos de codebook e prompt.
- [ ] **"a frase aparece mesmo com os mesmos itens e avaliadores da referência"**: se `nextRoundWith`
      já reaproveita o item e o avaliador da cena, este é o mesmo teste acima com o comentário no nome;
      senão, montar a cena com eles.
- [ ] **"a segunda rodada da Fase 4 não repete a frase"**.
- [ ] **Avaliador:** estender "o avaliador na mesma rodada não recebe…" (ou um irmão na Fase 4) com
      `findElement(tree, RoundChangesNote)` nulo e sem o texto de `entersPhase4Note`. (Asserção
      negativa; dizer no handoff.)

Em `phase-4-reading.int.test.ts`:

- [ ] **"no cartão da rodada da Fase 4, a frase nomeia a mesma rodada de referência do bloco de
      comparação"**: `basicScene`; no cartão da rodada 2, `RoundChangesNote` com
      `changes.entersPhase4 === true`, e o texto renderizado contém
      `entersPhase4Note(comparisonOf(tree).comparison.reference.roundNumber)`. É a prova do D6
      (`previousRoundNumber` = referência).
- [ ] **"depois de um retorno e de um novo avanço, a frase nomeia a referência da passagem"**: reusar a
      cena do teste homônimo da #84 (Fase 3, Fase 4, Fase 3, Fase 4); a primeira rodada da segunda
      passagem diz a rodada 3.

### 2.5 Verificação no navegador

Cena local (Supabase só do banco + `npm run dev`): projeto na Fase 4 com a rodada de referência
fechada e uma rodada da Fase 4 com avaliações. Conferir, como Administrador:

- [ ] a orientação da Fase 4 entre Concordância e Qualidade, nos três casos (mexer nas notas ou nos
      ausentes da cena);
- [ ] a frase no cartão da lista (modo compacto, junto da linha "Rodada de referência" da #84) e na
      revisão `[roundId]` — ver se a frase e a linha da referência no mesmo cartão não ficam
      repetitivas; se ficarem, anotar no handoff e perguntar antes de esconder a frase no `compact`;
- [ ] em 375px, sem rolagem horizontal;
- [ ] como Avaliador, nenhuma das duas coisas.

Depois, **limpar a cena** (`scores` vazia) antes de rodar `npm test` de novo.

### 2.6 Varredura dos ACs

Preencher a tabela da § 4 com o nome de cada teste, marcar os ACs e os testes da issue.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; navegador conferido; tabela da § 4 preenchida.

Commit sugerido:

```
feat(rodadas): o que mudou na entrada da fase 4

Closes #85
```

### Handoff

**Suíte:** 89 arquivos, 1326 testes verdes (11 novos); lint e typecheck verdes.

**Nome final:** `entersPhase4Note(referenceRoundNumber)` em `round-changes-labels.ts`; texto: "Primeira
rodada da Fase 4: o codebook e o prompt são os mesmos da rodada de referência, a rodada {N}. O que deve
mudar são os itens de entrada e os avaliadores."

**O que divergiu:**
- O Avaliador da revisão ganhou um teste irmão na Fase 4 ("o avaliador na primeira rodada da Fase 4 não
  recebe o que mudou nem a frase") em vez de estender o da Fase 3.
- "a frase aparece mesmo com os mesmos itens e avaliadores": `nextRoundWith` cria itens novos e não
  avalia, então a cena foi montada à mão (mesmo item da referência, lido de `responses`, e a mesma
  avaliadora nas duas rodadas).
- Vermelho visto: unitários (12 falhas) antes do código. Nos de página, com só `round-changes-note.tsx`
  revertido, 4 falhas por frase ausente (revisão: 2; cartão: 2). Passaram antes do código, como
  esperado: as asserções negativas do Avaliador (revisão e lista) e "a segunda rodada da Fase 4 não
  repete a frase".

**Navegador** (cena semeada e apagada; `scores` = 0 depois):
- orientação da Fase 4 entre Concordância e Qualidade nos três casos (abaixo, dentro, sem ICR), com os
  textos definitivos;
- frase na revisão `[roundId]` (abaixo de "Fase: 3 → 4") e no cartão compacto;
- 375 px (medido em iframe): os textos novos terminam em 317-336 px; o que passa de 375 é a barra de
  abas e a matriz, dívida anterior;
- Avaliador: nem orientação, nem "o que mudou", nem a frase, na lista e na revisão.
- No cartão, a frase ("…da rodada de referência, a rodada 1…") e a linha "Rodada de referência: rodada
  1 · …" da #84 repetem o número da referência, separadas pelo ICR e pela Qualidade. **A perguntar**
  antes de esconder a frase no `compact`.
- Achado fora do escopo: a ajuda da seção de Concordância (`rounds/page.tsx:255`) diz, na última
  rodada, "é com ela que se decide onde refinar o codebook antes da próxima rodada" — também numa rodada
  da Fase 4, onde não se refina (verbete **Refinar**).
