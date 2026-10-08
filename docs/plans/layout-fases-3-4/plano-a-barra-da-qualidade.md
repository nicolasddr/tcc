# Plano A: Qualidade em barra empilhada (painel, matriz e série)

Ajustes **03, 04 e 08** da referência visual `docs/plans/layout-fases-3-4/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Antes" e "Depois").

Faça este plano primeiro: os Planos B e C reaproveitam a barra que a Parte 1 cria.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Componente da barra empilhada + `QualityPanel` usando ele (ajuste 03) | `feat(rodadas): qualidade em barra empilhada` | ✅ |
| 2 | Matriz de Qualidade compacta (ajuste 04) | `feat(rodadas): matriz de qualidade compacta` | ⬜ |
| 3 | "Qualidade por rodada" como barras (ajuste 08) | `feat(visao-geral): série de qualidade em barras` | ⬜ |

## Contexto comum

- Só apresentação: nenhum cálculo muda (`quality.ts` e `quality-series.ts` ficam como estão).
- **Sem cor de aprovado.** O PRD dos Épicos 3 e 4 proíbe veredito e meta para a Qualidade. A barra usa
  três tons de **um mesmo azul** (Alto escuro, Médio médio, Baixo claro), nunca verde, amarelo ou
  vermelho. Na referência: `#1e3a8a`, `#6b8fd6`, `#c9d6f2`. Se precisar de token novo, criar em
  `app/globals.css` no bloco `@theme` (ex.: `--color-quality-high/medium/low`).
- A ordem dos níveis vem de `SCALE` (`(tabs)/evaluate/scale.ts`), e o rótulo de `scaleLabel`.
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  o texto/estrutura antiga antes de mudar (`grep-texto-antigo-nos-testes`). Testes de tela inspecionam a
  árvore de elementos, ver `app/projects/[id]/(tabs)/rounds/page.int.test.ts`.
- Verificação no navegador: cena semeada como em `vitest-como-runner-de-seed`, `/dev/login` na `:3100`,
  contornos do painel em `preview-pane-faixa-preta`. Limpar a cena no fim (`cena-no-banco-quebra-int-test`).

## Parte 1: barra empilhada no painel de Qualidade (ajuste 03)

**Hoje** (`(tabs)/rounds/quality-panel.tsx`, `QualityLevels`): uma barra cinza (`bg-faint`) por nível,
três barras iguais, com "Alto · 62,5% · 25 notas" em cima de cada uma.

**Depois**:

```
Qualidade
40 notas
[████████████████▓▓▓▓▓▓░░░]          ← uma barra de 100%, três tons de azul
■ Alto 62,5% (25)  ■ Médio 25% (10)  ■ Baixo 12,5% (5)
```

- Criar `QualityBar` (ex.: em `(tabs)/rounds/quality-bar.tsx`) que recebe `levels: QualityLevel[]` e
  um tamanho (`md` para o painel, `sm` para matriz/série). `aria-hidden` na barra, porque a legenda
  carrega os números. Opcional: `title` em cada fatia com `levelText(level)`.
- Uma legenda com amostra de cor (quadradinho) + rótulo + % + contagem em `(n)`. Pode ser um
  componente `QualityLegend` exportado junto, para a Parte 3 usar a versão "só cores".
- `QualityPanel` troca `QualityLevels` por barra + legenda, no caso simples e no par com/sem outlier.
- Ajustar `rounds/page.int.test.ts`, `(tabs)/page.int.test.ts` e o que mais buscar a estrutura antiga.

**A Parte 2 herda**: `QualityBar` com tamanho `sm` e a amostra de cor (`QualitySwatch`), em
`(tabs)/rounds/quality-bar.tsx`, junto com `QualityLegend`. Tokens `--color-quality-high/medium/low`
em `app/globals.css`. Cada fatia já leva `title` com `levelText(level)`; fatia de 0% é renderizada com
largura zero (o teste de cor conta três fatias por barra).

## Parte 2: matriz de Qualidade compacta (ajuste 04)

**Hoje** (`(tabs)/rounds/quality-matrix-table.tsx`, `Levels`): cada célula tem três linhas
"Alto 50% (4) / Médio 25% (2) / Baixo 25% (2)" com `whitespace-nowrap`; seis linhas com outlier.

**Depois**: cada célula tem a `QualityBar` `sm` e uma linha "50 · 25 · 25" (percentuais na ordem
Alto · Médio · Baixo, sem o símbolo %). O detalhe completo (`levelText` dos três níveis) vai no `title`
da célula. Abaixo da tabela, uma legenda de cores: "■ Alto · ■ Médio · ■ Baixo, em %".

- Com outlier, a célula mantém os dois blocos ("com todos" e "sem os marcados como outlier"), cada um
  com a sua barra e a sua linha de números.
- Estados "não avaliada" e "não se aplica" ficam como estão.
- A legenda longa `QUALITY_MATRIX_LEGEND` continua no `InfoTooltip` do rodapé. Trocar o trecho "com a
  contagem ao lado" por algo como "a barra e os percentuais em Alto · Médio · Baixo; a contagem aparece
  ao passar o mouse na célula".

**A Parte 3 herda**: a forma "barra + legenda de cores" já validada em tabela.

## Parte 3: "Qualidade por rodada" como barras (ajuste 08)

**Hoje** (`(tabs)/rounds/quality-series-list.tsx`, na visão geral): um `Card` por rodada com versões,
data e `QualityValue` em texto corrido, agrupado por fase.

**Depois**:

```
FASE 3
R3  cb v3 · pr v2   [██████▓▓▓▓▓▓░░░]
R4  cb v4 · pr v2   [████████▓▓▓▓▓░░]
R5  cb v4 · pr v3   [█████████▓▓▓▓░░]
FASE 4
R6  cb v4 · pr v3   [███████▓▓▓▓▓░░░]
■ Alto · ■ Médio · ■ Baixo
```

- Grade de duas colunas (rótulo da rodada | barra), barras alinhadas. Manter o agrupamento por fase
  (`phaseRuns`). Rodada aberta continua com o selo "aberta".
- Os números não somem, de duas formas: cada barra leva `title` com a distribuição completa e a
  contagem (bom no mouse), e logo abaixo da série há um `Disclosure` fechado, "Ver os números de cada
  rodada", com o `QualityValue` de hoje, uma linha por rodada (bom no toque, onde `title` não aparece).
- Com outlier: mostrar a barra "com todos" e, logo abaixo, uma barra mais fina "sem os marcados como
  outlier".
- Nada soma nem tira média entre rodadas (`QUALITY_SERIES_NOTE` continua valendo; pode virar ⓘ).
- No celular (375 px), a coluna do rótulo não pode empurrar a barra para fora. Medir no `iframe` de
  375, como diz a memória do painel.
