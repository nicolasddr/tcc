# Plano de implementação — Issue #76: "37 — Orientação pelo ICR nas rodadas da Fase 3"

Link: https://github.com/nicolasddr/tcc/issues/76
Pai: Épico 3 (#69) · Spec: `docs/prd/epico-3-validacao-do-prompt.md` (história 16; "Decisões de
Implementação › Orientação" e "› Telas"; "Further Notes › A ordem de leitura da Fase 3")
Blocked by: #73 (**fechada**, commits `eac416a`, `97850ff`, `7276de5`). A Qualidade da rodada já
existe (`quality.ts`, `QualityPanel`), `hasQuality(phase)` já existe, e a tela de rodadas já mostra
ICR e Qualidade da rodada em foco, um bloco embaixo do outro.

**A executar em 2 partes, uma por chat.** As seções 1 a 6 são o contexto comum. Quem pegar qualquer
Parte lê `AGENTS.md`, estas seis seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A escolha pura da orientação e as palavras, com os testes unitários | ☑ |
| 2 | A orientação na tela de rodadas, só para o Administrador e só na Fase 3, a prova de que nada some nem trava, e a varredura dos ACs | ☐ |

A Parte 2 depende da 1.

**Sem migration, sem ADR nova, sem deploy especial.** Tudo é derivado do `Agreement` que a página já
calcula. O verbete **Refinar** de `docs/CONTEXT.md` (linhas 117-127) já descreve a ordem de leitura
da Fase 3 e termina com "a ferramenta orienta essa leitura e nunca a impõe"; esta fatia não precisa
de termo novo. A regra de fundo é a **ADR 0004** (métrica não trava): nada desta fatia entra em
`roundBlockers`, em `canAdvance*` nem em botão nenhum.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| ICR | `lib/agreement.ts` (`Agreement` = `{ calculable: true, alpha, … } \| { calculable: false, reason, … }`, `NotCalculableReason`) | **a única entrada** da escolha do texto |
| Faixa de referência | `(tabs)/rounds/agreement-labels.ts` (`AGREEMENT_BANDS`, `agreementBand`, `BAND_REFERENCE`, `notCalculableMessage`) | a régua. A orientação usa `agreementBand`, sem repetir os cortes |
| Par com e sem outliers | `(tabs)/rounds/agreement-pair.ts` (`AgreementPair.all`) | a orientação lê o `all`, que é o resultado da rodada (D3) |
| Qualidade | `(tabs)/rounds/quality.ts` (`hasQuality(phase)` = `phase >= PHASE_3`), `quality-labels.ts` (`QUALITY_LABEL`), `quality-panel.tsx` | **não entra** na escolha. Só a palavra `QUALITY_LABEL` é reusada no texto |
| Escala | `(tabs)/evaluate/scale.ts` (`scaleLabel('medium')`, `scaleLabel('low')`) | "Médio" e "Baixo" no texto dentro da faixa, pela mesma fonte da escala |
| Fases | `pipeline/preconditions.ts` (`PHASE_2`, `PHASE_3`) | a condição de exibição (D5) |
| Tela de rodadas | `(tabs)/rounds/page.tsx` (ramo do Admin: `Section` "Concordância na rodada N" com `AgreementPanel` e `AgreementMatrixTable`, depois `Section` "Qualidade na rodada N" com `QualityPanel` e `QualityMatrixTable`; o ramo do Avaliador sai antes, com `EvaluatorRounds`) | **onde a orientação entra** (D6) |
| Molde de módulo puro + palavras | `round-changes.ts` / `round-changes-labels.ts` / `round-changes-labels.unit.test.ts` (varredura de palavras de juízo e de trava sobre `Object.values(labels)`) | o desenho que esta fatia copia |
| Testes de página | `(tabs)/rounds/page.int.test.ts` (`render`, `findElement`, `findSection`, `textOf`, `markupTextOf`, `newRoundOf`, `closeRoundOf`, `qualityPanelOf`, `qualityMatrixOf`, `roundWith(admin, n, { phase, status, shape })`, `qualityMatrixScene`) | onde entram as provas de página |

O que **falta** e esta fatia cria: a função pura que escolhe a orientação, o módulo de palavras dela,
o componente que a mostra, e a chamada na tela de rodadas.

---

## 2. A fatia por extenso

Numa rodada da **Fase 3**, o Administrador lê, entre o bloco de Concordância e o de Qualidade da
rodada em foco, um de três textos, escolhido **só** pelo ICR da rodada e pela faixa de referência:

| Caso | Quando | O que o texto diz |
|---|---|---|
| Abaixo da faixa | ICR calculável e `agreementBand(alpha) === 'questionable'` (abaixo de 0,667) | os avaliadores não estão aplicando o codebook da mesma forma; o caminho é refinar o codebook antes de olhar a Qualidade |
| Não calculável | `calculable === false` | por que não há número (o motivo, curto) e que a Qualidade ainda não é uma leitura confiável |
| Dentro da faixa | ICR calculável e banda `acceptable` ou `good` (0,667 ou mais) | os avaliadores concordam e é hora de olhar a Qualidade; notas concentradas em Médio e Baixo indicam que a LLM não está seguindo o codebook, e o refinamento pode ser no prompt, no codebook ou nos dois; mexer no codebook para ajudar a LLM também muda o que os avaliadores leem |

Rascunho dos textos (os definitivos saem na Parte 1 e moram no módulo de palavras):

- **Abaixo da faixa:** "O ICR desta rodada ficou abaixo da faixa de referência: os avaliadores não
  estão aplicando o codebook da mesma forma. O caminho é refinar o codebook antes de olhar a
  Qualidade, porque, enquanto eles não concordam entre si, a distribuição das notas ainda não diz se
  a LLM segue o codebook."
- **Não calculável:** "Não há ICR nesta rodada: {motivo}. Sem esse número não se sabe se os
  avaliadores aplicam o codebook da mesma forma, e por isso a Qualidade ainda não é uma leitura
  confiável." Motivos:
  - `few_evaluators` → "menos de dois avaliadores enviaram avaliação";
  - `no_shared_units` → "nenhuma resposta-célula foi avaliada por dois avaliadores";
  - `no_variation` → "todas as notas caíram no mesmo ponto da escala, e sem variação o coeficiente
    fica indefinido".
- **Dentro da faixa:** "O ICR desta rodada está dentro da faixa de referência: os avaliadores
  concordam, e é hora de olhar a Qualidade. Notas concentradas em Médio e Baixo indicam que a LLM
  não está seguindo o codebook, e o refinamento pode ser no prompt, no codebook ou nos dois. Mexer
  no codebook para ajudar a LLM também muda o que os avaliadores leem."

O que o texto **nunca** faz: menciona a Fase 4, diz que é possível avançar, qualifica a Qualidade
("boa", "suficiente", "basta"), ou esconde/desabilita qualquer coisa. A Qualidade continua visível,
inteira, nos três casos.

### Quem vê

| | Administrador | Avaliador |
|---|---|---|
| Rodada em foco da Fase 3 | sim | **não** (o ramo do Avaliador de `rounds/page.tsx` retorna antes e nunca calcula ICR) |
| Rodada em foco da Fase 2 | não | não |

---

## 3. Decisões desta fatia

**D1. O módulo puro: `(tabs)/rounds/reading-guidance.ts`.**

```ts
export type ReadingGuidance =
  | { kind: 'below_band' }
  | { kind: 'not_calculable'; reason: NotCalculableReason }
  | { kind: 'within_band' }

export function readingGuidance(agreement: Agreement): ReadingGuidance

export function hasReadingGuidance(phase: number): boolean
```

- `readingGuidance` recebe **só** o `Agreement` e decide por `calculable` e `agreementBand(alpha)`.
  Não repete os cortes: se `AGREEMENT_BANDS` mudar, a orientação acompanha.
- `acceptable` e `good` são ambos "dentro da faixa". A faixa só separa abaixo de 0,667 do resto
  quando o assunto é "os avaliadores concordam o bastante para ler a Qualidade"; distinguir
  aceitável de boa aqui seria dar à orientação uma gradação que a PRD não pede.
- `not_calculable` carrega o `reason` para o texto dizer por que não há número.

**D2. A função não recebe Qualidade, e isso é provado de três jeitos.** A PRD pede que a
impossibilidade de a Qualidade virar veredito seja **estrutural**:

1. **Tipo:** `expectTypeOf(readingGuidance).parameters.toEqualTypeOf<[Agreement]>()` (o
   `expectTypeOf` do Vitest; `npm run typecheck` pega a divergência, porque os testes estão no
   `include` do `tsconfig.json`). É o primeiro uso de `expectTypeOf` no repo.
2. **Aridade:** `expect(readingGuidance).toHaveLength(1)`.
3. **Comportamento, na página (Parte 2):** duas rodadas da Fase 3 com Qualidade oposta (todas as
   notas em Alto numa, todas em Baixo na outra) caem no mesmo caso (`no_variation`) e mostram
   **exatamente o mesmo texto**. É a prova observável de que a distribuição não chega ao texto.

`reading-guidance.ts` não importa `./quality` nem `./quality-labels`.

**D3. O ICR que decide é o `all` do par.** `agreementPair(...).all` é "o resultado da rodada"
(`OUTLIER_PAIR_SUMMARY`), e a Qualidade que a tela mostra primeiro também é a com todos. Se o
Administrador marcou outlier e o valor sem os marcados cai noutra banda, a orientação **não muda**:
a exclusão existe para mostrar o quanto move o número, não para trocar a leitura da rodada. O teste
de página fixa isso (D9).

**D4. As palavras moram em `(tabs)/rounds/reading-guidance-labels.ts`**, no desenho de
`round-changes-labels.ts`:

- `GUIDANCE_HEADING` (sugestão: "Por onde ler esta rodada");
- `BELOW_BAND_GUIDANCE`, `WITHIN_BAND_GUIDANCE`;
- `notCalculableGuidance(reason)`, com o motivo curto de cada `NotCalculableReason`;
- `guidanceText(guidance: ReadingGuidance): string`, que despacha pelos três casos.

Reuso de palavras, para que o texto e a tela nunca divirjam: `QUALITY_LABEL` ("Qualidade") de
`quality-labels.ts`; `scaleLabel('medium')`/`scaleLabel('low')` de `evaluate/scale.ts`. **Não** usar
`bandLabel` ("questionável"/"boa") no texto: "boa" é palavra de juízo na varredura, e o
`AgreementPanel` logo acima já mostra o selo da banda.

Os motivos do não calculável são **frases curtas próprias**, e não `notCalculableMessage(reason)`:
o `AgreementPanel` já mostra essa mensagem longa no mesmo bloco de cima, e repeti-la inteira a
alguns centímetros de distância é ruído. O motivo curto tem de ser coerente com a longa (há teste).

**D5. Só a Fase 3 mostra: `hasReadingGuidance(phase) = phase === PHASE_3`.** Não é
`hasQuality(phase)` (`>= PHASE_3`): na Fase 4 codebook e prompt estão congelados, e um texto que
manda refinar não se aplica. Quando a Fase 4 existir, ela decide o seu próprio texto; até lá a
igualdade deixa isso explícito. A condição é pela **fase da rodada**, não do projeto: um projeto que
acabou de avançar para a Fase 3 e ainda tem como rodada em foco a última da Fase 2 **não** mostra a
orientação (há teste).

**D6. Onde a orientação aparece: na tela de rodadas (`rounds/page.tsx`), na rodada em foco, entre o
bloco de Concordância e o de Qualidade.** É o único lugar onde o ICR com a faixa e a Qualidade da
rodada estão lado a lado, e a orientação é exatamente a ponte entre um e outro ("olhe o ICR primeiro,
depois a Qualidade").

> **Divergência declarada da PRD, a confirmar antes da Parte 2.** A PRD ("Telas") diz "a tela da
> rodada ganha as mudanças em relação à anterior e a orientação", e o plano da #75 (§ 5) supôs a
> orientação em `[roundId]/page.tsx`, abaixo do `RoundChangesNote`. Este plano **não** a põe lá,
> por dois motivos:
>
> 1. `[roundId]` tem uma regra estrutural herdada da #64: "esta tela não mostra coeficiente para
>    ninguém, nem para o Administrador" — a página não carrega observação e não importa
>    `lib/agreement`, e o teste "a revisão não fala de coeficiente, nem para o Administrador"
>    varre "ICR", "Krippendorff", "Alpha" e "Concordância" no texto. Um texto de orientação pelo
>    ICR ali quebra essa regra e esse teste.
> 2. `[roundId]` não mostra a Qualidade. Dizer "é hora de olhar a Qualidade" numa tela onde ela não
>    está manda o Administrador para outro lugar.
>
> Se a intenção for mesmo `[roundId]`, a Parte 2 muda de alvo: carregar `loadRoundObservations`
> + `loadRoundOutliers` só para o Admin na Fase 3, calcular `agreementPair(...).all`, e **reescrever**
> o teste da #64 para permitir o texto da orientação. É mais caro e desfaz uma decisão registrada.

A visão geral (`(tabs)/page.tsx`, `Section` "Qualidade na rodada N") também mostra a Qualidade da
rodada em foco, mas não o ICR da rodada (só a série). Fica **fora** desta fatia (§ 7).

**D7. O componente: `(tabs)/rounds/reading-guidance-note.tsx`**, servidor,
`ReadingGuidanceNote({ guidance }: { guidance: ReadingGuidance })`.

- Cabeçalho curto (`GUIDANCE_HEADING`, `text-[13px] font-semibold text-ink`) e o texto de
  `guidanceText(guidance)` em parágrafo `text-[13px] text-ink`.
- **Tom neutro e igual nos três casos**: `Card tone="subtle" padding="sm"`, e **não** `Alert
  tone="notice"` (que é amarelo) nem cor pela banda. A cor da banda já está no selo do
  `AgreementPanel`; pintar a orientação faria dela um veredito visual.
- **Sem botão, sem link, sem `disabled`, sem `role="alert"`.** É texto.
- Recebe `ReadingGuidance` já calculado. Quem chama faz `readingGuidance(pair.all)` e só renderiza
  quando `hasReadingGuidance(focusRound.phase)`.

**D8. A chamada em `rounds/page.tsx`.** Nenhuma consulta nova: `agreement.get(focusRound.id)` já
existe. Entre as duas `Section`s da rodada em foco:

```tsx
{focusRound && hasReadingGuidance(focusRound.phase) ? (
  <ReadingGuidanceNote guidance={readingGuidance(focusPair.all)} />
) : null}
```

(`focusPair` = o mesmo `agreement.get(focusRound.id) ?? agreementPair([], EMPTY_SET)` que alimenta o
`AgreementPanel`, extraído para uma constante para que painel e orientação leiam **o mesmo objeto**.)

Com a rodada em foco **aberta** a orientação aparece também, como o `AgreementPanel` aparece desde a
primeira avaliação: com poucas avaliações cai quase sempre em "não calculável", e isso é verdade.
Nenhum texto fala de fechar a rodada.

Se precisar de uma `Section` própria para o espaçamento, o `title` é o `GUIDANCE_HEADING` e o
componente perde o cabeçalho interno. Decidir no navegador; o teste acha o componente por tipo, não
por título.

**D9. Nada some, nada trava, por construção.** `readingGuidance` não é entrada de `roundBlockers`,
de `NewRound`, de `CloseRound`, de `GenerateResponses` nem de `phase2Blockers`/`canAdvanceFromPhase2`,
e nenhuma dessas assinaturas muda. `QualityPanel` e `QualityMatrixTable` continuam renderizados
incondicionalmente dentro do seu `if (focusQuality)`, que **não** olha a orientação.

---

## 4. Critérios de aceite × onde são provados

| AC da issue | Parte | Prova |
|---|---|---|
| Rodadas da Fase 3 mostram a orientação para o Administrador; rodadas da Fase 2 não mostram | 1, 2 | unitário de `hasReadingGuidance` + página (Fase 3 com `ReadingGuidanceNote`; Fase 2 sem; projeto na Fase 3 com rodada em foco da Fase 2 sem) |
| O texto é escolhido só pelo ICR e pela faixa de referência | 1, 2 | unitário (casos nos limites da faixa, lidos de `AGREEMENT_BANDS`) + página (D3: outlier não muda o texto) |
| A função que escolhe o texto não recebe Qualidade | 1, 2 | `expectTypeOf(...).parameters` + aridade 1 + página (Qualidade toda em Alto × toda em Baixo → mesmo texto) |
| Os três textos seguem o conteúdo descrito acima | 1 | unitário das palavras (cada texto contém as ideias obrigatórias; o dentro da faixa traz "Médio", "Baixo", "prompt", "codebook" e o lembrete do que os avaliadores leem) |
| Nenhum texto menciona a Fase 4 ou fala em avançar | 1, 2 | varredura das palavras (todas as exportações de texto + `guidanceText` dos três casos com os três motivos) + página (texto renderizado nos três casos) |
| A orientação não esconde a Qualidade nem desabilita nada | 2 | página: nos três casos `QualityPanel` e `QualityMatrixTable` presentes com as mesmas props; props de `NewRound`/`CloseRound` iguais às de uma cena Fase 2 equivalente; componente sem `button`/`a`/`disabled` no markup |
| O Avaliador não vê a orientação | 2 | página: Avaliador de uma rodada da Fase 3 com ICR calculado não recebe `ReadingGuidanceNote` nem nenhum dos textos |
| Testes: unitário dos três textos, unitário sem Fase 4, página Admin × Avaliador, suíte verde | 1, 2 | — |

---

## 5. Fronteira com as fatias vizinhas

**#74 (Qualidade por célula e série, aberta)**: `quality-series.ts`, `QualitySeriesList` e
`QualityMatrixTable` **não mudam**. A orientação não entra na série de Qualidade nem na matriz.

**#75 (o que mudou, fechada)**: `RoundChangesNote` fica onde está (`[roundId]` e cards do
`RoundList`). A orientação **não** vai para o `[roundId]` (D6), então a ordem "primeiro o que mudou,
depois como ler" que a #75 previu não se aplica. Nenhum texto daqui repete "o que mudou".

**#77 (avanço da Fase 3)**: não toca `pipeline/phase-2-checklist.tsx`, `canAdvance*` nem as
pré-condições. O painel de avanço da Fase 3 **não** mostra a orientação: ela é leitura de rodada,
não de fase.

**#78 (CSV)**: a orientação não vira coluna.

**#63/#65 (ICR, faixa, outliers)**: `agreement-labels.ts` só é **importado** (`agreementBand`,
`NotCalculableReason`), não muda. `AgreementPanel` não muda.

---

## 6. Gotchas herdados

- **Cena no banco quebra teste de integração**: se a conferência no navegador deixar notas no banco
  local, `scores` precisa ficar vazia antes de `npm test`.
- **Sem comentários no código** e **sem Prettier** (`npx prettier` reformata o arquivo inteiro).
- **Texto em prop some das asserções**: `title`, `text` de `InfoTooltip` e o `help` da `Section` não
  aparecem em `textOf`; ler a prop via `findElement`, ou usar `markupTextOf`/`renderToStaticMarkup`.
- **`cx` não resolve conflito Tailwind**: className extra perde para a variante conforme a ordem do
  CSS; usar sufixo `!` se precisar sobrescrever o `Card`.
- **ICR dentro da faixa em teste de página** precisa de dado com variação e concordância alta (dois
  avaliadores iguais em várias células com notas diferentes entre células). Montar uma vez num
  helper (`guidanceScene(admin, 'within' | 'below' | 'high' | 'low')`) e conferir o `alpha` pela
  prop do `AgreementPanel` antes de afirmar sobre a orientação, para o teste não passar pelo motivo
  errado.
- **Captura do preview**: se o screenshot sair preto, provar por DOM (`get_page_text`, `read_page`) e
  `resize_window` para 375px. 375px só vale medido em iframe.

---

## 7. Fora de escopo

- A orientação em `[roundId]` (D6, a confirmar).
- A orientação na visão geral (`(tabs)/page.tsx`, bloco "Qualidade na rodada N"). Seria só chamar o
  mesmo componente, mas a visão geral não mostra o ICR da rodada em foco, e o texto apontaria para
  um número que não está na tela. Fatia futura barata, se pedida.
- A orientação nos cards do `RoundList` para rodadas antigas da Fase 3.
- Considerar amostra pequena (`smallSampleWarning`) na escolha do texto. O aviso de amostra continua
  no `AgreementPanel`, logo acima; a função recebe só o `Agreement`.
- Considerar o ICR sem outliers na escolha (D3).
- Qualquer texto para a Fase 4.

---

# Parte 1 — A escolha pura da orientação e as palavras

**Objetivo:** a função que escolhe o caso e o módulo de palavras existem, testados e varridos, sem
tocar em tela.

**Ler antes:** seções 1 a 7, `lib/agreement.ts` (`Agreement`, `NotCalculableReason`),
`agreement-labels.ts` (`AGREEMENT_BANDS`, `agreementBand`, `notCalculableMessage`),
`quality-labels.ts`, `evaluate/scale.ts`, `round-changes-labels.ts` e
`round-changes-labels.unit.test.ts` (o desenho da varredura).

### 1.1 `(tabs)/rounds/reading-guidance.ts`

`ReadingGuidance`, `readingGuidance`, `hasReadingGuidance` (D1, D5). Importa `agreementBand` de
`./agreement-labels`, os tipos de `@/lib/agreement` e `PHASE_3` de `../../pipeline/preconditions`.
**Não** importa nada de Qualidade.

### 1.2 `(tabs)/rounds/reading-guidance-labels.ts`

As constantes e funções de texto do D4. `WITHIN_BAND_GUIDANCE` monta "Médio" e "Baixo" com
`scaleLabel` e "Qualidade" com `QUALITY_LABEL`.

### 1.3 Testes da Parte 1

`reading-guidance.unit.test.ts`:

- [ ] **Abaixo da faixa**: `alpha` logo abaixo de `AGREEMENT_BANDS.acceptable` → `below_band`.
- [ ] **No limite**: `alpha === AGREEMENT_BANDS.acceptable` → `within_band` (o corte é inclusivo,
      como em `agreementBand`).
- [ ] **Dentro da faixa, aceitável e boa**: um valor entre os cortes e um acima de
      `AGREEMENT_BANDS.good` → ambos `within_band`.
- [ ] **Negativo**: `alpha` negativo (discordância sistemática) → `below_band`.
- [ ] **Não calculável**: cada um dos três `NotCalculableReason` → `not_calculable` com o mesmo
      `reason`.
- [ ] **Não recebe Qualidade** (D2): `expectTypeOf(readingGuidance).parameters.toEqualTypeOf<[Agreement]>()`
      e `expect(readingGuidance).toHaveLength(1)`.
- [ ] **Units e raters não decidem**: dois `Agreement` com o mesmo `alpha` e `units`/`raters`
      diferentes → mesmo caso.
- [ ] **`hasReadingGuidance`**: `PHASE_2` falso, `PHASE_3` verdadeiro, `4` falso, `PHASE_1` falso.

`reading-guidance-labels.unit.test.ts`:

- [ ] `guidanceText` devolve um texto diferente para cada um dos três casos.
- [ ] **Abaixo da faixa** fala em refinar o codebook e em fazê-lo antes de olhar a Qualidade.
- [ ] **Não calculável** diz o motivo (um texto diferente por `reason`) e que a Qualidade ainda não
      é uma leitura confiável.
- [ ] **Coerência dos motivos curtos com os longos**: o motivo curto de cada `reason` fala da mesma
      coisa que `notCalculableMessage(reason)` (ex.: "dois avaliadores" em `few_evaluators`,
      "mesmo ponto da escala" em `no_variation`).
- [ ] **Dentro da faixa** diz que os avaliadores concordam, manda olhar a Qualidade, contém
      `scaleLabel('medium')` e `scaleLabel('low')`, diz que a LLM não está seguindo o codebook,
      cita prompt e codebook como alvos do refinamento, e lembra que mexer no codebook muda o que os
      avaliadores leem.
- [ ] **Só o dentro da faixa** manda olhar a Qualidade agora; os outros dois dizem que ainda não.
- [ ] **Varredura de Fase 4 e de avanço**: nenhum texto (constantes de `Object.values(labels)` +
      `guidanceText` dos três casos com os três motivos) contém "Fase 4", "fase 4", "avançar",
      "avance", "próxima fase".
- [ ] **Varredura de juízo**: nenhum texto contém "melhor", "pior", "boa", "ruim", "aprovad",
      "suficiente", "basta", "pronto", "questionável".
- [ ] **Varredura de trava**: nenhum texto contém "bloque", "trava", "impede", "não pode",
      "desabilit".

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Nenhum arquivo existente mudou.

Commit sugerido: `feat(rodadas): escolhe a orientação da fase 3 pelo ICR`.

### O que a Parte 2 herda

- **Nomes finais, como no D1:** `reading-guidance.ts` exporta `ReadingGuidance`,
  `readingGuidance(agreement)` e `hasReadingGuidance(phase)` (`phase === PHASE_3`). Não importa nada
  de Qualidade.
- **Palavras (`reading-guidance-labels.ts`), como no D4, com um acréscimo:** `GUIDANCE_HEADING`
  ("Por onde ler esta rodada"), `BELOW_BAND_GUIDANCE`, `WITHIN_BAND_GUIDANCE`,
  `notCalculableGuidance(reason)`, `guidanceText(guidance)` e **`notCalculableReasonText(reason)`**
  (o motivo curto exportado à parte, para o teste de coerência com `notCalculableMessage`).
- **Textos definitivos:** os rascunhos da § 2, sem mudança de palavra. "Qualidade" vem de
  `QUALITY_LABEL`; "Médio" e "Baixo" de `scaleLabel`.
- **Testes:** `reading-guidance.unit.test.ts` (8) e `reading-guidance-labels.unit.test.ts` (11).
  Suíte: 79 arquivos, 1084 testes verdes; lint e typecheck verdes. Primeiro `expectTypeOf` do repo.
- **Para a página:** o texto renderizado de cada caso é `guidanceText(guidance)`; nas asserções
  da Parte 2, comparar com `BELOW_BAND_GUIDANCE`, `WITHIN_BAND_GUIDANCE` e
  `notCalculableGuidance(reason)`.

---

# Parte 2 — A orientação na tela de rodadas, e a varredura

**Objetivo:** o Administrador lê a orientação na rodada em foco da Fase 3; o Avaliador não; a Fase 2
não; a Qualidade continua inteira e nada trava. Fechar a issue.

**Ler antes:** seções 1 a 7, o "o que herda" da Parte 1, `rounds/page.tsx`, `agreement-panel.tsx`,
`quality-panel.tsx`, `app/components/ui/card.tsx`, e em `rounds/page.int.test.ts` os helpers
`render`/`findElement`/`findSection`/`markupTextOf`/`newRoundOf`/`closeRoundOf`/`qualityPanelOf`, a
cena `qualityMatrixScene` e os testes "numa rodada da Fase 2, a matriz de Qualidade não existe…" e
"a área de rodadas do avaliador não fala de coeficiente nem de Qualidade".

**Antes de começar:** confirmar com o usuário o D6 (tela de rodadas, e não `[roundId]`).

### 2.1 `(tabs)/rounds/reading-guidance-note.tsx`

`ReadingGuidanceNote({ guidance })` (D7).

### 2.2 `rounds/page.tsx`

- Extrair `focusPair` (o par que já vai para o `AgreementPanel`) para uma constante.
- Entre a `Section` de Concordância e a de Qualidade, renderizar `ReadingGuidanceNote` quando
  `focusRound && hasReadingGuidance(focusRound.phase)` (D8).
- Nenhuma consulta nova, nenhuma prop nova em `NewRound`, `CloseRound`, `GenerateResponses`,
  `AgreementPanel`, `QualityPanel`, `QualityMatrixTable`, `RoundList`.

### 2.3 Testes da Parte 2 (`rounds/page.int.test.ts`)

Um helper de cena (§ 6) que monta uma rodada fechada com dois avaliadores e notas que dão cada caso,
e um `guidanceOf(tree)` que devolve as props de `ReadingGuidanceNote` (ou `null`).

- [ ] **Fase 3, abaixo da faixa**: Admin vê `ReadingGuidanceNote` com `below_band`, e o texto
      renderizado é `BELOW_BAND_GUIDANCE`. Conferir antes o `alpha` pela prop do `AgreementPanel`.
- [ ] **Fase 3, dentro da faixa**: `within_band`, texto `WITHIN_BAND_GUIDANCE`.
- [ ] **Fase 3, não calculável**: um avaliador só → `not_calculable` com `few_evaluators`.
- [ ] **Qualidade não decide** (D2): rodada A com todas as notas em Alto, rodada B com todas em
      Baixo (projetos separados) → as duas mostram exatamente o mesmo texto, e os `QualityPanel`
      mostram distribuições opostas.
- [ ] **Outlier não muda o caso** (D3): cena em que o `all` está abaixo da faixa e o sem os marcados
      estaria dentro → a orientação é `below_band`.
- [ ] **Fase 2 não mostra**: rodada em foco da Fase 2 com ICR calculável → sem `ReadingGuidanceNote`,
      e nenhum dos três textos no markup.
- [ ] **Fase do projeto não decide**: projeto na Fase 3 cuja rodada em foco ainda é a última da
      Fase 2 → sem orientação.
- [ ] **Rodada aberta da Fase 3** mostra a orientação (com poucas avaliações, `not_calculable`).
- [ ] **A Qualidade continua inteira nos três casos**: `QualityPanel` e `QualityMatrixTable`
      presentes, com as props iguais às de uma renderização em que a orientação não existisse
      (comparar com as props calculadas direto de `qualityPair`).
- [ ] **Nada trava**: nos três casos, `newRoundOf`/`closeRoundOf` com as mesmas props de uma cena
      Fase 2 com o mesmo estado; o markup de `ReadingGuidanceNote` não contém `<button`, `<a `,
      `disabled` nem `role="alert"`.
- [ ] **Ordem na tela**: no markup, a orientação vem depois do bloco de Concordância e antes do de
      Qualidade.
- [ ] **Avaliador não vê**: Avaliador de uma rodada da Fase 3 com ICR dentro da faixa → sem
      `ReadingGuidanceNote`, e nenhum dos textos nem o `GUIDANCE_HEADING` no markup (estender o
      teste "a área de rodadas do avaliador não fala de coeficiente nem de Qualidade").
- [ ] **Sem Fase 4 no render**: nos três casos, o texto renderizado da página não contém "Fase 4"
      nem "avançar" vindo da orientação.

### 2.4 Conferência no navegador

Com o banco local: uma rodada da Fase 3 em cada caso, como Administrador e como Avaliador
(`/dev/login`). Conferir espaçamento entre os blocos, que o `Card` neutro não compete com o selo da
banda, e 375px. **Limpar a cena** antes de `npm test`.

### 2.5 Varredura dos ACs

Percorrer a tabela da § 4 marcando cada linha com o nome do teste que a prova. Atualizar este plano
(estado das Partes e "o que herda").

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; conferência no navegador feita; a issue
pode ser fechada à mão.

Commit sugerido: `feat(rodadas): mostrar a orientação pelo ICR ao administrador`.
