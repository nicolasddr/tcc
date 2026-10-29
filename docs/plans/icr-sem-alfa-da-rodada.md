# ICR por critério em toda tela, sem o α único da rodada

Escrito em 2026-10-29 contra o `main` em `feeb62a`. Sem issue no GitHub. Decisões confirmadas pelo
usuário em 2026-10-29. Sem TDD: escrever o código, ajustar os testes afetados e rodar só eles.

**Por quê:** na rodada 8 do PoC, o α único deu 0,811 ("Boa") com Relevance em −0,031 e Diversity
em 0,548. Juntar critérios infla o α. Krippendorff (2011, p. 1): o α mede uma variável por vez.
Krippendorff (2004, recomendação iv): com várias variáveis, mede-se cada uma e vale a menor. Shah
(2025) não diz como juntar critérios.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Página da rodada sem o card; orientação pelo critério mais fraco | `feat(rodadas): ICR por critério na rodada, sem o α único` | |
| 2 | Lista de rodadas, resumo das Fases 2 e 3, comparação da Fase 4 | `feat(rodadas): ICR por critério na lista, nas fases e na Fase 4` | |
| 3 | Série por critério; sai o α da rodada inteira; ADR | `feat(projeto): série do ICR por critério` | |

Caminhos curtos são relativos a `app/projects/[id]/(tabs)/rounds/`.

## Regras

- **Critério mais fraco:** o não calculável vence (inclusive sem variação); senão, o menor α;
  empate pela ordem de `matrixColumns`; critério sem nota não entra.
- **Outliers na tabela:** só a coluna ICR mostra "com todos" e "sem os marcados".
- **Orientação:** diz o nome do critério mais fraco; se ele tem notas concentradas, acrescenta que o
  α baixo pode ser falta de variação.
- **Fase 4:** uma linha "ICR · critério" por critério.
- **Série:** um gráfico por critério; rodadas ligadas por nome + tipo do critério (cada versão do
  codebook dá ids novos); rodada sem o critério fica vazia.
- **Cena de conferência:** a rodada 8 (Relevance 46 Alto/Alto + 4 Alto/Médio em 5 definições × 10
  respostas; Diversity 6 Médio/Médio, 2 Baixo/Baixo, 2 Médio/Baixo). Na tela: −0,031 e 0,548, nunca
  0,811.

## Parte 1: página da rodada

1. `agreement-matrix.ts`: `criterionAgreements(definitions, criteria, observations, excluded)` =
   `criterionCells` + `withoutOutliers` por critério; `weakestCriterion(rows)`.
2. `criterion-agreement-table.tsx`: recebe `excluded`; coluna ICR com os dois valores; ⓘ da faixa
   de referência no cabeçalho ICR.
3. `agreement-panel.tsx` (`AgreementPanel`): sai o α, o selo, a `ProfileLine` e o aviso de
   concentração juntado. Ficam o aviso de amostra, o bloco de outliers e o `EffortList`. Aviso de
   concentração passa a ser um por critério, com o nome (`agreement-labels.ts`).
4. `round-agreement-section.tsx`: avisos → tabela → "Ver por definição" → outliers e avaliações.
5. `reading-guidance.ts` e `reading-guidance-labels.ts`: recebem o critério mais fraco e usam o
   nome; `page.tsx` passa esse critério.
6. Testes a ajustar e rodar: `agreement-matrix.unit`, `agreement-labels.unit`,
   `reading-guidance.unit`, `reading-guidance-labels.unit`, `page.int`,
   `[roundId]/agreement/page.int`, `agreement-outliers.int`, `evaluate/page.int`.
7. Docs: `docs/icr-como-calculamos.md` (seções 4.1, 5 e 6) e `docs/CONTEXT.md` (*Confiabilidade*).

## Parte 2: lista, fases e Fase 4

1. Loader `loadRoundCodebooks(rounds, tx)` → definições e critérios por versão de codebook (usa
   `loadDefinitions`/`loadCriteria` de `pipeline/codebook.ts`).
2. `AgreementValue`: um item por critério ("Relevance −0,031 · Diversity 0,548"); usado em
   `round-list.tsx` (sem selo) e `pipeline/last-round-summary.tsx` (com selo).
3. `page.tsx` e `(tabs)/page.tsx` (`lastClosedRoundOf`, `phase4ReturnData`): mapas com as linhas
   por critério no lugar de `AgreementPair`.
4. `reference-comparison.ts` e `reference-comparison-labels.ts`: `comparisonRows` com uma linha por
   critério; `referenceLine` com a lista.
5. Testes a ajustar e rodar: `reference-comparison-labels.unit`, `page.int`, `(tabs)/page.int`,
   `phase-4-reading.int`, `(tabs)/phase-4-return.int`, `pipeline/advance-phase-3.int`.
6. Docs: `docs/icr-como-calculamos.md` seção 5.

## Parte 3: série por critério

1. `agreement-series.ts`: `agreementSeries` devolve uma série por critério (chave nome + tipo).
2. `agreement-series-chart.tsx`: um gráfico por critério, com nome e badge; nota de outliers e
   `HowToRead` uma vez só.
3. `(tabs)/page.tsx`: série com `loadRoundCodebooks`.
4. Apagar `agreementPair`/`profilePair` sobre a rodada inteira (`grep -rn "agreementPair(" app`).
5. Testes a ajustar e rodar: `agreement-series.unit`, `agreement-pair.unit`, `quality.unit`,
   `(tabs)/page.int`, `(tabs)/phase-4-return.int`.
6. Docs: `docs/icr-como-calculamos.md`, `docs/CONTEXT.md` e ADR nova em `docs/adr/` (local) com o
   caso da rodada 8 e as fontes.

## Em cada Parte

`npm run lint`, `npx tsc --noEmit`, os testes listados e uma olhada no preview com a cena de
conferência.

**Fora:** a Qualidade, que também junta as notas dos critérios; fica para decidir depois.
