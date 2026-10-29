# Layout da concordância: barra única, "Por definição" com abas, amostra no título e legenda

Escrito em 2026-10-29 contra o `main` em `8987c3c`. Sem issue no GitHub. Sem TDD: escrever o
código, ajustar os testes afetados e rodar só eles. Cada Parte vai num chat separado, na ordem da
tabela. As decisões marcadas com ⚠ se perguntam ao usuário **antes do código** da Parte em que
entram.

**Por quê:** na seção "Concordância e confiabilidade", cada critério ocupa 4 colunas na matriz por
definição, iguais + adjacente + extrema somam sempre 100% (escala de 3 pontos), o critério por
resposta enche a matriz de "—", a faixa só aparece no ⓘ e os avisos viram banners soltos. Com um
codebook maior (12 definições × 6 critérios), a seção só se lê com rolagem lateral.

**Referências** (nesta pasta):
- `amostra.html` (cópia de `~/Desktop/tcc-amostra-concordancia.html`): **a principal**. Mostra o
  "Projeto maior" (dados inventados, 12 × 6 + 1 por resposta) e o PoC. Classes úteis: `.dbar` /
  `.dnums` (barra e números), `.tabsx` (abas), `.hmt` / `.hm` (mapa de calor), `.colpick` (nome da
  coluna que abre a aba), `.sub` ("360 notas"), `.legs` (legenda).
- `referencia-visual.html` (cópia de `~/Desktop/tcc-layout-concordancia.html`): antes e depois
  das sugestões 1, 4, 5, 7 e 8 (âncoras `#sN`, painéis `#sN-pK`).

Caminhos curtos são relativos a `app/projects/[id]/(tabs)/rounds/`. A seção é montada por
`round-agreement-section.tsx`, chamada pela aba Rodadas (`page.tsx`, rodada em foco) e pela página
própria da concordância (`[roundId]/agreement/page.tsx`): as duas mudam juntas.

| Parte | Itens do pedido | Entrega | Commit sugerido | Estado |
|---|---|---|---|---|
| 1 | 2, 3 | Tabela por critério com 3 colunas e a barra iguais · adjacente · extrema | `feat(rodadas): tabela por critério com a barra de notas iguais e divergências` | |
| 2 | 4 (aba Todos), 5 | "Por definição" vira mapa de calor, sem o critério por resposta | `feat(rodadas): mapa de calor por definição, sem o critério por resposta` | |
| 3 | 4 (abas) | Abas por critério, guardadas na URL | `feat(rodadas): abas por critério na concordância por definição` | |
| 4 | 1, 6 | Amostra embaixo do título e legenda fixa | `feat(rodadas): amostra no título e legenda da concordância` | |

## Regras que valem para todas as Partes

- **Termos do glossário** (`docs/CONTEXT.md`): *Confiabilidade (ICR)*, *notas iguais*,
  *Divergência adjacente*, *Divergência extrema*, *critério geral / específico / por resposta*,
  *definição*, *não aplicável*, *não calculável*, *sem nota*, *Outlier* ("com todos" / "sem os
  marcados como outlier"). Na tela, o cabeçalho curto "Notas iguais · adjacente · extrema"; os
  termos completos vão no `aria-label`/`title` da barra.
- **A matriz de Qualidade não muda.** `matrixColumns`, `measuredMatrix`, `cellNotApplicableTitle`,
  `MATRIX_PER_RESPONSE_LEGEND` e `byDefinitionSummary` também servem `quality-matrix-table.tsx` e
  o `focusByDefinition` de `page.tsx`: filtrar e contar só do lado da concordância, sem mudar a
  assinatura dessas funções.
- **Linha de níveis** ("Alto 60% · Médio 30% · Baixo 10%", hoje embaixo de "Notas iguais" da
  Fase 3 em diante): sai da concordância, como na amostra. A distribuição por nível continua na
  Qualidade (`QualityBar`). Na Parte 1, ajustar `docs/CONTEXT.md` (*Concordância* e *Confiabilidade
  (ICR)* falam em "notas iguais e distribuição" ao lado do α).
- **ⓘ de "Notas concentradas":** o texto de `concentrationWarning` (nível e porcentagem daquele
  critério) seguido do `CONCENTRATION_HELP`. A regra (`isConcentrated`) não muda e continua lida
  sobre o valor com todos.
- **Largura das tabelas:** como na amostra (`table.t.fit`), tabela `w-full` com uma última célula
  vazia `w-full` que absorve a sobra; as colunas de conteúdo ficam no tamanho do conteúdo (ver a
  memória sobre `w-full` espremer colunas: aqui é o efeito que se quer).
- **Sem coluna fixa** (`.stc` da amostra é a sugestão 9, que não foi escolhida).

## Decisões a confirmar

| # | Decisão | Recomendação | Parte |
|---|---|---|---|
| ⚠ D1 | Com outliers, o mapa de calor, as tabelas das abas e as barras mostram o quê? Hoje a matriz por definição usa só o valor com todos (`agreementMatrix` não recebe `excluded`), e o glossário (*Outlier*) pede os dois valores juntos. | Manter como hoje: com todos no mapa, nas abas e em todas as barras; o par empilhado ("com todos" / "sem os marcados como outlier") só na célula ICR da tabela por critério. Rodapé da parte "Por definição", só com outliers: "Por definição, os valores são com todos." | 2 |
| ⚠ D2 | Sem abas quando há um critério só por definição (PoC): a tabela daquele critério aparece direto. | Sim. | 3 |
| ⚠ D3 | "Todos" é a aba inicial; a aba escolhida vai para a URL. | `?criterio=<column.key>` (id do critério que abre a coluna, estável dentro da versão de codebook), com `#concordancia` no fim para voltar à seção. Valor ausente ou desconhecido = "Todos". O nome do critério na URL ficaria legível, mas um geral e um específico podem ter o mesmo nome. | 3 |
| ⚠ D4 | No mapa, clicar no nome da coluna abre a aba daquele critério. | Sim: link com sublinhado tracejado e `title` "Ver só Relevance", como `.colpick`. | 3 |
| ⚠ D5 | α geral ao lado do nome na aba. | Em cinza (`text-faint`, `tabular-nums`), sem cor de faixa, valor com todos; "não calculável" e "sem nota" com o rótulo curto de hoje. | 3 |
| ⚠ D6 | Rótulos da linha da amostra com outliers: o pedido diz "Com todos: … · Sem outliers: …", mas a seção já usa `AGREEMENT_ALL_LABEL` ("com todos") e `AGREEMENT_WITHOUT_OUTLIERS_LABEL` ("sem os marcados como outlier") na célula do ICR. | Reusar as constantes, com inicial maiúscula: "Com todos: 3 avaliadores · 40 respostas · Sem os marcados como outlier: 2 avaliadores · 40 respostas". | 4 |

## Parte 1: tabela por critério com 3 colunas e a barra (itens 2 e 3)

1. `divergence.ts`: `DIVERGENCE_BAR_HEADER` ("Notas iguais · adjacente · extrema") e
   `divergenceBarLabel(profile)` ("81% iguais, 17% divergência adjacente, 2% divergência extrema",
   com `formatShare`).
2. `divergence-bar.tsx` (novo): `DivergenceBar({ profile })` com `role="img"`, `aria-label` e
   `title` = `divergenceBarLabel`. Barra `w-full`, 8 px, `rounded-full`, fundo `bg-line`,
   segmentos `bg-faint` (iguais), `bg-warning` (adjacente), `bg-danger` (extrema), largura =
   fração. Embaixo, os três números (`text-[11.5px] tabular-nums`, `flex justify-between`): iguais
   `text-label`, adjacente `text-warning-fg`, extrema `text-danger-fg font-semibold`, ou
   `text-faint` sem negrito quando é 0. Exportar as classes dos segmentos (a legenda da Parte 4
   usa). A Parte 2 acrescenta a variante curta.
3. `criterion-agreement-table.tsx`:
   - Colunas Critério · ICR · `DIVERGENCE_BAR_HEADER` (+ célula vazia de preenchimento). Saem
     `Equal`, `Divergence`, a coluna "Notas" e a prop `distribution` (e o `hasQuality` que a
     alimenta em `round-agreement-section.tsx`).
   - Cabeçalho da barra com `whitespace-nowrap`: ele dá a largura da coluna, e a barra ocupa
     essa largura. Conferir no preview se os três números caem embaixo das três palavras; se não
     caírem, ajustar o espaçamento dos números, não o texto do cabeçalho.
   - ICR: `th` e `td` com `text-right`, badge com `tabular-nums`; no `AgreementPair` com
     outliers, `items-end`.
   - Embaixo do nome (com os badges Geral / Por resposta de hoje), `notesCount(agreement)` →
     "360 notas", em `block text-[11.5px] font-normal text-muted`. O "N avaliadores" sai da linha.
   - Na linha do nome, se `concentrationWarning(cell.agreement, cell.profile)` der texto: `Badge`
     warning "Notas concentradas" + `InfoTooltip` com `` `${warning} ${CONCENTRATION_HELP}` ``.
4. `round-agreement-section.tsx`: sai o cálculo de `concentrations`; `AgreementWarnings` passa a
   receber só `sample` (o banner de amostra fica até a Parte 4).
5. `agreement-labels.ts`: `notesCount`, `CONCENTRATED_LABEL` ("Notas concentradas"). Apagar
   `distributionLine` e `criterionConcentrationWarning` se ficarem sem uso
   (`grep -rn "distributionLine\|criterionConcentrationWarning" app`).
6. `docs/CONTEXT.md`: tirar "e distribuição" da concordância ao lado do α (ver Regras).
7. Testes: `agreement-labels.unit`, `divergence.unit`, `page.int`, `[roundId]/agreement/page.int`,
   `phase-4-reading.int`, `agreement-outliers.int`. Antes de editar, buscar nos testes "Notas
   iguais", `divergenceLabel('adjacent')`, "Alto ", "avaliadores" e os `toEqual` de cabeçalho. O
   texto da concentração continua no markup, dentro do `role="tooltip"`: afirmar pelo badge e pela
   prop `text`.

## Parte 2: mapa de calor por definição, sem o critério por resposta (itens 4 "Todos" e 5)

Perguntar a ⚠ D1 antes do código.

1. `divergence-bar.tsx`: variante `compact` (64 × 5 px, sem números; os números ficam só no
   `title`/`aria-label`).
2. `agreement-matrix-table.tsx` vira o mapa de calor:
   - Monta com `criteria.filter((criterion) => !isPerResponse(criterion))`. Sem coluna por
     resposta, a linha "Por resposta" some sozinha (`measuredMatrix` só a cria se houver coluna
     por resposta) e o título do "—" é sempre `CELL_NOT_APPLICABLE_TITLE`.
   - Cabeçalho de uma linha só: Definição + uma coluna por critério (nome com o badge Geral de
     hoje). Some `MEASURES` e o grupo de 4 medidas.
   - Célula calculada: badge do α na cor da faixa (com `title={sampleSize(agreement)}`, como hoje)
     e, embaixo, a barra `compact` quando houver `profile`. `not_applicable`: "—" em `text-muted`.
     `unrated` e não calculável: o rótulo curto de hoje.
   - O `EmptyState` de "sem definição ou sem critério" continua.
3. `agreement-labels.ts`: `matrixPerResponseNote(names)` → "Diversity é avaliado por resposta,
   sem definição: só tem o valor geral, na tabela de cima." (plural: "Diversity e Fluency são
   avaliados…"). Rodapé `text-xs text-muted` embaixo do mapa, só se houver critério por resposta.
   Mais o rodapé de outliers, se a D1 ficar como recomendada.
4. `round-agreement-section.tsx`: `byDefinitionSummary(definitions.length, n)` com `n` = colunas
   que não são por resposta. Com `n = 0` (codebook só com critérios por resposta), o
   `ByDefinition` não é renderizado.
5. `docs/CONTEXT.md`: a frase de *não aplicável* (linha por resposta e coluna por resposta)
   continua valendo para a matriz de Qualidade. Só mexer se deixar de ser verdade.
6. Testes: `agreement-labels.unit`, `page.int`, `[roundId]/agreement/page.int`,
   `agreement-outliers.int`. Buscar antes "Por resposta", `CELL_PER_RESPONSE_` e os cabeçalhos da
   matriz nos testes.

## Parte 3: abas por critério, guardadas na URL (item 4, abas)

Perguntar as ⚠ D2 a D5 antes do código.

1. Parâmetro: `page.tsx` e `[roundId]/agreement/page.tsx` leem `criterio` do `searchParams` e
   passam `criterion` + `href` (caminho da própria página) a `roundAgreementSection`. Na aba
   Rodadas, o link da aba não carrega o `?gerar=`.
2. `by-definition.tsx` (ou um `agreement-by-definition.tsx` novo, se `ByDefinition` continuar
   servindo a Qualidade sem abas): com 2 ou mais colunas, `TabList` + `Tab` de
   `app/components/ui/tabs.tsx` (já são links, renderizados no servidor). Abas: "Todos" + uma por
   coluna, com o α geral ao lado (D5, de `criterionAgreements`). A aba ativa vem do parâmetro; valor
   desconhecido cai em "Todos".
3. "Todos": o mapa da Parte 2, com o nome de cada coluna como link para a aba (D4).
4. Aba de um critério: `criterion-by-definition-table.tsx` (novo), Definição · ICR ·
   `DIVERGENCE_BAR_HEADER`, com a mesma célula ICR (alinhada à direita) e a `DivergenceBar` com
   números da Parte 1. Linhas = as células daquela coluna no mapa, sem as `not_applicable`.
   Rodapé, se houver alguma: `notApplicableNote(name, count)` → "Source citation não se aplica a
   8 definições do codebook." (singular: "a 1 definição"). O rodapé de por resposta (Parte 2)
   continua embaixo das abas, em todas.
5. Com uma coluna só (D2): sem abas, a tabela do critério direto.
6. Testes: `page.int`, `[roundId]/agreement/page.int`, `agreement-labels.unit`. Acrescentar poucos
   casos: aba vinda do parâmetro, valor desconhecido = "Todos", rodapé de não aplicável, sem abas
   com um critério só.

## Parte 4: amostra embaixo do título e legenda fixa (itens 1 e 6)

Perguntar a ⚠ D6 antes do código.

1. `agreement-labels.ts`: `sampleText(sample)` → "2 avaliadores · 10 respostas";
   `isSmallSample(sample)` com os mesmos cortes (`SMALL_SAMPLE_RATERS`, `SMALL_SAMPLE_RESPONSES`);
   `SMALL_SAMPLE_LABEL` ("Amostra pequena"); `bandLegend()` → as três faixas com o intervalo
   montado de `AGREEMENT_BANDS` + `formatCut` ("< 0,667", "0,667–0,8", "≥ 0,8") e `bandLabel` em
   minúscula. Nenhum número escrito à mão. Apagar `smallSampleWarning` se ficar sem uso.
2. `agreement-panel.tsx`: `AgreementWarnings` vira `SampleLine({ sample })`, só com elementos
   inline (vai dentro do `<p>` do `hint` da `Section`; o `InfoTooltip` é `<span>`). Sem outliers:
   "2 avaliadores · 10 respostas" e, se pequena, `Badge` warning "Amostra pequena" + `InfoTooltip`
   (`SMALL_SAMPLE_HELP`). Com outliers: as duas contagens (D6), cada uma com o seu badge se for
   pequena.
3. `agreement-legend.tsx` (novo): uma linha `flex-wrap`, `text-xs text-muted`. "Faixa" + os três
   `Badge` (`bandTone`) com o intervalo + o nome; "Notas" + três quadradinhos de 10 px com as
   classes da Parte 1 + "iguais", "divergência adjacente", "divergência extrema".
4. `round-agreement-section.tsx`: `Section` com `hint={<SampleLine sample={sample} />}`; sai o
   banner. A legenda entra no fim da parte de concordância (depois do "Por definição", ou da tabela
   por critério quando ele não aparece) e antes do `AgreementNotes`; só com codebook. O ⓘ do
   título e o do cabeçalho ICR (`BAND_REFERENCE`, com Krippendorff e "não trava nada no projeto")
   ficam como estão.
5. Testes: `agreement-labels.unit` (`sampleText`, `isSmallSample`, `bandLegend`), `page.int`,
   `[roundId]/page.int`, `[roundId]/agreement/page.int`, `phase-4-reading.int`,
   `evaluate/page.int`, `agreement-outliers.int` (`[roundId]/page.int`, `phase-4-reading.int` e
   `evaluate/page.int` importam `AgreementWarnings`).

## Em cada Parte

`npm run lint`, `npx tsc --noEmit`, os testes listados e uma olhada no preview, na aba Rodadas e em
`/rounds/[roundId]/agreement`, comparando com `amostra.html`. O PoC (2 avaliadores, 10 respostas,
Query 1–5 × Relevance + Diversity) mostra amostra pequena e o caso de um critério só por
definição; para abas, um codebook com 2 ou mais critérios de definição e um específico que não
vale em todas; para outliers, marcar um avaliador.

**Fora:** a matriz de Qualidade (`quality-matrix-table.tsx`) e o "Ver por definição" dela; as
sugestões 2, 3 (outras formas da matriz), 6 (pior ICR primeiro) e 9 (coluna fixa).
