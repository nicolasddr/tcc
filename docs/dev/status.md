# Status do projeto: o que está construído e o que é plano

O que a ferramenta é, em uma frase: um protótipo de TCC que implementa a
metodologia de Prompt Science de Shah (2025), um processo com humanos no loop,
papéis de administrador e avaliador, codebooks e métricas de concordância (ICR).
O glossário do domínio está em [CONTEXT.md](../CONTEXT.md). A stack é Next.js 16
(App Router) com Supabase só para auth e Drizzle como dono do schema, com
autorização na camada de aplicação (`lib/authz`, sem RLS no banco; ver
[camada-de-dados.md](./camada-de-dados.md) e
[ADR 0007](../adr/0007-migracao-para-drizzle-orm.md)).

> Onde está a verdade viva: o status por fatia mora em
> [`docs/issues/README.md`](../issues/README.md), na tabela do Épico 0, e o
> histórico real está no `git log`. Este documento é só a orientação de alto
> nível, o roadmap que não dá para derivar do código. Se ele divergir da tabela
> de issues ou do git, eles ganham.

## Marco atual: Épico 0 (Fundação)

Fundação mais gestão de projetos e membros. As fatias verticais estão em
[`docs/issues/`](../issues/) e o PRD em
[`docs/prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md).

Já construído (fatias 01 a 07, 09 e 10): login com Google via Supabase OAuth,
logout, editar perfil, criar, listar e gerenciar projetos (editar, concluir,
arquivar e reativar), convidar avaliador (tanto cadastrado quanto por e-mail
pendente até o primeiro login), aceitar convite com consentimento e onboarding,
perguntas de onboarding, remover avaliador e sair do projeto, além da trava de
transição de status de membro. Cada fatia tem teste de integração em Vitest,
verde, em `*.int.test.ts` ao lado da action (`npm test`, que precisa do Supabase
local), além da camada E2E em Playwright (ver [testes-e2e.md](./testes-e2e.md)).

Pendente no Épico 0: a fatia 08, de permissão de plataforma (HU-007, 008, 009 e
011), em que o super-admin aprova ou rejeita quem pode criar projetos. Ela ainda
não existe na main (não há `app/admin/` nem `app/permissions/`). Com o flip
Drizzle-only, será feita inteiramente na app-layer. A flag
`profiles.can_create_projects` já existe no schema, assim como o predicado
`canCreateProjects` em `lib/authz`; falta a tela do super-admin e o fluxo de
solicitação, decisão e notificação, tudo em TypeScript.

## Além do Épico 0 (ainda não construído)

O núcleo da metodologia de Prompt Science, descrito na landing page e no
[CONTEXT.md](../CONTEXT.md):

- Edição de codebook: definições (títulos, descrições e tipo) e critérios.
- Métricas de ICR e concordância: Krippendorff's Alpha como primária e Cohen's
  Kappa, com Qualidade como dimensão separada.
- O processo de fases 1, 2 e 3 (configurar pipeline, validar codebook e validar
  prompt). A Fase 4 está fora do escopo do protótipo, de propósito.

## Infra e performance

- Migração Drizzle-only concluída
  ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), status `accepted`,
  issue #22): RLS, policies, triggers e RPCs removidos, autorização 100% na
  app-layer (`lib/authz`), Drizzle dono do schema e testes migrados para o
  Vitest. O app não faz nenhuma chamada de dados ao `supabase-js`, só de auth.
  Detalhes e armadilhas em [camada-de-dados.md](./camada-de-dados.md).
- Latência de navegação e de auth diagnosticadas e corrigidas, conforme
  [performance.md](./performance.md).
- Deploy na Vercel com Supabase cloud, com checklist em [deploy.md](./deploy.md).

## Notas de banco não-óbvias

- O bootstrap do super-admin é manual: um insert na tabela `super_admins` pelo
  Studio, mantido fora do git.
- O provisionamento no primeiro login é app-layer. O
  `provisionUserOnFirstLogin` ([`lib/auth/provision.ts`](../../lib/auth/provision.ts)),
  chamado pelo `app/auth/callback/route.ts`, cria o perfil e vincula convites por
  e-mail pendentes; ele substituiu o antigo trigger `handle_new_user` e é
  idempotente. Usuários criados em `auth.users` antes disso precisariam de um
  backfill único de `auth.users` para `profiles`.
- O Drizzle é dono do schema: mudanças saem de `lib/db/schema.ts` mais
  `drizzle-kit generate`, com o baseline em `supabase/migrations/0000_baseline.sql`
  (ver [`lib/db/README.md`](../../lib/db/README.md)). Não há grants por papel, RLS
  nem triggers a manter, já que a conexão única (`ownerDb`) é dona das tabelas.
