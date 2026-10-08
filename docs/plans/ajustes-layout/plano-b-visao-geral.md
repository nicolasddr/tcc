# Plano B: Cabeçalho do projeto e Visão geral

Ajustes **03, 04 e 05** da referência visual `docs/plans/ajustes-layout/referencia-visual.html`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | "← Meus projetos" e um só "Abrir rodadas" (ajustes 03 e 05) | `refactor(visao-geral): links de navegação sem repetição` | ✅ |
| 2 | Pendências junto do "Avançar fase" (ajuste 04) | `feat(visao-geral): pendências da fase no topo` | ⬜ |

## Contexto comum

- Página: `app/projects/[id]/(tabs)/page.tsx`. Barra de fases: `app/projects/[id]/phase-bar.tsx`.
- Convenções: sem comentários novos, sem `npx prettier`, buscar nos testes o texto e a ordem antigos
  antes de mudar (`grep-texto-antigo-nos-testes`; os testes de tela andam pela árvore de elementos).
- Verificação: cena com projeto na Fase 3, uma rodada fechada da Fase 2 e uma aberta da Fase 3 com
  avaliações (é a cena da referência), `/dev/login` na `:3100`, limpar no fim.

## Parte 1: "← Meus projetos" e um só "Abrir rodadas" (ajustes 03 e 05)

**03.** Todo `BackLink` com `href="/dashboard"` passa a dizer "Meus projetos" em vez de "Voltar":
`(tabs)/layout.tsx`, `projects/new/page.tsx`, `profile/page.tsx`, `admin/permissions/page.tsx`.
Os `BackLink` que apontam para outro lugar continuam como estão.

**05.** Na Visão geral, "Abrir rodadas" aparece três vezes seguidas: dentro de
`AgreementSeriesChart` (`(tabs)/rounds/agreement-series-chart.tsx`, linhas ~179 e ~248), no bloco
"Qualidade na rodada N" (`page.tsx`, ~488) e dentro de `QualitySeriesList` (`quality-series-list.tsx`, ~142).
- Tirar os três de dentro dos blocos e deixar **um** "Abrir rodadas →" no fim do grupo
  Concordância/Qualidade, em `page.tsx`. Os dois componentes só são usados na Visão geral (conferir);
  se a prop `projectId` ficar só para o link, removê-la.
- "Qualidade por rodada" só aparece com **2 pontos ou mais** (`qualityPoints.length > 1`). Com um ponto
  ela repete a "Qualidade na rodada N".

## Parte 2: pendências junto do "Avançar fase" (ajuste 04)

**Hoje**: o botão primário "Avançar fase" no `PhaseBar` está sempre ativo e é um link para `#avancar`,
no fim da página. Lá, o checklist da fase atual (`currentChecklist`) mostra "2 de 3 pendentes" e o
botão de verdade desabilitado.

**Proposta**:
- O bloco `#avancar` (checklist da fase atual) sobe para **logo abaixo do `PhaseBar`**, antes dos cards
  de número. Gráficos e "Fases concluídas" ficam depois.
- O botão do `PhaseBar` reflete o estado:
  - com pendências: botão **secundário** "N pendências ↓" (ou "1 pendência ↓"), ainda apontando para
    `#avancar`;
  - sem pendências: o primário "Avançar fase →" de hoje.
- A contagem de pendências precisa vir da mesma fonte que o selo "2 de 3 pendentes" dos checklists
  (procurar o helper que eles usam; não recalcular à parte).

**⚠ D1. Fase 4.** Na Fase 4 o bloco do fim é o `Phase4Return` (`#voltar`, "Voltar à Fase 3").
Recomendado: subir também, para que a ação da fase fique sempre logo abaixo da barra. Confirmar antes.
