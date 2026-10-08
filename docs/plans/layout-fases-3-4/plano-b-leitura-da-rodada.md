# Plano B: Ordem de leitura e comparação com a referência (tela de Rodadas)

Ajustes **01 e 02** da referência visual `docs/plans/layout-fases-3-4/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Antes" e "Depois").

Depende do **Plano A, Parte 1** só pela amostra de cor da Qualidade na tabela da Parte 2. Se o Plano A
ainda não estiver feito, a tabela sai sem a amostra e ela entra depois.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | "Por onde ler esta rodada" no topo, com atalho para a seção certa (ajuste 01) | `feat(rodadas): orientação de leitura no topo da rodada` | ✅ |
| 2 | Comparação com a referência em tabela e logo após a orientação (ajuste 02) | `feat(rodadas): comparação com a referência em tabela` | ⬜ |

## Contexto comum

- Arquivo central: `app/projects/[id]/(tabs)/rounds/page.tsx`. Ordem atual das seções do Administrador:
  gerar respostas/fechar ou nova rodada → Concordância (painel + matriz) → `ReadingGuidanceNote` →
  Qualidade (painel + matriz) → Comparação com a rodada de referência (Fase 4) → Rodadas do projeto.
- Só apresentação: textos da orientação (`reading-guidance-labels.ts`) e da comparação
  (`reference-comparison-labels.ts`) não mudam de sentido. **Sem veredito**: a tabela não tem coluna de
  diferença nem cor de melhor/pior (PRD do Épico 4, item 5).
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  a estrutura antiga antes de mudar. Testes afetados: `rounds/page.int.test.ts`,
  `rounds/phase-4-reading.int.test.ts`, `(tabs)/phase-4-return.int.test.ts`.
- Verificação no navegador com cena semeada de Fase 3 e de Fase 4 (memórias `vitest-como-runner-de-seed`,
  `preview-pane-faixa-preta`, `cena-no-banco-quebra-int-test`).

## Parte 1: orientação no topo, com atalho (ajuste 01)

**Depois**, para rodada da Fase 3 ou 4:

```
┌ Por onde ler esta rodada ───────────────────────────┐
│ O ICR está dentro da faixa: os avaliadores…          │
│ Ver a Qualidade ↓          (Fase 4: Ver a comparação ↓)
└──────────────────────────────────────────────────────┘
Concordância na rodada 5 ⓘ
…
```

- Mover `ReadingGuidanceNote` para antes da seção de Concordância (continua depois do bloco de
  gerar/fechar ou de nova rodada). Ajustar a margem (`mt-6` hoje).
- Dar `id="qualidade"` à seção de Qualidade, com `scroll-mt-6`. `Section`
  ainda não aceita `id`: acrescentar a prop ou envolver num `div`, como a visão geral faz com `#avancar`.
- O atalho depende da fase e do caso (decidido):

  | Fase | ICR dentro da faixa | ICR abaixo da faixa | Sem ICR |
  |---|---|---|---|
  | 3 | "Ver a Qualidade ↓" (âncora `#qualidade`) | "Abrir o codebook" (`/projects/[id]/codebook`) | sem atalho |
  | 4 | sem atalho | sem atalho | sem atalho |

  Na Fase 4 não há atalho porque, depois da Parte 2, a comparação com a referência fica logo abaixo da
  orientação, e o codebook está congelado. Textos do atalho como constantes em
  `reading-guidance-labels.ts`.
- Só a âncora `id="qualidade"` é necessária.

**A Parte 2 herda**: as âncoras e o lugar da orientação.

**Feito**: `ReadingGuidanceNote` recebe `projectId` e fica logo depois de nova rodada / fechar
rodada, com `mt-8`. O atalho sai de `guidanceShortcut(guidance, projectId)` em
`reading-guidance.ts` (`{ kind, href }` ou `null`), e o texto de `shortcutLabel(kind)`
(`QUALITY_SHORTCUT`, `CODEBOOK_SHORTCUT`). `Section` ganhou a prop `id`; a de Qualidade usa
`QUALITY_SECTION_ID` (`'qualidade'`) com `className="scroll-mt-6"`. O link é `OpenLink`. Hoje a
ordem na Fase 4 é orientação → Concordância → Qualidade → comparação → lista; a Parte 2 sobe a
comparação para logo depois da orientação (o teste de ordem em `phase-4-reading.int.test.ts` muda
junto).

## Parte 2: comparação em tabela, logo após a orientação (ajuste 02)

**Hoje** (`reference-comparison-panel.tsx`): uma frase "Rodada de referência: rodada 4, fechada em…" e
dois `Card`s lado a lado com versões, data, `AgreementValue` e `QualityValue` em texto.

**Depois**:

```
Codebook v4 · Prompt v3 nas duas
              Rodada 4          Rodada 6
              Fase 3 · ref.     Fase 4
ICR           0,741             0,688
■ Alto        62,5% (25)        50,0% (16)
■ Médio       25,0% (10)        34,4% (11)
■ Baixo       12,5% (5)         15,6% (5)
Notas         40                32
```

- Na página de rodadas, para foco da Fase 4, a seção "Comparação com a rodada de referência" sobe para
  logo depois da orientação, antes da Concordância.
- Tabela com `tabular-nums`, números alinhados à direita, `overflow-x-auto`. Colunas: referência
  primeiro, depois a rodada da Fase 4 (mesma ordem de hoje). Cabeçalho de coluna com "Rodada N" e
  "Fase 3 · referência" / "Fase 4", e o selo "aberta" quando for o caso. A data de fechamento vai numa
  terceira linha do cabeçalho ("fechada em 28/09/2026"), visível, porque `title` não funciona no toque.
- A frase `referenceSentence` sai: a linha "Codebook v4 · Prompt v3 nas duas" acima da tabela e o
  cabeçalho já dizem o mesmo.
- Com outlier, a tabela ganha uma linha logo abaixo de cada medida: "ICR sem os marcados como outlier",
  e o mesmo para Alto, Médio e Baixo, em texto `muted`. Se só um dos lados tiver outlier, o outro mostra
  "—". Não pode perder o valor "sem outlier" que hoje aparece.
- ICR não calculável: célula com "não calculável", como `AgreementValue` faz. Faixa de referência: o
  selo da faixa **não** aparece aqui (hoje `band={false}`).
- `noReferenceMessage` (sem rodada de referência) continua igual.
- **Atenção ao diálogo**: `ReferenceComparisonPanel` também aparece dentro do `<dialog>` de "Voltar à
  Fase 3" (`(tabs)/page.tsx`, `phase4ReturnData`). A tabela precisa caber em 512 px e não pode ter
  `InfoTooltip` lá dentro (memória `infotooltip-nao-cabe-em-dialog`).
- `ReferenceRoundLine` (linha da referência na lista de rodadas) fica para o Plano C.
