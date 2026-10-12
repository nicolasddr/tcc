# Plano A: os mesmos nomes e a mesma caixa em toda parte

Sugestão 9 da análise de 12/10 (`referencia-visual.html#s9`), retomada de 08/10.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Fases lidas de `PROJECT_PHASES`, "+ Novo projeto", selos com maiúscula, "Enviar itens" e o motivo da aba bloqueada | `refactor(textos): fases, novo projeto e selos com um nome só` | ✅ |

**Decidido (2026-10-12): "onboarding" fica.** A sugestão propunha trocar por "entrada no projeto",
mas o termo colide com *Item de entrada* e *Entrada enviada* do glossário. O usuário escolheu manter
"onboarding" na interface. Desta parte da sugestão, entram só a caixa ("Onboarding pendente" no
selo) e o texto da aba bloqueada.

## Contexto

- Arquivos:
  - `app/components/process-phases-footer.tsx` e `app/components/process-overview.tsx`;
  - `app/projects/[id]/phase-bar.tsx` (`PROJECT_PHASES`), `app/projects/labels.ts`;
  - `app/page.tsx`, `app/dashboard/page.tsx`, `app/projects/new/page.tsx`;
  - `app/projects/[id]/project-tabs.tsx`, `app/projects/[id]/(tabs)/layout.tsx`;
  - os 29 arquivos com `<Badge>` ou `<StatusBadge>` (`grep -rln "<Badge\|<StatusBadge" app`);
  - `app/projects/[id]/pipeline/items-editor.tsx`.
- Só texto: rotas, nomes de função, tipos e valores do banco não mudam.
- Testes que citam as frases de hoje: `app/projects/labels.unit.test.ts`,
  `app/projects/members.unit.test.ts`, `pipeline/preconditions.unit.test.ts`,
  `(tabs)/page.int.test.ts`, `(tabs)/phase-4-return.int.test.ts`, `(tabs)/items/page.int.test.ts`,
  `app/dashboard/page.int.test.ts`, `app/page.int.test.ts`. Procure também pela frase com
  minúscula: `'tudo pronto'`, `'faltam '`, `'aberta'`, `'onboarding pendente'`.

## Parte 1

**Hoje**
- O rodapé (`process-phases-footer.tsx`) e o guia do processo (`process-overview.tsx` ~130, ~150,
  ~175, ~193) digitam as fases à mão, em caixa de título: "Configuração Inicial", "Validação do
  Codebook". A barra de fase usa `PROJECT_PHASES`, em caixa de frase.
- Criar projeto tem três nomes: "+ Novo projeto" (dashboard ~202), "Criar Novo Projeto" (estado
  vazio do dashboard ~288 e home ~40) e "Criar novo projeto" (título de `projects/new/page.tsx`).
- Os selos misturam caixas: "tudo pronto", "faltam 2", "aberta", "fechada", "convite pendente",
  "onboarding pendente" (`(tabs)/layout.tsx` ~96 e dashboard ~233; a lista de membros já diz
  "Onboarding pendente"), "geral", "outlier", "vigente", "em aberto", "congelada", "sem critério
  próprio", "desativado", "liberado", "pronto", "já respondido nesta rodada", `FROZEN_BADGE_LABEL`
  ("codebook e prompt congelados") e as marcas de participação (`mark.short`).
- Itens vazios mostram o painel "Upload de itens" (`items-editor.tsx` ~400).
- A aba Rodadas bloqueada tem `title="Ainda não implementado"` (`project-tabs.tsx` ~16, `soon`),
  embora a tela exista: ela só está bloqueada para quem ainda não concluiu o onboarding.

**Proposta**
- **Fases**: o rodapé e o guia leem o nome de `PROJECT_PHASES[i].name` (o dashboard já importa de
  `@/app/projects/[id]/phase-bar`). Nenhum nome de fase digitado fora de `PROJECT_PHASES`. As
  classes `fp1`…`fp4` e `phase-1`…`phase-4` continuam.
- **Criar projeto**: todo botão diz "+ Novo projeto" (dashboard, estado vazio do dashboard, home).
  O título da página é "Novo projeto". O botão de envio continua "Criar projeto".
- **Selos com inicial maiúscula**, em todos os `<Badge>`: "Tudo pronto", "Falta 1"/"Faltam 2",
  "Aberta", "Fechada", "Convite pendente", "Onboarding pendente", "Geral", "Outlier", "Vigente",
  "Em aberto", "Congelada", "Sem critério próprio", "Desativado", "Liberado", "Pronto", "Já
  respondido nesta rodada", "Codebook e prompt congelados", "Fase 1 concluída".
  - Mude a string na origem (o literal ou a constante), não com CSS `first-letter`: o texto do
    markup é o que os testes e o leitor de tela recebem.
  - Constantes que também entram no meio de uma frase (ex.: `FROZEN_BADGE_LABEL`, `mark.short`)
    precisam de conferência: se a constante aparece no meio de uma frase, crie a forma do selo
    ao lado em vez de mudar a da frase.
  - Para "Onboarding pendente", use o `memberStatusLabel('pending_onboarding')` de `labels.ts`
    em vez de repetir o literal.
- **Itens**: o título do painel dos itens vazios vira "Enviar itens".
- **Aba bloqueada**: o `title` passa a "Disponível depois de concluir o onboarding". Confira em
  `project-tabs.tsx` (~110) que esse é o único caso em que a aba fica bloqueada (membro que não é
  Administrador nem Avaliador ativo). Se houver outro, o texto precisa servir aos dois.

**Pronto quando**
- `grep -rn "Configuração Inicial\|Validação do Codebook\|Validação do Prompt\|Validação Final" app`
  não acha nada.
- `grep -rn "Criar Novo Projeto\|Criar novo projeto\|Ainda não implementado" app` não acha nada.
- `grep -rn "<Badge[^>]*>[a-zà-ú]" app` não acha nada fora de testes.
- Home, dashboard (com projetos e vazio), Novo projeto e o projeto visto por um avaliador com
  `pending_onboarding` conferidos no navegador.
- Lint, typecheck e testes passam.
