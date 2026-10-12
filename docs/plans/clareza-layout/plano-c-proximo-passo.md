# Plano C: Visão geral com um "Próximo passo" e um botão só

Sugestão 1 da análise de 12/10 (`referencia-visual.html#s1`). Faça depois dos Planos A e B.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Bloco "Próximo passo" com o único botão primário, demais pendências numa linha, "Avançar" só quando liberado, nas Fases 1, 2 e 3 | `feat(visao-geral): próximo passo com um botão só` | |

Uma Parte só: os três checklists usam os mesmos `PhaseChecklist` e `ChecklistItem`, e mudar o
componente muda as três fases de uma vez.

## Contexto

- Arquivos:
  - `app/projects/[id]/pipeline/checklist.tsx` (`PhaseChecklist`, `ChecklistItem`,
    `CHECKLIST_DESTINATIONS`);
  - `pipeline/pipeline-checklist.tsx`, `pipeline/phase-2-checklist.tsx`,
    `pipeline/phase-3-checklist.tsx`;
  - `pipeline/advance-phase.tsx`;
  - `app/projects/[id]/phase-bar.tsx`;
  - `app/projects/[id]/(tabs)/page.tsx` (~294–330 monta os checklists, ~380–410 o `PhaseBar`).
- Leia a ADR 0004: com insumo faltando, a tela continua dizendo **o que** falta, não só desabilita.
- Só apresentação: `pipeline/preconditions.ts` (requisitos, `pending`, `phase2BlockerMessage`,
  `phase3BlockerMessage`) e a action `advancePhase` **não mudam**. A action continua recusando o
  avanço com pendência, e os testes `advance-phase-2/3.int.test.ts` ficam como estão.
- Testes afetados: `(tabs)/page.int.test.ts` (~532–570, ~843–858, ~1168–1241: contam
  "Ir para Rodadas", "faltam 2", "tudo pronto") e `(tabs)/phase.int.test.ts`.
- Cenas: Fase 1 com 0, 1, 2 e 3 pendências; Fase 2 com rodada aberta e sem rodada fechada; Fase 3
  com as três pendências e com a pendência "aguardando" (sem rodada de referência); Fase 4 (não
  muda); um avaliador sem papel de Administrador (não vê checklist).

## Parte 1

**Hoje**
- Cada pendência é uma linha com o título no imperativo, um ⓘ com o porquê (`pending` ou
  `phaseNBlockerMessage`) e "Ir para {Destino}" à direita. Todas com o mesmo peso.
- O `AdvancePhase` mostra o botão primário "Avançar para a Fase N" sempre, desabilitado enquanto há
  pendência, com a frase `hint` ao lado ("Faltam texto do prompt e item de entrada para liberar o
  avanço.").
- Na barra de fase, os rótulos das fases futuras usam `text-faint` (#9ca3af, 2,4:1 no cartão).

**Proposta** (esboço do DEPOIS, Fase 1 com 2 pendências)

```
┌ FASE 1 DE 4 · Configuração inicial                             [Faltam 2] ┐
│ ▓▓▓▓ ░░░░ ░░░░ ░░░░                                                         │
│ ─────────────────────────────────────────────────────────────────────────── │
│ PRÓXIMO PASSO                                                               │
│ Escrever o texto do prompt                                                  │
│ Escreva o texto do prompt que será enviado à LLM.                           │
│ [Ir para Prompt →]                                                          │
│                                                                             │
│ Para avançar para a Fase 2                                                  │
│ ✓ Definição · ● Texto do prompt · ○ Cadastrar um item de entrada            │
│ Falta item de entrada. “Avançar para a Fase 2” aparece aqui quando tudo     │
│ estiver pronto.                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Próximo passo**: novo componente `NextStep` em `checklist.tsx`. Recebe a **primeira** pendência,
  na ordem em que os requisitos já são definidos. Mostra:
  - o rótulo "Próximo passo" (pequeno, maiúsculo, como o "Fase N de 4");
  - o título no imperativo (o `label` de hoje, ex.: "Fechar a rodada 2");
  - o texto que hoje está no ⓘ, agora visível (`pending` ou `phaseNBlockerMessage`);
  - um único `ButtonLink` primário "Ir para {Destino}" com `ArrowRightIcon`, para o `route` de
    hoje.
- **Linha compacta**: o `PhaseChecklist` passa a mostrar todos os requisitos numa linha que quebra,
  separada por "·", na ordem de hoje:
  - feito: ✓ e o `title` (sem link), com o `sr-only` " pronto" de hoje;
  - atual (o mesmo do Próximo passo): em negrito, sem link, com `aria-current="step"`;
  - por fazer: o título no imperativo como link para o destino;
  - **sem ⓘ**. O porquê de cada pendência aparece quando ela vira o Próximo passo.
- **Avançar**: o `AdvancePhase` só renderiza o botão quando `blocked` é falso. Bloqueado, mostra uma
  linha de texto: o `hint` de hoje (que diz o que falta, ADR 0004) seguido de "“Avançar para a Fase
  N” aparece aqui quando tudo estiver pronto.". O diálogo de confirmação não muda.
- **Um primário por render**: com pendência, o único primário é o do Próximo passo; sem pendência,
  é o "Avançar para a Fase N". Confira que o `PhaseBar` não recebe outro primário nas Fases 1 a 3
  (o "Ir para Avaliar" só existe para quem não é Administrador).
- **Selo**: o "Faltam N"/"Tudo pronto" de hoje (já com maiúscula, Plano A) sobe para a linha do
  "Fase N de 4", no `badge` do `PhaseBar`, e o cabeçalho "Para avançar para a Fase N" fica sem selo.
- **Fases concluídas** (`Disclosure` no fim da página): só a linha compacta, toda com ✓, e a frase
  "A Fase N já foi concluída…" de hoje. Sem Próximo passo e sem Avançar.
- **Barra de fase**: rótulo de fase ainda não alcançada passa de `text-faint` a `text-muted`. A
  diferença entre alcançada e futura fica na barra (`bg-brand` × `bg-line`) e no `aria-current`.

**⚠ C1. A pendência "aguardando" da Fase 3** ("Codebook e prompt iguais aos da rodada de
referência" sem rodada de referência, com o ⓘ `NO_REFERENCE_ROUND`). Ela não é uma pendência que o
usuário resolve, e por isso nunca vira o Próximo passo; sem o ⓘ, a explicação some.
- Recomendado: na linha compacta, ela aparece em `text-muted` com o texto curto "aguardando a rodada
  de referência" ao lado. A frase longa de `NO_REFERENCE_ROUND` vai para o `title` do item.
- Alternativa: manter o ⓘ só nesse item, como exceção.

Confirmar antes de implementar.

**Passos**
1. **(TDD)** Em `(tabs)/page.int.test.ts`, reescreva os casos de checklist da Fase 1 (~532), Fase 2
   (~566) e Fase 3 (~1168–1241) pela regra nova: o texto do `pending` da primeira pendência está
   visível (use o `glanceTextOf`, porque o `markupTextOf` também lê balões), há exatamente um
   "Ir para …" como botão, nenhum `InfoTooltip` dentro do checklist, e o botão "Avançar" não existe
   com pendência. Leia cada vermelho.
2. `NextStep` e a linha compacta em `checklist.tsx`. O `ChecklistItem` vira a peça da linha
   compacta (ou é substituído); remova o que ficar sem uso.
3. Os três checklists passam a primeira pendência para o `NextStep` e o selo para o `PhaseBar`
   (o `page.tsx` monta isso; veja como o `currentChecklist` chega ao `PhaseBar`).
4. `AdvancePhase` sem botão quando bloqueado.
5. `phase-bar.tsx`: `text-faint` → `text-muted`.

**Pronto quando**
- Nas Fases 1, 2 e 3, com pendência, há um botão primário só, o do Próximo passo, e ele leva à aba
  certa.
- O porquê da pendência atual aparece sem hover.
- Com tudo pronto, o Próximo passo some e o "Avançar para a Fase N" aparece como primário; o avanço
  funciona (teste um de verdade na cena).
- Fases concluídas e Fase 4 conferidas.
- Em 375 px a linha compacta quebra sem rolagem horizontal.
- Lint, typecheck e testes passam.
