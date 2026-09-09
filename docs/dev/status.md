# Status do projeto: o que está construído e o que é plano

O que a ferramenta é, em uma frase: uma ferramenta de TCC que implementa a
metodologia de Prompt Science de Shah (2025), um processo com humanos no loop,
papéis de administrador e avaliador, codebooks e métricas de concordância (ICR).
O glossário do domínio está em [CONTEXT.md](../CONTEXT.md). A stack é Next.js 16
(App Router) com Supabase só para auth e Drizzle como dono do schema, com
autorização na camada de aplicação (`lib/authz`, sem RLS no banco; ver
[camada-de-dados.md](./camada-de-dados.md) e
[ADR 0007](../adr/0007-migracao-para-drizzle-orm.md)).

> Onde está a verdade viva: o status por fatia do Épico 0 mora em
> [`docs/issues/README.md`](../issues/README.md); o do Épico 1 mora nas issues do
> GitHub (`gh issue list`), e o histórico real está no `git log`. Este documento
> é só a orientação de alto nível, o roadmap que não dá para derivar do código.
> Se ele divergir das issues ou do git, eles ganham.

## Marco atual: Épico 1 (Configuração do pipeline)

A Fase 1 do processo de Shah virando tela: definições com título e tipo, texto do
prompt, itens de entrada e um teste de prompt que verifica o pipeline sem
persistir nada. O PRD é
[`epico-1-configuracao-do-pipeline.md`](../prd/epico-1-configuracao-do-pipeline.md)
e as fatias estão publicadas como issues no GitHub.

Já construído:

- **Fatia 11, documentos de domínio.** Glossário e ADRs alinhados às decisões do
  épico, antes das fatias de código: a Fase 4 definida, a Fase 1 corrigida para
  "verifica o pipeline sem persistir", o vocabulário de versão (em aberto e
  congelada) absorvido, e as ADRs 0008 e 0009 criadas. Ressalva: `docs/adr/` está
  no `.gitignore`, então as ADRs não estão versionadas.
- **Fatia 12 (prefactor), renomear a rota de respostas de perfil.** A tela que
  mostra as respostas do questionário de um membro saiu de `responses` para
  `app/projects/[id]/profile-answers/[userId]`, liberando a palavra Resposta para
  o conceito do glossário (a saída da LLM) antes que o Épico 2 crie a tela de
  avaliação. Sem mudança de comportamento.
- **Fatia 13, fase persistida.** A fase deixou de ser número fixo no código e
  virou estado do projeto: coluna `projects.phase` (inteiro, nasce em 1, com CHECK
  de 1 a 4 porque a Fase 4 está no escopo), na migration
  `0003_add_project_phase.sql`, lida pela `PhaseBar` em
  `app/projects/[id]/page.tsx`. Coberta por `phase.int.test.ts`.
- **Fatia 13b, aba de configuração da Fase 1.** Nasceu a rota
  `app/projects/[id]/pipeline`, visível como aba "Configuração" só para o
  Administrador ativo, com o checklist das três pré-condições de avanço
  (definição, texto de prompt e item de entrada) e as três seções ancoradas
  (`#definicoes`, `#prompt`, `#itens`) onde as fatias 14, 15 e 16 entram. A regra
  é a função pura `pendingRequirements`/`canAdvanceFromPhase1` em
  `pipeline/preconditions.ts`, que a fatia 18 reaproveita no avanço de fase. O
  portão é servidor: não-admin leva `notFound` (o mesmo para projeto inexistente,
  então a recusa não revela nada) e membro em `pending_onboarding` é redirecionado
  ao onboarding antes da rota. Coberta por `pipeline/page.int.test.ts` e
  `pipeline/preconditions.unit.test.ts`.

O que vem a seguir, na ordem em que as issues destravam: definições, prompt e
itens (14, 15 e 16) dentro da aba de configuração, o teste de prompt (17) e o
avanço para a Fase 2 (18). A fatia 19, do Administrador que também avalia, não
depende das outras.

## Épico 0 (Fundação): construído, menos a fatia 08

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

Pendente: a fatia 08, de permissão de plataforma (HU-007, 008, 009 e 011), em que
o super-admin aprova ou rejeita quem pode criar projetos. Ela ainda não existe na
main (não há `app/admin/` nem `app/permissions/`). Com o flip Drizzle-only, será
feita inteiramente na app-layer. A flag `profiles.can_create_projects` já existe
no schema, assim como o predicado `canCreateProjects` em `lib/authz`; falta a
tela do super-admin e o fluxo de solicitação, decisão e notificação, tudo em
TypeScript.

## Além do Épico 1 (ainda não construído)

O resto do núcleo da metodologia, descrito na landing page e no
[CONTEXT.md](../CONTEXT.md):

- O segundo e o terceiro tempo do codebook: descrições das definições e
  critérios, autorados na Fase 2 (ver
  [ADR 0001](../adr/0001-codebook-em-tres-tempos.md)).
- As entidades Rodada e Resposta, com o modelo e as versões gravados. Elas nascem na Fase 2, e
  portanto no Épico 2, porque a Fase 1 não persiste resposta nenhuma.
- Telas de avaliação, painel de discordância e as métricas de concordância:
  Krippendorff's Alpha como primária e Cohen's Kappa, com Qualidade como
  dimensão separada.
- As Fases 2, 3 e 4: validar o codebook, validar o prompt e testar a replicação.
  A Fase 4 está no escopo (ver
  [ADR 0004](../adr/0004-thresholds-como-referencia-sem-trava.md)); ela repete a
  avaliação com itens e avaliadores novos, sobre codebook e prompt congelados.

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
- `profiles.id` não tem FK para `auth.users`. A FK existia no baseline e foi removida
  em `0001_drop_profiles_auth_users_fk.sql`: ela inviabilizava o setup de
  desenvolvimento do README (Auth hospedado + Postgres local), onde o usuário nasce
  no `auth.users` remoto e o perfil é gravado no banco local. O vínculo entre os dois
  passa a ser só o id, mantido pelo provisionamento.
- O Drizzle é dono do schema: mudanças saem de `lib/db/schema.ts` mais
  `drizzle-kit generate`, com o baseline em `supabase/migrations/0000_baseline.sql`
  (ver [`lib/db/README.md`](../../lib/db/README.md)). Não há grants por papel, RLS
  nem triggers a manter, já que a conexão única (`ownerDb`) é dona das tabelas.
