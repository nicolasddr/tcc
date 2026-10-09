# Plano B: Rodadas com o estado da rodada no topo

Sugestão **Rodadas** da referência visual: `docs/plans/melhorias-layout/referencia-visual.html#s-rodadas`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Cartão da rodada aberta no topo, com progresso por avaliador, "Gerar respostas" e "Fechar rodada" lado a lado e seleção de itens sob demanda | `feat(rodadas): cartão da rodada aberta no topo` | ✅ |
| 2 | Linha de atalhos e nova ordem quando não há rodada aberta | `feat(rodadas): atalhos para a leitura da rodada` | ⬜ |

O Plano C (resultados da rodada) vem logo depois e mexe nas tabelas desta mesma aba.

## Contexto comum

- Arquivos, todos em `app/projects/[id]/(tabs)/rounds/`: `page.tsx`, `generate-responses.tsx`,
  `close-round.tsx`, `agreement-panel.tsx` e `round-list.tsx`.
- Antes de mexer, leia `docs/CONTEXT.md` (Rodada, Concordância, Qualidade) e o `AGENTS.md`.
- Só layout: as actions, os limites de geração e o diálogo de fechar não mudam.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - antes de trocar uma frase, procure a antiga nos testes (`page.int.test.ts`,
    `generate-responses.int.test.ts`);
  - o `markupTextOf` também lê o texto dos ⓘ.
- Verificação:
  - **cena**: projeto na Fase 3; rodada 2 aberta; 3 avaliadores com progresso diferente; itens com
    e sem resposta;
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
