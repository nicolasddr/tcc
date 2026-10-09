# Plano D: Membros e Ajustes dentro do projeto

Sugestão **Navegação** da referência visual: `docs/plans/melhorias-layout/referencia-visual.html#s-navegacao`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Membros e Ajustes viram abas e os chips informativos viram uma linha de texto | `feat(projeto): membros e ajustes como abas` | ✅ |
| 2 | Perguntas e Respostas de onboarding como subpáginas, nova ordem em Membros e Ajustes sem o bloco da equipe | `refactor(projeto): subpáginas de ajustes e membros` | ⬜ |

O cabeçalho e as abas valem para todas as telas do projeto, por isso este plano vem antes do Plano E
(Visão geral).

## Contexto comum

- Arquivos:
  - `app/projects/[id]/(tabs)/layout.tsx`;
  - `app/projects/[id]/project-tabs.tsx` (com o teste `project-tabs.unit.test.ts`);
  - `app/projects/[id]/members/page.tsx` e `settings/page.tsx`;
  - `app/projects/[id]/questions/page.tsx` e `profile-answers/[userId]/page.tsx`.
- Antes de mexer, leia `docs/CONTEXT.md` e o `AGENTS.md`. É Next 16: confira grupos de rota e
  layouts em `node_modules/next/dist/docs/`.
- Só layout: as regras de acesso das páginas (`notFound` e `redirect`) não mudam.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - mover com `git mv`, para manter o histórico;
  - procure "Voltar ao projeto", os títulos e a ordem antiga nos testes (`members/page.int.test.ts`,
    `settings/page.int.test.ts`, `profile-answers/[userId]/page.int.test.ts`).
- Verificação:
  - entre por `/dev/login` na `:3100` como administrador e como avaliador ativo;
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

**⚠ D1. Perguntas e Respostas de onboarding dentro de `(tabs)`.**
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
