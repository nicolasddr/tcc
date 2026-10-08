# Plano E: Marcas curtas e notas de rodapé em ⓘ

Ajustes **10 e 11** da referência visual `docs/plans/layout-fases-3-4/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Antes" e "Depois").

Independente dos outros planos, mas se o Plano A ou o B já tiverem mexido nos mesmos componentes
(`quality-panel.tsx`, `*-matrix-table.tsx`), partir da versão nova.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Marcas de participação e de uso curtas, com a lista no ⓘ (ajuste 10) | `feat(rodadas): marcas de uso e participação curtas` | ✅ |
| 2 | Notas de rodapé repetidas viram ⓘ (ajuste 11) | `refactor(telas): notas de rodapé em tooltips` | ✅ |

## Contexto comum

- Regra herdada do redesenho do Codebook: **nenhum texto some, só muda de lugar**. O que sai da tela
  vai para um `InfoTooltip` (`app/components/ui/tooltip.tsx`) ou para o `help` de uma `Section`.
- **`InfoTooltip` não funciona dentro de `<dialog>`** (memória `infotooltip-nao-cabe-em-dialog`).
  `LastRoundSummary` e `ReferenceComparisonPanel` aparecem nos diálogos de avançar/voltar de fase: lá
  dentro, o texto continua visível (ou fica numa linha curta), sem ⓘ.
- O `collectText` dos testes de página só lê `children`; texto que vira prop do `InfoTooltip` some das
  asserções. Ler a prop via `findElement` (ver memória do redesenho).
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  o texto antigo antes de mudar (`grep-texto-antigo-nos-testes`).

## Parte 1: marcas curtas (ajuste 10)

**Hoje** (`app/projects/[id]/round-usage.ts`): `itemUsageLabel` devolve "usado 1, 2 (Fase 2), 4 (Fase 3) e
6 (Fase 4)" e `participationLabel` devolve "avaliou 1 e 2 (Fase 2) e 4 (Fase 3)". O texto inteiro vai
dentro de um `Badge`, que quebra em várias linhas (`whitespace-normal!`) e já estourou 375 px.

**Depois**: `[já avaliou antes] ⓘ` e `[usado em 4 rodadas] ⓘ`, com a frase completa de hoje no ⓘ.

- Novas funções curtas em `round-usage.ts` (ex.: `itemUsageShort`, `participationShort`), com `plural`
  de `lib/plural.ts` para "1 rodada / N rodadas". As funções longas continuam e alimentam o ⓘ.
- Rótulos decididos: avaliador → "já avaliou antes" na lista de avaliações da rodada (é sempre antes
  da rodada em foco) e "avaliou em N rodadas" na página de membros (lá não há rodada em foco); item →
  "usado em N rodadas".
- Lugares que usam as marcas: `(tabs)/rounds/agreement-panel.tsx` (`EffortList`, via
  `participationBefore`), `app/projects/members.ts` + página de membros, `pipeline/items-editor.tsx`,
  `(tabs)/rounds/generate-responses.tsx`. `participationBefore` hoje devolve `Record<memberId, string>`:
  passar a devolver curto + longo, ou o componente chama as duas funções.
- Tirar o `whitespace-normal!` do `Badge`. Medir a 375 px no `iframe` (memória do painel) com o rótulo
  mais longo, de três fases.
- Testes: `round-usage.unit.test.ts`, `items/page.int.test.ts`, `rounds/page.int.test.ts`,
  `rounds/phase-4-round.int.test.ts`, testes da página de membros.

## Parte 2: notas de rodapé em ⓘ (ajuste 11)

Mover para ⓘ, deixando um rótulo curto visível:

| Onde | Texto visível hoje | Fica visível | Vai para o ⓘ |
|---|---|---|---|
| `agreement-panel.tsx` (cartão do ICR) | `BAND_REFERENCE` inteiro ("Faixa de referência de Krippendorff (2004): abaixo de…") | "Faixa de referência" | `BAND_REFERENCE` |
| `agreement-matrix-table.tsx` e `quality-matrix-table.tsx` | "A matriz é da versão de codebook que a rodada fixou, Codebook vN, e não da versão vigente do projeto." | "Codebook vN da rodada" | a frase + a legenda que já está no ⓘ |
| `quality-panel.tsx` | `OUTLIER_PAIR_SUMMARY` ("Os dois valores saem do mesmo dado…") | "O resultado da rodada é o valor com todos." | `OUTLIER_PAIR_SUMMARY` |
| `agreement-panel.tsx` | `OUTLIER_PAIR_SUMMARY` + ⓘ com `OUTLIER_PAIR_HINT` | "O resultado da rodada é o valor com todos." | `OUTLIER_PAIR_SUMMARY` e `OUTLIER_PAIR_HINT`, separados por linha em branco |
| `phase-3-checklist.tsx` (hint com tudo pronto) | "Nenhuma rodada aberta, ao menos uma fechada na Fase 3, e codebook e prompt são os da rodada de referência. O avanço pede confirmação…" | "Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa." | nada (repete o checklist logo acima) |
| `phase-2-checklist.tsx` (hint com tudo pronto) | "Nenhuma rodada aberta e ao menos uma fechada. O avanço pede confirmação…" | "Tudo pronto. O avanço pede confirmação antes de mudar qualquer coisa." | nada |

- `pipeline-checklist.tsx` fica como está: "A configuração está completa…" já é curto e não repete a
  lista.
- A frase curta "O resultado da rodada é o valor com todos." vira constante nova em
  `agreement-labels.ts`, usada pelos dois painéis. `StatCard` só aceita `label: string`, por isso o ⓘ
  fica na linha curta, e não no rótulo do cartão.

- `last-round-summary.tsx` também mostra `BAND_REFERENCE` e `QUALITY_REFERENCE`, mas aparece dentro do
  diálogo de avanço: lá **fica como está** (ver Contexto comum).
- Testes: `agreement-labels.unit.test.ts`, `(tabs)/page.int.test.ts`, `rounds/page.int.test.ts`,
  `(tabs)/phase-4-return.int.test.ts`.
