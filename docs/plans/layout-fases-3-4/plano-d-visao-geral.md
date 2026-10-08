# Plano D: Visão geral do projeto

Ajustes **07 e 09** da referência visual `docs/plans/layout-fases-3-4/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Antes" e "Depois").

Independente dos outros planos.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Cartões numa grade só + fases concluídas recolhidas (ajuste 07) | `feat(visao-geral): fases concluídas recolhidas` | ✅ |
| 2 | Selo "codebook e prompt congelados" na barra de fases (ajuste 09) | `feat(visao-geral): selo de congelamento na fase 4` | ✅ |

## Contexto comum

- Arquivo central: `app/projects/[id]/(tabs)/page.tsx`. Componentes: `phase-bar.tsx`,
  `pipeline/pipeline-checklist.tsx` (Fase 1→2), `pipeline/phase-2-checklist.tsx`,
  `pipeline/phase-3-checklist.tsx`, `pipeline/phase-4-return.tsx`, `pipeline/freeze.ts`,
  `app/components/ui/disclosure.tsx`, `app/components/ui/stat.tsx`.
- Os links "Avançar fase" (`#avancar`) e "Voltar à Fase 3" (`#voltar`) da barra de fases precisam
  continuar levando ao painel certo, e o painel precisa estar visível (aberto) quando o link for usado.
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  a estrutura antiga antes de mudar. Testes afetados: `(tabs)/page.int.test.ts`,
  `(tabs)/phase-4-return.int.test.ts`, `(tabs)/phase.int.test.ts`.
- Verificação no navegador com projetos nas Fases 2, 3 e 4. Visão do Avaliador não muda (ele não vê os
  cartões de artefato nem os checklists).

## Parte 1: grade única de cartões e fases concluídas recolhidas (ajuste 07)

**Hoje**: o cartão "Avaliadores" fica sozinho numa grade de 3 colunas, e Codebook, Prompt e Itens vêm
noutra grade. No fim da página, todos os checklists desde a Fase 1 aparecem empilhados: na Fase 4 são
três painéis "concluída" + o painel "Para voltar à Fase 3".

**Depois**:

```
[Avaliadores 6] [Codebook 8] [Prompt v3] [Itens 42]     ← 4 col. no desktop, 2 no celular
… gráficos …
┌ Para voltar à Fase 3 ─────────── liberado ┐            ← só o painel da fase atual
└────────────────────────────────────────────┘
▸ Fases concluídas (3)                                   ← Disclosure, fechado
```

- Uma grade só: `sm:grid-cols-2 lg:grid-cols-4`. Para o Avaliador (sem `artifacts`), o cartão de
  Avaliadores continua sozinho; conferir que não estica para a largura toda de forma estranha.
- Painel da fase atual aberto: Fase 1 → `PipelineChecklist`; Fase 2 → `Phase2Checklist`; Fase 3 →
  `Phase3Checklist`; Fase 4 → `Phase4Return`.
- Os painéis das fases anteriores vão para um `Disclosure` "Fases concluídas (N)", fechado por padrão,
  na ordem de hoje. Na Fase 1 não há Disclosure.
- O `id="avancar"` passa a envolver só o painel da fase atual.

## Parte 2: selo de congelamento na barra de fases (ajuste 09)

**Hoje**: o congelamento da Fase 4 só aparece dentro das telas de Codebook e Prompt (`frozenMessage`).
A `PhaseBar` aceita `badge`, que a visão geral não passa.

**Depois**:

```
FASE 4 DE 4  [codebook e prompt congelados] ⓘ          [Voltar à Fase 3]
Validação final
```

- Na Fase 4, passar `badge` com um `Badge` neutro "codebook e prompt congelados" + `InfoTooltip`.
- Texto do ⓘ: reaproveitar o que já existe em `pipeline/freeze.ts` se servir; senão, constante nova lá
  mesmo, no sentido de "Codebook e prompt ficam como na rodada de referência enquanto o projeto estiver
  na Fase 4. Os metadados do prompt e os itens continuam editáveis. Para mudar, volte à Fase 3."
- **Só para o Administrador.** A `PhaseBar` aparece para qualquer membro (`isMember`), mas o selo fala
  de artefatos que o Avaliador não edita. Passar o `badge` com a mesma condição do `action`
  (`isAdmin && project.status === 'active'`) e `project.phase === PHASE_4`.
- No celular, o selo quebra para a linha de baixo sem empurrar o botão para fora (medir a 375 px).
