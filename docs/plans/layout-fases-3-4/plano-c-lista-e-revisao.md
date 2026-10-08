# Plano C: Lista de rodadas e cabeçalho da revisão

Ajustes **05 e 06** da referência visual `docs/plans/layout-fases-3-4/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Antes" e "Depois").

As duas partes mudam `RoundChangesNote` (o "o que mudou em relação à rodada anterior"), por isso ficam
no mesmo plano. Depende do **Plano A, Parte 1** (`QualityBar`) para a barra na lista.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Lista "Rodadas do projeto" agrupada por fase, mudanças em chips, revisão como botão (ajuste 05) | `feat(rodadas): lista de rodadas agrupada por fase` | ✅ |
| 2 | Cabeçalho da revisão em uma linha de chips (ajuste 06) | `feat(rodadas): cabeçalho da revisão em chips` | ✅ |

## Contexto comum

- Arquivos: `(tabs)/rounds/round-list.tsx`, `(tabs)/rounds/round-changes-note.tsx`,
  `(tabs)/rounds/round-changes-labels.ts`, `(tabs)/rounds/[roundId]/page.tsx`,
  `(tabs)/rounds/preconditions.ts` (`roundInputSummary`).
- Componente de chip: já existe `app/components/ui/chip.tsx`; conferir se serve antes de criar outro.
- **Regra de texto**: nenhum aviso some. `CODEBOOK_AND_PROMPT_NOTICE` e
  `CODEBOOK_AND_PROMPT_WITH_INPUT_NOTICE` (o `Alert` amarelo de "mudaram juntos") continuam visíveis
  quando valem. `ENTERS_PHASE_3_NOTE` e `entersPhase4Note` podem virar ⓘ do chip da fase.
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  o texto antigo antes de mudar (`grep-texto-antigo-nos-testes`). Testes afetados:
  `rounds/page.int.test.ts`, `rounds/phase-4-reading.int.test.ts`, `rounds/[roundId]/page.int.test.ts`,
  `rounds/round-changes-labels.unit.test.ts`, `evaluate/page.int.test.ts` (usa `roundInputSummary`).
- Verificação no navegador com cena de várias rodadas em fases diferentes.

## Parte 1: lista agrupada por fase e mais enxuta (ajuste 05)

**Hoje**: cada `Card` empilha título "Rodada 5 · Fase 3" + selo, versões, "Aberta em… por… · fechada
em…", o `RoundChangesNote compact` com as três linhas (inclusive "Codebook: v4, o mesmo · … · Fase: 3, a
mesma"), `AgreementValue`, `QualityValue`, `ReferenceRoundLine` (Fase 4) e "Abrir revisão" no pé.

**Depois**:

```
FASE 3
┌──────────────────────────────────────────────┐
│ Rodada 5  [fechada] ⓘ          [Abrir revisão]│
│ (Codebook v4) (Prompt v2 → v3)                │  ← chip destacado só no que mudou
│ Concordância: 0,741 [aceitável]               │
│ [██████████▓▓▓▓░░]                            │
│ Alto 62,5 · Médio 25 · Baixo 12,5 · 40 notas  │
└──────────────────────────────────────────────┘
```

- Agrupar por fase com subtítulo "Fase N" (reaproveitar `phaseRuns` de `agreement-series.ts`, como a
  série de Qualidade faz) e tirar o "· Fase N" do título de cada cartão.
- `RoundChangesNote` no modo `compact` vira chips: versões sempre como chip neutro; o que mudou em chip
  destacado ("Prompt v2 → v3"). A mudança de fase vira chip só quando mudou. Some a linha separada de
  versões, porque os chips já mostram.
- "Aberta em… por… · fechada em…" vai para o `InfoTooltip` ao lado do selo.
- "Abrir revisão" vira `ButtonLink` secundário pequeno à direita do título (só rodada fechada).
- Qualidade: `QualityBar` `sm` + uma linha curta de números (Plano A).
- `ReferenceRoundLine` (Fase 4) vira uma linha só, em `muted`: "Referência: rodada 4 · ICR 0,741 · Alto
  62,5 · Médio 25 · Baixo 12,5". As versões saem dessa linha: na Fase 4 elas são, por regra, as mesmas
  da rodada, e já estão nos chips. A comparação completa fica na seção de comparação (Plano B).

**A Parte 2 herda**: o modo de chips virou um componente próprio, `RoundChangeChips` (em
`round-changes-note.tsx`), que recebe `round` (versões) e `changes` (pode ser `null`, na primeira rodada).
Ele mostra Codebook e Prompt sempre, a Fase só quando mudou, com `ENTERS_PHASE_3_NOTE`/`entersPhase4Note`
no ⓘ do chip, e o `Alert` de "mudaram juntos" logo abaixo. O chip que mudou leva `border-brand!
font-semibold text-brand!` (com `!`, porque `cx` não resolve conflito). Os textos dos chips estão em
`round-changes-labels.ts`: `codebookChipText`, `promptChipText`, `phaseChipText` ("Fase 2 → 3" ou
"Fase 3"). O `RoundChangesNote` perdeu o `compact` e ficou só com o modo completo, que é o que a revisão
usa hoje. Para a Parte 2, que quer o chip da fase sempre visível, falta uma opção no `RoundChangeChips`.
Na lista, a Qualidade curta é `QualitySummary` (`quality-panel.tsx`) e a linha da referência é
`referenceLine(reference: ComparedRound)`, com `levelsShareText` de `quality-labels.ts`.

## Parte 2: cabeçalho da revisão em chips (ajuste 06)

**Hoje** (`rounds/[roundId]/page.tsx`, só Administrador): depois de "Voltar às rodadas", um parágrafo
solto com `roundInputSummary(round.phase)` ("Rodada da Fase 3: a LLM recebe o prompt, o codebook
completo — título, descrição…") e o `RoundChangesNote` completo ("Em relação à rodada 4" + três linhas).

**Depois**:

```
← Voltar às rodadas
(Rodada 5) (Fase 3 ⓘ) (Codebook v4) (Prompt v2 → v3) (fechada em 28/09)
[aviso amarelo "mudaram juntos", quando valer]
Revisão de discordâncias ⓘ
```

- Uma linha de chips: rodada, fase, codebook, prompt, data de fechamento. O `roundInputSummary` vai para
  o ⓘ do chip da fase. As mudanças em relação à rodada anterior destacam o chip que mudou, com o mesmo
  modo da Parte 1.
- O título da `Section` continua "Revisão de discordâncias da rodada N" para os dois papéis (menos
  mudança nos testes e o título se sustenta sozinho). Para o Administrador, o `hint` sai, porque a
  versão já está no chip, e o `help` fica como está.
- Os chips são **só do Administrador**: hoje `roundInputSummary` e `RoundChangesNote` já só aparecem
  para ele, e o PRD diz que o Avaliador não sabe em que fase o projeto está. Para o Avaliador a página
  fica exatamente como hoje, com hint e tudo.
