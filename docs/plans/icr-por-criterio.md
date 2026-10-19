# Concordância e Qualidade por critério, com a matriz por definição recolhida

Escrito em 2026-10-19 contra o `main` em `0aaf6bd`. Sem issue no GitHub: os commits não levam
`Refs`/`Closes`. Continua `icr-notas-concentradas.md` e substitui a linha "Todas as definições"
dele (D6, Partes 2 e 3).

**Objetivo:** a seção de Concordância abre com uma tabela simples, uma linha por critério, e a
matriz definição × critério fica recolhida em "Ver por definição". A seção de Qualidade ganha o
mesmo formato.

**O caso que motivou:** no PoC do LLMAuditor, "Query 1" a "Query 5" são posições, e não textos do
codebook. A Query 1 da resposta 1 não tem relação com a Query 1 da resposta 2. As linhas por
definição da matriz não respondem pergunta nenhuma ali. A pergunta que importa é "os avaliadores
concordam sobre a Relevance?". A linha "Todas as definições" respondia isso, mas no pé da matriz
ela lia como total ou média. A forma da tela foi escolhida pelo usuário em 2026-10-19 (opção A:
tabela por critério em cima e matriz recolhida). Nada aqui precisa de confirmação.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Tabela "por critério" na Concordância; matriz em "Ver por definição", fechada; sai a linha "Todas as definições"; documentação | `feat(rodadas): concordância por critério, com a matriz por definição recolhida` | |
| 2 | Tabela "por critério" na Qualidade, com o mesmo formato; matriz da Qualidade recolhida; documentação | `feat(rodadas): qualidade por critério, com a matriz por definição recolhida` | |

A Parte 2 depende da 1, porque reaproveita a função de agrupar por critério e o padrão de tela.

---

## 1. Ponto de partida

| Peça | Onde | Nesta série |
|---|---|---|
| Colunas da matriz | `(tabs)/rounds/agreement-matrix.ts`: `matrixColumns` (gerais, específicos de mesmo nome juntos, por resposta), `groupByCell`, `cellKey`, `measuredMatrix`, `measureAgreement`, `agreementMatrix` | Parte 1 |
| Linha juntada | `agreement-matrix.ts` `allDefinitionsRow` (~101): já junta as notas de cada coluna, mas devolve `not_applicable` no por resposta e `null` com uma definição | Parte 1 substitui |
| Tabela da matriz | `agreement-matrix-table.tsx`: `Cell` (com `showEqual`), linha `ALL_DEFINITIONS_LABEL`, nota `ALL_DEFINITIONS_NOTE` + ⓘ | Parte 1 |
| Textos | `agreement-labels.ts`: `ALL_DEFINITIONS_*`, `CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE`, `cellTitle`, `cellEqualLabel`, `profileLine`, `sampleSize`, `formatAlpha`, `agreementBand`, `bandTone` | Parte 1 |
| Perfil | `lib/agreement.ts` `agreementProfile` (notas iguais e distribuição) | reaproveitado |
| Qualidade | `quality.ts`: `qualityOf`, `qualityPair`, `qualityMatrix`; `quality-matrix-table.tsx`: `Levels`, `Cell`, `QualityScaleLegend`, `HowToRead` | Parte 2 |
| Página | `(tabs)/rounds/page.tsx` ~351: `AgreementPanel` + `AgreementMatrixTable`; ~386: `QualityPanel` + `QualityMatrixTable` | as duas |
| Recolher | `app/components/ui/disclosure.tsx`: `Disclosure` (`<details>`, fechado por padrão) | as duas |
| Testes | `agreement-matrix.unit.test.ts`, `agreement-labels.unit.test.ts`, `quality-matrix.unit.test.ts`, `rounds/page.int.test.ts` (`matrixOf`, `matrixTextOf`, `qualityMatrixOf`, `findSection`, `opensClosed`) | as duas |
| Docs | `docs/icr-como-calculamos.md` seção 5 (~104); `docs/CONTEXT.md` *Concordância (ICR)* (~150) e *Qualidade* (~187) | as duas |

Caminhos curtos são relativos a `app/projects/[id]/`.

`grep` de "Todas as definições", `ALL_DEFINITIONS`, `allDefinitionsRow`, `showEqual` e
`cellEqualLabel` em `app/`: 6 ocorrências em `agreement-labels.ts`, 14 nos testes de labels, 15 em
`agreement-matrix-table.tsx`, 1 em `agreement-matrix.ts`, 6 nos testes da matriz, 14 em
`page.int.test.ts`, e 1 em cada doc. Todas saem ou mudam na Parte 1.

---

## 2. Decisões

**D1. O que é a linha de um critério.** Uma linha por coluna de `matrixColumns`, na mesma ordem:
gerais, depois específicos (os de mesmo nome já juntos), depois por resposta.
- Critério geral: as notas dele em todas as definições.
- Específicos de mesmo nome: as notas de todas as definições que têm o critério.
- Critério por resposta: as notas dele, que já não têm definição.

As unidades não mudam: cada nota só se compara com as da mesma resposta e da mesma definição. O
valor é um α sobre essas notas, **não a média** das células. É a mesma conta de `allDefinitionsRow`,
com duas diferenças: o critério por resposta entra, e a tabela aparece mesmo com uma definição só.

**D2. Colunas da tabela de Concordância.**

| Critério | ICR | Notas iguais | Notas |
|---|---|---|---|
| Relevance `Geral` | badge −0,003 | 76% · abaixo: Alto x% · Médio y% · Baixo z% | 50 notas · 2 avaliadores |
| Diversity `Por resposta` | badge −0,096 | … | 10 notas · 2 avaliadores |

- A coluna **Critério** traz o nome com o mesmo badge do cabeçalho da matriz (Geral / Por
  resposta).
- A coluna **ICR** traz o badge da faixa, ou o motivo de não calculável (`cellNotCalculableLabel`).
- A coluna **Notas iguais** traz a porcentagem e, numa segunda linha em `text-[11.5px]`, a
  distribuição. Com isso, a concentração fica visível sem aviso próprio: o aviso de notas
  concentradas continua só no painel (D4 do plano anterior).
- A coluna **Notas** usa `sampleSize`.
- Critério sem nota nenhuma: "sem nota" na coluna ICR e o resto vazio.

**D3. Com todos.** A tabela é calculada **com todos**, como a matriz. O painel acima já mostra o
"sem os marcados".

**D4. A matriz por definição.** Ela fica dentro de um `Disclosure` **fechado por padrão**, com o
resumo "Ver por definição" e o texto "(N definições × M critérios)". A linha "Todas as definições"
e a nota abaixo da tabela saem, porque a tabela por critério cumpre esse papel. As células
continuam com o `title` de notas iguais (Parte 3 do plano anterior), e `showEqual` sai do `Cell`.
O `Disclosure` fica em `page.tsx`, envolvendo `AgreementMatrixTable`, para não mudar as props da
matriz (o teste confere as chaves, ~2005).

**D5. Ajuda da tabela.** Uma linha `text-xs text-muted` abaixo da tabela, com ⓘ:
- texto visível: "Cada linha junta as notas do critério em todas as definições, numa conta só.";
- balão: "É um α sobre essas notas, e não a média das células da matriz. Para ver se alguma
  definição puxa o número para baixo, abra Ver por definição. Quando as definições são só
  posições (Query 1, Query 2…), a leitura é esta tabela."

Antes de gravar, conferir o texto contra o código (memória "texto de ajuda").

**D6. Qualidade (Parte 2).** Mesmo formato: uma linha por critério, com a distribuição das notas
daquele critério em todas as definições (`qualityPair` sobre o grupo juntado). Diferente da
Concordância, aqui o "sem os marcados" aparece, porque a matriz da Qualidade já mostra os dois
valores. A célula reaproveita `Levels`. A matriz fica em "Ver por definição", fechada, e a legenda
da escala e o `HowToRead` ficam fora do `Disclosure`, porque valem para as duas tabelas.

---

## 3. Parte 1: Concordância por critério

**Commit:** `feat(rodadas): concordância por critério, com a matriz por definição recolhida`

1. **(TDD, unitário)** `agreement-matrix.unit.test.ts`: trocar o `describe` de "todas as
   definições" por `describe('… — por critério')`, testando `criterionCells` (passo 2). Ver cada
   caso falhar pela asserção: criar a função antes devolvendo `[]`, para não ter vermelho de
   import.
   - Critério geral em três definições: o valor é o `ordinalAlpha` das notas juntas, diferente da
     média das três células. Reaproveitar o caso que já existe.
   - Específicos de mesmo nome juntam só as definições que têm o critério.
   - Critério por resposta: o valor é o da célula "Por resposta" (**muda** em relação a hoje, que
     dá `not_applicable`).
   - Com **uma** definição, a função devolve as linhas (muda em relação a hoje, que dá `null`).
   - Critério sem nota → `unrated`.
   - A ordem segue `matrixColumns`.
   - Cada linha traz `profile`.
2. `agreement-matrix.ts`: `criterionCells(definitions, criteria, observations)` →
   `{ column, cell: MatrixCell }[]`, nascida de `allDefinitionsRow` com as duas mudanças de D1. Para
   a Parte 2, extrair a parte genérica:
   `measuredByColumn(definitions, criteria, observations, measure)` →
   `{ column, cell: MeasuredCell<V> }[]`, ao lado de `measuredMatrix`. `criterionCells` passa a
   ser `measuredByColumn` + `measureAgreement`. Apagar `allDefinitionsRow`.
3. `agreement-labels.ts`:
   - novos `CRITERION_TABLE_NOTE` e `CRITERION_TABLE_HELP` (D5), `BY_DEFINITION_SUMMARY(definitions,
     criteria)` → `"Ver por definição (5 definições × 2 critérios)"` (usar `plural`);
   - apagar `ALL_DEFINITIONS_LABEL`, `ALL_DEFINITIONS_NOTE`, `ALL_DEFINITIONS_LEGEND`,
     `CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE`, e `cellEqualLabel` se ficar sem uso (a Notas iguais
     da tabela nova pode reaproveitá-la; decidir pelo texto);
   - testes em `agreement-labels.unit.test.ts`: os do resumo e da nota; apagar os de
     `ALL_DEFINITIONS_*`.
4. Componente novo `criterion-agreement-table.tsx`, `CriterionAgreementTable({ definitions,
   criteria, observations })`, com as colunas de D2. Tabela com `overflow-x-auto`, cabeçalhos no
   estilo da matriz, e a nota de D5 abaixo. Sem `w-full` numa célula só (memória "tabela: w-full
   espreme colunas").
5. `agreement-matrix-table.tsx`: tirar a linha "Todas as definições", a nota e o `showEqual`. As
   linhas voltam a ser `rows.map(matrixRow)`.
6. `page.tsx`, seção de Concordância: `AgreementPanel`, depois `CriterionAgreementTable`, depois
   `<Disclosure summary={BY_DEFINITION_SUMMARY(…)}>` com `AgreementMatrixTable` dentro (D4). Quando
   a versão do codebook não tem definição ou critério, o `EmptyState` da matriz continua aparecendo
   fora do `Disclosure` e a tabela por critério não aparece.
7. **(TDD, integração)** `rounds/page.int.test.ts`:
   - a seção de Concordância tem `CriterionAgreementTable` antes do `Disclosure`, e o
     `AgreementMatrixTable` dentro dele, fechado (`opensClosed`);
   - com 5 definições e Relevance geral, o texto da tabela por critério traz "Relevance", o α
     juntado e "% de notas iguais"; a coluna do por resposta traz o valor (não o traço);
   - com uma definição, a tabela aparece;
   - o texto da matriz não contém mais "Todas as definições" (asserção negativa: provar por
     mutação, porque passa antes do código);
   - apagar ou reescrever os 14 trechos que conferiam a linha antiga. Ler cada um antes; alguns
     podem virar asserção da tabela nova.
   - Texto dentro de `<details>` fechado aparece no `markupTextOf`: usar `glanceTextOf` onde a
     asserção é "não aparece aberto" (memória do `markupTextOf`).
8. Docs:
   - `docs/icr-como-calculamos.md` seção 5: trocar o parágrafo da linha **Todas as definições**
     por um item **Por critério** (D1, D3, "não é média"), e dizer que a matriz por célula fica
     recolhida em "Ver por definição";
   - `docs/CONTEXT.md`, *Concordância (ICR)*: trocar a frase da linha **Todas as definições** por
     "A tabela **por critério** também não é média: cada linha é um α sobre todas as notas
     daquele critério na rodada, juntando as definições numa conta só."
9. Verificar no preview (`/dev/login`, cena do PoC com 5 queries; vitest como runner de seed): a
   seção abre com a tabela de dois critérios, a matriz fechada, e ao abrir aparece sem a linha
   antiga. A 375 px, a tabela rola dentro da caixa e a página não estoura (medir em iframe; memória
   do preview).
10. `npm run lint`, `npx tsc --noEmit`, `npm test` (banco limpo antes).

Fora: série, visão geral, `AgreementValue`.

---

## 4. Parte 2: Qualidade por critério

**Commit:** `feat(rodadas): qualidade por critério, com a matriz por definição recolhida`

1. **(TDD, unitário)** `quality-matrix.unit.test.ts`: `qualityByCriterion(definitions, criteria,
   observations, excluded)` → `{ column, cell: MeasuredCell<QualityPair> }[]`. Casos:
   - um critério geral em três definições: as contagens são a soma das três células;
   - com outlier marcado: `withoutOutliers` sai das notas sem o marcado;
   - critério por resposta: igual à célula dele;
   - critério sem nota: `unrated`.
2. `quality.ts`: `qualityByCriterion` = `measuredByColumn` (Parte 1) + `qualityPair(group,
   excluded)`.
3. `quality-matrix-table.tsx`: exportar `Levels` e o `Cell` da Qualidade (ou movê-los para um
   arquivo comum), sem mudar o que desenham.
4. Componente novo `criterion-quality-table.tsx`, `CriterionQualityTable`: as colunas são
   **Critério** (nome + badge) e **Notas** (o `Cell` da Qualidade, com os dois valores quando há
   outlier).
5. `quality-matrix-table.tsx`: a legenda da escala (`QualityScaleLegend`), a versão do codebook e
   o `HowToRead` saem do componente, para a página pô-los fora do `Disclosure` (D6). Conferir no
   teste que a legenda continua aparecendo uma vez só.
6. `page.tsx`, seção de Qualidade: `QualityPanel`, `CriterionQualityTable`, `Disclosure` "Ver por
   definição" com `QualityMatrixTable`, e depois a legenda e o `HowToRead`.
7. **(TDD, integração)** `rounds/page.int.test.ts`: ordem dos elementos na seção de Qualidade;
   matriz fechada; a tabela por critério traz a soma das definições; com outlier, os dois valores.
   Os testes de ~2074–2105 (`qualityMatrixTextOf`, `opensClosed` do `HowToRead`) mudam de lugar
   junto com o `HowToRead`.
8. Docs: `docs/CONTEXT.md`, *Qualidade*: uma frase dizendo que a tela mostra a Qualidade por
   critério, juntando as definições, e a matriz por definição recolhida.
9. Verificar no preview, numa rodada de Fase 3 com outlier marcado; 375 px.
10. `npm run lint`, `npx tsc --noEmit`, `npm test`.

Fora: `QualityPanel` e série da Qualidade, que não mudam.
