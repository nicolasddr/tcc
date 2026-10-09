# Plano C: Resultados da rodada

Sugestões da referência visual (`docs/plans/melhorias-layout/referencia-visual.html`):
- **Resultados** (`#s-resultados`): Partes 1 e 3;
- **Uma explicação por bloco** (`#s-texto`), na parte das tabelas: Parte 2.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Matrizes de Concordância e Qualidade com uma coluna por nome de critério | `refactor(rodadas): uma coluna por critério de mesmo nome nas matrizes` | ✅ |
| 2 | Legendas longas em "Como ler esta tabela" e nenhuma frase repetida nos blocos | `refactor(rodadas): legendas em "Como ler esta tabela"` | ✅ |
| 3 ⚠ | Revisão de discordâncias em linhas e navegação também no fim | `refactor(revisao): notas em linhas e navegação no fim` | ⬜ |

A ordem vai das tabelas da aba Rodadas (1 e 2) para a revisão que se abre a partir delas (3).

Dependências:
- faça este plano **depois do Plano B**, que reorganiza o topo da mesma aba;
- a Parte 3 **depende do Plano A, Parte 3**, que cria o `ScaleBadge`.

## Contexto comum

- Arquivos, todos em `app/projects/[id]/(tabs)/rounds/`:
  - `agreement-matrix.ts`, `agreement-matrix-table.tsx`, `quality-matrix-table.tsx` e
    `agreement-series-chart.tsx` (Partes 1 e 2);
  - `[roundId]/page.tsx` e `review-groups-list.tsx` (Partes 2 e 3).
- Antes de mexer, leia `docs/CONTEXT.md` e o `AGENTS.md`. No glossário, veja os estados da matriz:
  "não aplicável" (—), "sem nota", "sem variação" e "não calculável".
- Só layout: o cálculo das métricas não muda.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - antes de trocar uma frase, procure a antiga nos testes (`agreement-matrix.unit.test.ts`,
    `quality-matrix.unit.test.ts`, `page.int.test.ts`, `[roundId]/page.int.test.ts`);
  - o `markupTextOf` lê o texto dos ⓘ e o conteúdo dos `Disclosure`; para afirmar que algo saiu da
    tela, use o aria-label ou a prop, não a ausência do texto.
- Verificação:
  - **cena de referência**: projeto na Fase 3, uma rodada avaliada, 3 definições, cada uma com o
    critério específico "Aderência à definição", e o critério geral "Justificativa clara";
    divergências na revisão;
  - entre por `/dev/login` na `:3100`;
  - confira em 1280 px e em 375 px (medido em iframe);
  - limpe a cena antes do `npm test` e rode lint, typecheck e testes.

## Parte 1: uma coluna por nome de critério nas matrizes

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

**⚠ C1. Chave para juntar as colunas.** Recomendado: o nome exato, depois de `trim`, diferenciando
maiúsculas de minúsculas, e só entre critérios específicos. Um critério específico com o mesmo nome
de um critério geral continua numa coluna separada. Confirmar antes de implementar.

**Pronto quando**
- Na cena de referência, as duas matrizes têm 2 colunas de critério e nenhum "—" em "Aderência à
  definição".
- Os testes de unidade cobrem o caso.
- Lint, typecheck e testes passam.

## Parte 2: "Como ler esta tabela" e uma explicação por bloco

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

## Parte 3: revisão em linhas (⚠ C2)

**⚠ C2. Esta parte continua?** A observação "Mudar somente a Aderência à definição" pode valer para
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
