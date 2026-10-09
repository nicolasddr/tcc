# Plano E: Visão geral e dashboard com o próximo passo em destaque

Sugestão **Visão geral e dashboard** da referência visual:
`docs/plans/melhorias-layout/referencia-visual.html#s-visao`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Checklist dentro do cartão da fase, pendências como ações curtas e sem o "N pendências ↓" | `feat(visao-geral): checklist dentro do cartão da fase` | ✅ |
| 2 | Cartões de número, séries e chamada do avaliador só quando dizem algo | `refactor(visao-geral): números e séries só quando dizem algo` | ⬜ |
| 3 | Dashboard mostra a fase de cada projeto | `feat(painel): fase de cada projeto` | ⬜ |

Faça este plano depois do Plano D, que muda o cabeçalho e as abas do projeto.

## Contexto comum

- Arquivos:
  - `app/projects/[id]/(tabs)/page.tsx` e `app/projects/[id]/phase-bar.tsx`;
  - `app/projects/[id]/pipeline/pipeline-checklist.tsx`, `phase-2-checklist.tsx` e
    `phase-3-checklist.tsx`;
  - `app/components/ui/stat.tsx` e `app/dashboard/page.tsx`.
- Antes de mexer, leia `docs/CONTEXT.md`, a ADR 0004 (com insumo faltando, a tela continua dizendo o
  que falta, e não só desabilitando o botão) e o `AGENTS.md`.
- Só layout e texto: as regras de avanço de fase (`pipeline/preconditions.ts` e os helpers dos
  checklists) não mudam.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - procure as frases e a ordem antigas nos testes (`(tabs)/page.int.test.ts`,
    `(tabs)/phase.int.test.ts` e o teste do dashboard);
  - o `markupTextOf` lê o texto dos ⓘ;
  - ao escrever um texto de ajuda ou de ação, confira no código o que ele descreve.
- Verificação:
  - use cenas nas Fases 1, 2 e 3, com pendência e sem pendência, e outra com o usuário dev só como
    avaliador (com onboarding pendente e ativo);
  - entre por `/dev/login` na `:3100`;
  - confira em 1280 px e em 375 px (medido em iframe);
  - limpe a cena antes do `npm test` e rode lint, typecheck e testes.

## Parte 1: checklist dentro do cartão da fase

**Hoje**
- O `PhaseBar` (`(tabs)/page.tsx` ~390) tem à direita "N pendências ↓", que só rola até `#avancar`,
  logo abaixo. Sem pendências, mostra "Avançar fase →".
- Cada checklist é um `Panel` com um `Card` por requisito, com título, duas ou três linhas de
  `pending`, "Resolver" e, no fim, o `AdvancePhase`.

**Proposta** (esboço do DEPOIS):

```
┌ FASE 3 DE 4                                                   ┐
│ Validação do prompt                                           │
│ ▓▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓▓▓▓ ░░░░░░                                   │
│ ───────────────────────────────────────────────────────────── │
│ Para avançar para a Fase 4                         [faltam 2] │
│ ○ Fechar a rodada 2 ⓘ                       Ir para Rodadas   │
│ ○ Fechar ao menos uma rodada da Fase 3 ⓘ    Ir para Rodadas   │
│ ✓ Codebook e prompt iguais aos da rodada de referência ⓘ      │
│ [Avançar para a Fase 4 →]  Faltam 2 pendências.               │
└───────────────────────────────────────────────────────────────┘
```

- O `PhaseBar` ganha `children`, mostrados abaixo de um separador no mesmo `Card`. O `page.tsx` passa
  o `currentChecklist` ali, junto com o `id="avancar"`.
- A `action` do `PhaseBar` perde "N pendências ↓" e "Avançar fase →", porque o `AdvancePhase` já
  está dentro do cartão.
- Na Fase 4, "Voltar à Fase 3" (`#voltar`) e o `Phase4Return` logo abaixo continuam como hoje.
- **Os três checklists** deixam de ser `Panel` com cartões. Ficam assim:
  - um cabeçalho "Para avançar para a Fase N" com o selo de hoje ("faltam N", "tudo pronto");
  - uma lista compacta em que cada item tem ícone ○ ou ✓ e uma **ação curta** (ex.: "Fechar a
    rodada 2");
  - um ⓘ logo depois do texto, com o porquê (o `pending` de hoje). O ⓘ fica à esquerda, perto do
    texto, porque o balão abre para a direita;
  - à direita, um link com destino ("Ir para Rodadas", "Ir para Codebook"…) no lugar de
    "Resolver". O destino vem do `route` de hoje;
  - itens prontos ficam com ✓ e sem link;
  - o `AdvancePhase` continua no fim.
- **Ações curtas**: são títulos novos no imperativo para cada requisito, escritos no lugar onde os
  requisitos são definidos. O texto longo de hoje vai para o ⓘ, então nenhum texto some.
- "Fases concluídas" (`Disclosure` no fim) usa a mesma forma compacta. A frase "A Fase 1 já foi
  concluída…" continua.

**Pronto quando**
- Nas Fases 1 a 3, o checklist está dentro do cartão da fase e não existe mais "N pendências ↓".
- Cada pendência ocupa uma linha, com ⓘ e "Ir para …".
- O avanço funciona com tudo pronto, e a Fase 4 não mudou.
- 375 px está ok.
- Lint, typecheck e testes passam.

## Parte 2: números, séries e chamada do avaliador

**Observação do usuário**: a linha de atalhos com contagem do mockup ("Codebook v2 · 3 definições
› / Prompt v1 · Triagem simples › / Itens · 6 › / Membros · 3 avaliadores ›") **não entra**. Ficou
confusa e poluída.

**Hoje**
- Os quatro `StatCard` (`(tabs)/page.tsx` ~438) repetem o checklist. Na Fase 1 mostram "0
  definições", "—" e "0 no pool".
- "Concordância por rodada" aparece vazia antes da primeira rodada.
- O avaliador vê só "Avaliadores 0 · 1 em onboarding".

**⚠ E1. O que fica no lugar dos cartões de número.**
- Recomendado: manter os quatro cartões como estão hoje nas Fases 2 a 4 e escondê-los na Fase 1,
  onde o checklist já diz o que falta.
- Alternativa: tirar a linha de cartões de vez, já que as abas levam a cada lugar e o que falta
  está no checklist.

Confirmar antes de implementar.

**Proposta** (fora o E1)
- **"Concordância por rodada"** só aparece com pelo menos uma rodada na série.
- **"Qualidade na rodada N"** e **"Qualidade por rodada"** só aparecem depois da primeira rodada. A
  regra de 2 pontos ou mais para a série, que veio da série anterior, continua. Confira o caso com
  zero rodadas.
- **Para o avaliador**, sai o cartão "Avaliadores". Confira quem recebe `artifacts` e o
  `activeEvaluators`. Fica a chamada "Conclua seu onboarding", que já existe (~374), ou, para o
  avaliador ativo, um atalho "Ir para Avaliar" (`ButtonLink` para `/projects/{id}/evaluate`).

**Pronto quando**
- A Fase 1 não tem cartões vazios nem série vazia.
- O avaliador não vê o cartão "Avaliadores" e tem uma ação clara.
- O administrador nas Fases 2 a 4 vê o que foi decidido no E1.
- Lint, typecheck e testes passam.

## Parte 3: dashboard com a fase

**Proposta**
- Inclua `projects.phase` na consulta do `app/dashboard/page.tsx` (~60–115), no `entry` de cada
  projeto.
- Ao lado dos papéis (~215), mostre "Fase N de 4, {nome da fase}", com `PROJECT_PHASES` e
  `TOTAL_PHASES` de `phase-bar.tsx`. Exemplo: "Administrador · Avaliador · Fase 3 de 4, Validação do
  prompt".

**Pronto quando**
- Cada projeto do dashboard mostra a fase.
- O teste do dashboard foi ajustado e lint, typecheck e testes passam.
