# Plano C: Navegação do projeto, Visão geral e dashboard

Sugestões da referência visual (`docs/plans/melhorias-layout/referencia-visual.html`):
- **Navegação** (`#s-navegacao`): Partes 1 e 2;
- **Visão geral e dashboard** (`#s-visao`): Partes 3, 4 e 5.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Membros e Ajustes viram abas e os chips informativos viram uma linha de texto | `feat(projeto): membros e ajustes como abas` | ⬜ |
| 2 | Perguntas e Respostas de onboarding como subpáginas, nova ordem em Membros e Ajustes sem o bloco da equipe | `refactor(projeto): subpáginas de ajustes e membros` | ⬜ |
| 3 | Checklist dentro do cartão da fase, pendências como ações curtas e sem o "N pendências ↓" | `feat(visao-geral): checklist dentro do cartão da fase` | ⬜ |
| 4 | Cartões de número, séries e chamada do avaliador só quando dizem algo | `refactor(visao-geral): números e séries só quando dizem algo` | ⬜ |
| 5 | Dashboard mostra a fase de cada projeto | `feat(painel): fase de cada projeto` | ⬜ |

A ordem vai de fora para dentro: primeiro o cabeçalho e as abas, que valem para todas as telas do
projeto (1 e 2), depois o conteúdo da Visão geral (3 e 4) e, por fim, o dashboard (5).

## Contexto comum

- Arquivos:
  - Partes 1 e 2:
    - `app/projects/[id]/(tabs)/layout.tsx`;
    - `app/projects/[id]/project-tabs.tsx` (com o teste `project-tabs.unit.test.ts`);
    - `app/projects/[id]/members/page.tsx` e `settings/page.tsx`;
    - `app/projects/[id]/questions/page.tsx` e `profile-answers/[userId]/page.tsx`.
  - Partes 3 a 5:
    - `app/projects/[id]/(tabs)/page.tsx` e `app/projects/[id]/phase-bar.tsx`;
    - `app/projects/[id]/pipeline/pipeline-checklist.tsx`, `phase-2-checklist.tsx` e
      `phase-3-checklist.tsx`;
    - `app/components/ui/stat.tsx` e `app/dashboard/page.tsx`.
- Antes de mexer, leia `docs/CONTEXT.md`, a ADR 0004 (com insumo faltando, a tela continua dizendo o
  que falta, e não só desabilitando o botão) e o `AGENTS.md`. É Next 16: confira grupos de rota e
  layouts em `node_modules/next/dist/docs/`.
- Só layout e texto: as regras de acesso das páginas (`notFound` e `redirect`) e as de avanço de fase
  (`pipeline/preconditions.ts` e os helpers dos checklists) não mudam.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - mover com `git mv`, para manter o histórico;
  - procure as frases e a ordem antigas nos testes: `members/page.int.test.ts`,
    `settings/page.int.test.ts`, `profile-answers/[userId]/page.int.test.ts`,
    `(tabs)/page.int.test.ts`, `(tabs)/phase.int.test.ts` e o teste do dashboard;
  - o `markupTextOf` lê o texto dos ⓘ;
  - ao escrever um texto de ajuda ou de ação, confira no código o que ele descreve.
- Verificação:
  - entre por `/dev/login` na `:3100` como administrador e como avaliador (ativo e com onboarding
    pendente);
  - use cenas nas Fases 1, 2 e 3, com pendência e sem pendência;
  - confira em 1280 px e em 375 px (medido em iframe); as abas não podem gerar rolagem horizontal na
    página;
  - limpe a cena antes do `npm test` e rode lint, typecheck e testes.

## Parte 1: Membros e Ajustes como abas

**Hoje**
- Membros, Ajustes e Perguntas usam um `PageShell` próprio, numa coluna estreita, sem o nome do
  projeto e sem as abas. A única saída é "← Voltar ao projeto".
- No cabeçalho, os links para essas páginas são `ChipLink` iguais aos chips informativos (`Chip` de
  tipo de tarefa e de papéis, em `layout.tsx` ~105–125).

**Proposta** (esboço do DEPOIS):

```
Classificação de intenção de busca ⓘ [Ativo]
Classificação · Administrador e Avaliador
[Visão geral] [Codebook] [Prompt] [Itens] [Rodadas] [Avaliar]  |  [Membros] [Ajustes]
```

- **Mover as rotas**: `git mv` de `app/projects/[id]/members` e `.../settings` para
  `app/projects/[id]/(tabs)/`. As URLs não mudam, porque `(tabs)` é um grupo de rota. Depois, corrija
  os imports relativos (ex.: `../member-list` passa a ser `../../member-list`).
- **Páginas sem moldura própria**: elas perdem `PageShell`, `TopBar`, `BackLink` e `PageTitle`,
  porque o layout já traz isso. O layout é `wide`, então limite a largura do conteúdo (ex.:
  `max-w-3xl`) se os formulários ficarem largos demais.
- **`project-tabs.tsx`**:
  - O `ProjectTab` ganha `'members' | 'settings'`.
  - O `activeTab` mapeia `members` e `profile-answers` para `members`, e `settings` e `questions`
    para `settings`. Isso já deixa a Parte 2 pronta.
  - Membros e Ajustes ficam num grupo à direita (separador + `ml-auto`), com `UsersIcon` e
    `SlidersIcon`.
  - Quem vê cada aba é o mesmo de hoje: Membros com `isActiveMember`, Ajustes com `isAdmin`. Para
    isso o componente ganha uma prop nova.
  - Atualize o `project-tabs.unit.test.ts`.
- **`layout.tsx`**: os chips e `ChipLink` saem. No lugar entra uma linha de texto discreta, "{tipo de
  tarefa} · {papéis unidos por ' e '}". O selo "onboarding pendente" continua.

**Pronto quando**
- `/members` e `/settings` mostram o nome do projeto e as abas, com a aba certa ativa.
- O avaliador vê Membros e não vê Ajustes.
- Quem não tem acesso continua recebendo `notFound`.
- Nada que não seja clicável parece botão.
- Lint, typecheck e testes passam.

## Parte 2: subpáginas, ordem em Membros e Ajustes enxuto

**⚠ C1. Perguntas e Respostas de onboarding dentro de `(tabs)`.**
- Recomendado: mover também `questions` e `profile-answers` para `(tabs)`. Assim elas ganham o
  cabeçalho do projeto, com a aba Ajustes ou Membros ativa.
- Alternativa: manter as duas fora do grupo e trocar só o link de volta.

Confirmar antes de implementar.

**Proposta**
- **Links de volta**: no corpo da página, "← Ajustes" (`/projects/{id}/settings`) em Perguntas de
  onboarding e "← Membros" (`/projects/{id}/members`) em Respostas de onboarding, ambos com
  `BackLink`. Eles substituem "← Voltar ao projeto".
- **Nova ordem em Membros** (`members/page.tsx` ~118–175):
  1. "Convidar avaliador", com a mesma condição de exibição de hoje;
  2. "Equipe do projeto";
  3. "Outliers por rodada";
  4. "Avaliar neste projeto".
- **Ajustes** (`settings/page.tsx` ~79–95): sai o bloco "Equipe do projeto → Gerenciar membros",
  porque a aba Membros já faz esse papel.

**Pronto quando**
- Perguntas e Respostas de onboarding voltam para Ajustes e Membros.
- Em Membros, "Convidar avaliador" é o primeiro bloco.
- Ajustes não tem mais o bloco da equipe.
- Os testes estão ajustados e lint, typecheck e testes passam.

## Parte 3: checklist dentro do cartão da fase

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

## Parte 4: números, séries e chamada do avaliador

**Observação do usuário**: a linha de atalhos com contagem do mockup ("Codebook v2 · 3 definições
› / Prompt v1 · Triagem simples › / Itens · 6 › / Membros · 3 avaliadores ›") **não entra**. Ficou
confusa e poluída.

**Hoje**
- Os quatro `StatCard` (`(tabs)/page.tsx` ~438) repetem o checklist. Na Fase 1 mostram "0
  definições", "—" e "0 no pool".
- "Concordância por rodada" aparece vazia antes da primeira rodada.
- O avaliador vê só "Avaliadores 0 · 1 em onboarding".

**⚠ C2. O que fica no lugar dos cartões de número.**
- Recomendado: manter os quatro cartões como estão hoje nas Fases 2 a 4 e escondê-los na Fase 1,
  onde o checklist já diz o que falta.
- Alternativa: tirar a linha de cartões de vez, já que as abas levam a cada lugar e o que falta
  está no checklist.

Confirmar antes de implementar.

**Proposta** (fora o C2)
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
- O administrador nas Fases 2 a 4 vê o que foi decidido no C2.
- Lint, typecheck e testes passam.

## Parte 5: dashboard com a fase

**Proposta**
- Inclua `projects.phase` na consulta do `app/dashboard/page.tsx` (~60–115), no `entry` de cada
  projeto.
- Ao lado dos papéis (~215), mostre "Fase N de 4, {nome da fase}", com `PROJECT_PHASES` e
  `TOTAL_PHASES` de `phase-bar.tsx`. Exemplo: "Administrador · Avaliador · Fase 3 de 4, Validação do
  prompt".

**Pronto quando**
- Cada projeto do dashboard mostra a fase.
- O teste do dashboard foi ajustado e lint, typecheck e testes passam.
