# Plano B: Rodadas e resultados da rodada

Sugestões da referência visual (`docs/plans/melhorias-layout/referencia-visual.html`):
- **Rodadas** (`#s-rodadas`): Partes 1 e 2;
- **Resultados** (`#s-resultados`): Partes 3 e 5;
- **Uma explicação por bloco** (`#s-texto`), na parte das tabelas: Parte 4.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Cartão da rodada aberta no topo, com progresso por avaliador, "Gerar respostas" e "Fechar rodada" lado a lado e seleção de itens sob demanda | `feat(rodadas): cartão da rodada aberta no topo` | ⬜ |
| 2 | Linha de atalhos e nova ordem quando não há rodada aberta | `feat(rodadas): atalhos para a leitura da rodada` | ⬜ |
| 3 | Matrizes de Concordância e Qualidade com uma coluna por nome de critério | `refactor(rodadas): uma coluna por critério de mesmo nome nas matrizes` | ⬜ |
| 4 | Legendas longas em "Como ler esta tabela" e nenhuma frase repetida nos blocos | `refactor(rodadas): legendas em "Como ler esta tabela"` | ⬜ |
| 5 ⚠ | Revisão de discordâncias em linhas e navegação também no fim | `refactor(revisao): notas em linhas e navegação no fim` | ⬜ |

A ordem vai de cima para baixo da aba: o topo (1 e 2), as tabelas (3 e 4) e, por fim, a revisão que
se abre a partir dela (5). A Parte 5 **depende do Plano A, Parte 3**, que cria o `ScaleBadge`.

## Contexto comum

- Arquivos, todos em `app/projects/[id]/(tabs)/rounds/`:
  - `page.tsx`, `generate-responses.tsx`, `close-round.tsx`, `agreement-panel.tsx` e
    `round-list.tsx` (Partes 1 e 2);
  - `agreement-matrix.ts`, `agreement-matrix-table.tsx`, `quality-matrix-table.tsx` e
    `agreement-series-chart.tsx` (Partes 3 e 4);
  - `[roundId]/page.tsx` e `review-groups-list.tsx` (Partes 4 e 5).
- Antes de mexer, leia `docs/CONTEXT.md` e o `AGENTS.md`. No glossário, veja Rodada, Concordância,
  Qualidade e os estados da matriz: "não aplicável" (—), "sem nota", "sem variação" e "não
  calculável".
- Só layout: as actions, os limites de geração, o cálculo das métricas e o diálogo de fechar não
  mudam.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - antes de trocar uma frase, procure a antiga nos testes (`page.int.test.ts`,
    `generate-responses.int.test.ts`, `agreement-matrix.unit.test.ts`,
    `quality-matrix.unit.test.ts`, `[roundId]/page.int.test.ts`);
  - o `markupTextOf` lê o texto dos ⓘ e o conteúdo dos `Disclosure`; para afirmar que algo saiu da
    tela, use o aria-label ou a prop, não a ausência do texto.
- Verificação:
  - **cena de referência**: projeto na Fase 3; rodada 2 aberta; 3 avaliadores com progresso
    diferente; itens com e sem resposta; 3 definições, cada uma com o critério específico "Aderência
    à definição", e o critério geral "Justificativa clara"; divergências na revisão;
  - entre por `/dev/login` na `:3100`;
  - para gerar respostas sem chave da OpenAI, use a LLM falsa por `NODE_OPTIONS=--require`;
  - confira em 1280 px e em 375 px (medido em iframe);
  - limpe a cena antes do `npm test` e rode lint, typecheck e testes.

## Parte 1: cartão da rodada aberta

**Hoje** (`page.tsx` ~195–229) a aba abre com o `Section` "Gerar respostas na rodada N".
- O `GenerateResponses` mostra a lista inteira de itens, o botão e a lista "Respostas da rodada N".
- Logo depois vem o `Section` "Rodada N aberta" (`CloseRound`), com o resumo das versões, o
  `roundInputSummary` e "Fechar rodada N" em `dangerSolid`.
- O progresso de cada avaliador é o `EffortList` (`agreement-panel.tsx` ~76), que fica dentro da
  Concordância.

**Proposta** (esboço do DEPOIS):

```
┌ Rodada 2  [aberta] [Fase 3]                                       ⓘ ┐
│ Codebook v2 · Prompt v1 · aberta em 06/10/2026                       │
│ AVALIAÇÕES ENVIADAS                                                  │
│ Ana Souza ............................................. 3 de 4 ▓▓▓░ │
│ Bruno Lima ............................................ 1 de 4 ▓░░░ │
│ [Gerar respostas]  [Fechar rodada 2]                                 │
│ 4 respostas nesta rodada · 2 itens do pool ainda sem resposta        │
│ › Respostas da rodada 2 (4)                                          │
└──────────────────────────────────────────────────────────────────────┘
```

- **Novo componente** `open-round-card.tsx` (servidor), mostrado no topo quando há rodada aberta. Ele
  traz o número, um selo "aberta", a fase, a linha de versões com a data (`round.createdAt` +
  `formatDate`) e o progresso por avaliador.
- **Progresso**: cada avaliador aparece com "X de N" e um `ProgressBar`, em que N é
  `generated.length`. Extraia o `EffortList` para reaproveitar os selos de outlier, desativado e
  participação.
- **De onde sai o progresso**: com rodada aberta, o `focusRoundOf` devolve essa rodada
  (`rounds.ts:39`), e o progresso sai da Concordância. Sem rodada aberta, a Concordância da última
  rodada fechada continua mostrando o progresso como hoje.
- **Textos que mudam de lugar** (nenhum texto some):
  - `openRoundSummary`, `roundLockedMessage`, `roundInputSummary`, "Só existe uma rodada aberta por
    projeto." e "Fechar é ação sua…" vão para o ⓘ do cartão;
  - o help de "Gerar respostas" ("Cada resposta grava origem…") vai para o painel de geração.
- **Ações lado a lado**:
  - "Gerar respostas" (primário) abre a seleção;
  - "Fechar rodada N" (`CloseRound`) passa a ser `secondary` e abre o mesmo diálogo de hoje. O
    `dangerSolid` de confirmação, dentro do diálogo, continua. A sugestão geral de botões
    (`#s-botoes`) não foi escolhida, então só este botão muda.
- **Seleção de itens sob demanda**: o painel `GenerateResponses` só aparece logo abaixo do cartão
  (`id="gerar"`) quando a URL tem `?gerar`.
  - O botão é um link para `?gerar=1#gerar`, e o painel tem um "Cancelar" que tira o parâmetro.
  - O estado fica na URL porque precisa sobreviver à revalidação depois de gerar. Foi a lição da
    issue #60.
- **Ordem no painel**: primeiro os itens ainda sem resposta. Os já respondidos ficam num `Disclosure`
  "N itens já respondidos nesta rodada". O hint "De 1 a 5 itens…" e as mensagens de limite e de erro
  de hoje continuam no painel.
- **Lista "Respostas da rodada N"** (`generate-responses.tsx` ~260): vira um `Disclosure` fechado no
  cartão, para não ficar escondida atrás do `?gerar`.

**Pronto quando**
- Com rodada aberta, a aba começa pelo cartão.
- Gerar 1 item pelo painel funciona e o painel continua aberto depois da revalidação.
- "Fechar rodada" é secundário e abre o diálogo de sempre.
- O progresso mostra "X de N" por avaliador e não aparece duplicado na Concordância.
- 375 px está ok.
- Lint, typecheck e testes passam.

## Parte 2: atalhos e ordem sem rodada aberta

**Proposta**
- **Linha de atalhos** logo abaixo do cartão: "Ir para: Concordância · Qualidade · Rodadas do
  projeto (N)", com âncoras.
  - O `Section` da Concordância e o de "Rodadas do projeto" ganham `id` e `scroll-mt-6`. A Qualidade
    já tem `QUALITY_SECTION_ID`.
  - Só entram os links das seções que existem. Por exemplo, Qualidade só aparece quando há
    `focusQuality`.
- **Sem rodada aberta**: o `Section` "Nova rodada" fica no topo e "Rodadas do projeto" vem logo
  abaixo dele. Depois seguem a orientação de leitura, a comparação com a referência, a Concordância e
  a Qualidade. Nesse caso, a linha de atalhos tem só Concordância e Qualidade.
- A visão do avaliador (`evaluator-rounds.tsx`) não muda.

**Pronto quando**
- As âncoras levam a cada seção sem o título ficar escondido.
- Sem rodada aberta, a ordem é: Nova rodada, Rodadas do projeto, leitura.
- Os testes de ordem foram ajustados e lint, typecheck e testes passam.

## Parte 3: uma coluna por nome de critério nas matrizes

**Observação do usuário**: "Mudar somente a Aderência à definição. Manter a tabela definição x
critério." A proposta do card de trocar a matriz por uma lista (uma linha por par definição ×
critério) **não entra**. A tabela continua com definições nas linhas e critérios nas colunas, e o
que muda é a repetição de "Aderência à definição" em várias colunas.

**Hoje** o `matrixColumns` (`agreement-matrix.ts` ~44) cria uma coluna por critério: primeiro os
gerais, depois os específicos de cada definição. Com três definições que têm, cada uma, seu próprio
"Aderência à definição", o cabeçalho repete o nome três vezes. Cada linha fica com uma célula real e
duas "—" (`not_applicable`).

**Proposta**
- **Juntar colunas**: critérios **específicos** de definições diferentes que têm o mesmo nome passam
  a dividir uma coluna. Em cada linha, a célula é a do critério daquela definição.
- **Modelo da coluna**: a `MatrixColumn` passa a ter o nome, `isGeneral` e o critério de cada
  definição (ex.: um `Map` de `definitionId` para critério). O `measuredMatrix` procura a célula pelo
  critério da definição da linha.
- **Ordem**: os gerais vêm primeiro, como hoje, e depois os nomes específicos na ordem em que
  aparecem pela primeira vez.
- **"Não aplicável"** continua existindo. Aparece quando a definição da linha não tem critério com
  aquele nome.
- As duas tabelas usam a mesma função. Se o cálculo da matriz de qualidade não usar o
  `measuredMatrix`, aplique a mesma troca nele.
- Nos testes de unidade, acrescente o caso das 3 definições com "Aderência à definição": deve dar 1
  coluna e nenhum `not_applicable` nela.

Esboço do DEPOIS (os valores são ilustrativos):

```
Definição       │ Justificativa clara [geral] │ Aderência à definição
Informacional   │ sem variação                │ sem variação
Navegacional    │ …                           │ …
Transacional    │ 0,000                       │ 0,000
```

**⚠ B1. Chave para juntar as colunas.** Recomendado: o nome exato, depois de `trim`, diferenciando
maiúsculas de minúsculas, e só entre critérios específicos. Um critério específico com o mesmo nome
de um critério geral continua numa coluna separada. Confirmar antes de implementar.

**Pronto quando**
- Na cena de referência, as duas matrizes têm 2 colunas de critério e nenhum "—" em "Aderência à
  definição".
- Os testes de unidade cobrem o caso.
- Lint, typecheck e testes passam.

## Parte 4: "Como ler esta tabela" e uma explicação por bloco

**A regra**: cada bloco (`Section`) tem um título, **no máximo uma frase visível** (`hint`) e **um
ⓘ** (`help`), e a frase e o ⓘ não dizem a mesma coisa. Vale também "nenhum texto some": o texto
muda de lugar, mas não é apagado. O `section.tsx` não muda, e a regra não vira comentário.

**Hoje** a aba Rodadas tem 19 ⓘ, vários com legendas de três parágrafos, e há `hint` e `help` que se
repetem em parte.

**Proposta**
- **Novo componente** `rounds/how-to-read.tsx`: um `Disclosure` "Como ler esta tabela", fechado por
  padrão, com os parágrafos da legenda (um `<p>` por parágrafo, ou `preWrapClass`).
- **`agreement-matrix-table.tsx`** (~126): o rótulo `matrixVersionLabel` continua visível. O texto
  do ⓘ (`matrixVersionNote`, `MATRIX_SCOPE_NOTE` e `MATRIX_LEGEND`) vai para o "Como ler esta
  tabela".
- **`quality-matrix-table.tsx`** (~160): o `QualityScaleLegend` continua visível, porque é a chave
  das cores. O ⓘ (`matrixVersionNote` e `QUALITY_MATRIX_LEGEND`) vai para o "Como ler".
- **`agreement-series-chart.tsx`** (~222): o ⓘ com `BAND_REFERENCE` e `OUTLIER_SERIES_NOTE` vai para
  o "Como ler". O gráfico também aparece na Visão geral.
- **Divergências**: procure a legenda de divergência (extrema e adjacente) na revisão
  (`[roundId]/page.tsx` ~217 e `review-groups-list.tsx`) e no painel da rodada. Se for um ⓘ ou um
  parágrafo longo, recebe o mesmo tratamento.
- Aplique a regra aos `Section` da aba Rodadas. Por exemplo, "Concordância na rodada N" e "Rodadas do
  projeto" têm `hint` e `help` que se repetem em parte.

**Pronto quando**
- A contagem de ⓘ na aba Rodadas cai. Conte antes e depois, na cena de referência, pelos botões de
  tooltip.
- Os "Como ler esta tabela" começam fechados e, abertos, mostram o mesmo texto do ⓘ antigo.
- Lint, typecheck e testes passam.

## Parte 5: revisão em linhas (⚠ B2)

**⚠ B2. Esta parte continua?** A observação "Mudar somente a Aderência à definição" pode valer para
a sugestão inteira, e nesse caso a revisão fica como está. Recomendado: fazer, porque a observação
fala da matriz e a revisão é um problema à parte (2.529 px para uma resposta com 6 células).
Confirmar antes de implementar.

**Depende do Plano A, Parte 3**, que cria o `ScaleBadge` (pílula neutra com o marcador de 1 a 3
barras).

**Hoje** (`review-groups-list.tsx`, `Cell` em ~208 e `Note` em ~76) cada nota é um item alto, com
nome, selo da nota e um `Disclosure` "Justificativa". Quando não há justificativa, aparece "sem
justificativa" repetido. O `QueueNav` (`[roundId]/page.tsx` ~258) só existe no topo.

**Proposta**
- **Cada célula** (critério com o selo de divergência) mostra uma tabela curta com três colunas:
  avaliador (com o selo "outlier" e o `title` de hoje), nota (`ScaleBadge`) e justificativa.
  - A justificativa fica na própria linha, com `preWrapClass`, e não há mais `Disclosure`.
  - Sem justificativa, a coluna mostra "—".
- O tom `accent` da célula divergente, o selo de divergência e "Registrar a decisão" (consenso)
  continuam.
- Antes de remover o `NO_JUSTIFICATION_LABEL` (`divergence.ts:7`), confira se ele tem outros usos.
- **Navegação no fim**: "Resposta anterior" e "Próxima resposta" também aparecem no fim da lista
  (repetir o `QueueNav`).
- Em 375 px, a coluna de justificativa quebra linha, e a tabela não gera rolagem horizontal na
  página.

**Pronto quando**
- Uma resposta com 6 células fica bem mais curta.
- A justificativa aparece na linha, e "—" quando não há.
- A navegação existe no topo e no fim.
- 375 px está ok.
- Lint, typecheck e testes passam.
