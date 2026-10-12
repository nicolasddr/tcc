# Plano B: uma barra do topo e a fase em todas as abas

Sugestão 2 da análise de 12/10 (`referencia-visual.html#s2`). Faça depois do Plano A.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | `AppTopBar` em todas as telas logadas: marca, trilha, sino, avatar e "Sair" | `feat(shell): barra do topo única nas telas logadas` | ✅ |
| 2 | Selo da fase ao lado do título, descrição como subtítulo, sem "Ativo", e o dashboard sem o rodapé de fases | `feat(projeto): fase e descrição no cabeçalho de todas as abas` | |

## Contexto comum

- Arquivos:
  - `app/components/ui/shell.tsx` (`PageShell`, `TopBar`, `BackLink`, `PageTitle`);
  - `app/dashboard/page.tsx` (é onde a barra completa existe hoje, ~149–181);
  - `app/components/notification-bell.tsx` (client; recebe `InboxItem[]` prontos);
  - `app/projects/[id]/(tabs)/layout.tsx` e `app/projects/[id]/project-tabs.tsx`;
  - as outras telas logadas com `TopBar`: `app/projects/new/page.tsx`,
    `app/projects/[id]/onboarding/page.tsx`, `app/profile/page.tsx`,
    `app/admin/permissions/page.tsx`;
  - `app/components/process-phases-footer.tsx` (fica, porque a home também usa).
- A home (`app/page.tsx`) é deslogada e tem cabeçalho próprio: **não muda**.
- Latência: o layout `(tabs)` não re-renderiza ao trocar de aba, mas a primeira carga do projeto
  passa a buscar notificações e perfil. Faça isso numa função só, com `cache()` do React, e uma
  `transaction` só. Ver a memória da navegação lenta: nada de `loading.tsx`.

## Parte 1: `AppTopBar`

**Hoje**
- Só o dashboard tem o avatar (link para `/profile`), o `NotificationBell` e o "Sair". A consulta
  das notificações (30 mais recentes) e do nome do perfil está dentro do `page.tsx` do dashboard
  (~57–95), e o mapeamento para `InboxItem` em ~127–132.
- As outras telas logadas têm um `TopBar` com "← Meus projetos" (ou "← Voltar", no onboarding).
- Nenhuma tela logada mostra o nome do app.

**Proposta**
- **Carga**: extraia para `app/components/app-top-bar-data.ts` uma função
  `loadTopBar(userId)` (com `cache()`) que devolve `{ displayName, email, avatarUrl, initial,
  inbox }`. Ela lê os claims (`getClaims`), o `profiles.name` e as notificações, e monta os
  `InboxItem`. O dashboard passa a usá-la.
- **Componente** `app/components/app-top-bar.tsx` (server), `AppTopBar({ trail })`:
  - à esquerda, a marca ("✦ Engenharia de Prompt", o mesmo desenho do cabeçalho da home, sem o
    "protótipo"), com link para `/dashboard`. Abaixo de `sm` fica só o ✦, com `aria-label`;
  - depois, a trilha: `trail` é uma lista `{ label, href? }` separada por "/". O último item não
    tem link e leva `aria-current="page"`. Use `<nav aria-label="Trilha">`. Nomes longos são
    cortados com reticências (`truncate` com `min-w-0`);
  - à direita, o sino, o avatar com nome e e-mail (link para `/profile`, `title="Editar meu
    perfil"`) e o "Sair" de hoje. Abaixo de `sm`, o avatar fica sem nome e e-mail.
- **Trilhas**:
  - dashboard: "Meus projetos";
  - abas do projeto: "Meus projetos / {nome do projeto}" (o nome com link para a Visão geral);
  - onboarding (`onboarding/page.tsx`): "Meus projetos / {nome} / Onboarding";
  - novo projeto: "Meus projetos / Novo projeto";
  - perfil: "Meus projetos / Meu perfil";
  - permissões: "Meus projetos / Solicitações de permissão".
- O `BackLink` sai dessas telas, porque a trilha faz o papel dele. Se ficar sem uso, remova-o do
  `shell.tsx`.
- O `TopBar` de `shell.tsx` continua como a casca visual (borda e fundo), usada pelo `AppTopBar`.

**Pronto quando**
- As seis telas logadas mostram a mesma barra, e o sino funciona fora do dashboard (marcar como
  lida revalida a tela atual, conferir).
- Em 375 px a barra cabe numa linha, sem rolagem horizontal (medida no iframe).
- Trocar de aba no projeto não ficou mais lento (compare o tempo de navegação antes e depois).
- Lint, typecheck e testes passam (o teste do dashboard afirma o sino e o avatar; ajuste para
  o componente novo).

## Parte 2: selo da fase, descrição e "Ativo"

**Hoje** (`(tabs)/layout.tsx` ~84–113)
- O título vem com a descrição num ⓘ, o `StatusBadge` (inclusive "Ativo") e o selo de onboarding
  pendente. Abaixo, "Tipo de tarefa · papéis".
- A consulta do layout não traz `projects.phase`. A fase só aparece no `PhaseBar` da Visão geral.
- O dashboard tem `footer={<ProcessPhasesFooter />}`.

**Proposta**
- Inclua `phase: projects.phase` na consulta do layout.
- **Selo da fase** logo depois do `<PageTitle>`: um link para `/projects/{id}` com o texto "Fase N
  de 4 · {PROJECT_PHASES[N-1].name}" e uma seta, no estilo de `Badge` neutro. Na Visão geral ele
  também aparece; não há problema em repetir o `PhaseBar` logo abaixo.
- **Descrição**: sai do ⓘ e vira a primeira linha abaixo do título, em `text-sm text-muted`,
  cortada em uma linha (`truncate`). Para o texto inteiro não sumir, use `title={description}`.
  A linha "Tipo de tarefa · papéis" fica logo abaixo dela.
- **Status**: o `StatusBadge` só aparece para "Concluído" e "Arquivado". O selo "Onboarding pendente"
  (Plano A) continua.
- **Dashboard**: sai o `footer`. O `ProcessPhasesFooter` continua na home.
- Confira que o selo acompanha o avanço de fase: depois de "Avançar para a Fase N" na Visão geral,
  o selo do cabeçalho tem de mostrar a fase nova. O layout é compartilhado, então veja se o
  `revalidatePath` da action de avanço (em `pipeline/actions.ts`) atualiza o layout também. Se não
  atualizar, use `revalidatePath(\`/projects/${id}\`, 'layout')` na action. É a única mudança de
  servidor permitida aqui, e não muda regra nenhuma.

**Pronto quando**
- Em Codebook, Prompt, Itens, Rodadas, Avaliar, Membros e Ajustes o selo da fase aparece e leva à
  Visão geral.
- Projeto ativo não mostra "Ativo"; concluído e arquivado mostram o selo.
- A descrição aparece em uma linha e o texto completo fica no `title`.
- O selo muda logo depois de avançar de fase, sem recarregar a página.
- O dashboard não tem mais o rodapé de fases, e o guia do processo continua recolhido.
- Há teste do layout para o selo da fase e para a ausência de "Ativo". Hoje não existe
  `layout.int.test.ts` em `(tabs)`: crie um mínimo no estilo dos `page.int.test.ts` vizinhos
  **(TDD)**.
- Lint, typecheck e testes passam.
