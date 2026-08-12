# PRD — Épico 0: Fundação

> Status: a maior parte já está construída (schema aplicado em 15/06; login, logout e dashboard no
> ar). Este PRD documenta o Épico 0 retroativamente e também especifica as revisões acordadas na
> sessão de refinamento. O vocabulário está em [`../CONTEXT.md`](../CONTEXT.md) e as decisões em
> [`../adr/`](../adr) e na série de ADRs da wiki (001 a 005).
>
> Sobre arquitetura: este PRD já reflete o flip Drizzle-only
> ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), issue #22), com autorização na camada de
> aplicação (`lib/authz`) e sem RLS, triggers ou RPCs no banco. Onde o texto cita objetos SQL
> (policies, triggers, RPCs), é sempre como nota histórica.

## Problema

Para usar a metodologia de prompt science, um pesquisador precisa de um lugar onde conduzir o
processo com mais de uma pessoa: criar um espaço de trabalho, trazer avaliadores e saber quem pode
fazer o quê. Hoje não existe essa base, e sem ela nenhuma das fases do processo (Fases 1 a 3)
funciona. O público real da avaliação inclui avaliadores externos, como alunos de um professor
convidado, que não têm conta na plataforma e não devem enfrentar atrito de cadastro.

## Solução

Uma fundação multiusuário onde:

- qualquer pessoa entra com Google, sem senha local e sem cadastro;
- um Super-admin controla quem pode criar projetos;
- um Administrador de Projeto cria um Projeto, convida Avaliadores por e-mail (mesmo que ainda não
  tenham entrado na plataforma) e gerencia os membros;
- um Avaliador aceita o convite, passa por um onboarding com consentimento e perguntas de perfil, e
  então participa;
- tudo é protegido por autorização na camada de aplicação (`lib/authz` mais escopo explícito nas
  queries), de modo que cada usuário só enxerga os projetos e dados de que participa.

## Histórias de usuário

**Autenticação e perfil**

1. Como visitante, quero entrar na plataforma com minha conta Google, para acessar sem criar senha
   (qualquer conta Google, sem restrição de domínio).
2. Como usuário de primeira viagem, quero que meu perfil (nome e e-mail) seja criado automaticamente
   a partir do Google, para não preencher cadastro.
3. Como usuário, quero encerrar minha sessão em todos os dispositivos, para garantir que ninguém
   continue logado em meu nome.
4. Como usuário, quero atualizar meu nome no perfil, para que ele apareça correto em todas as telas,
   sem precisar reautenticar.

**Permissão de plataforma**

5. Como usuário autenticado, quero solicitar permissão para criar projetos, para poder conduzir meu
   próprio processo.
6. Como usuário que já tem permissão (ou já tem solicitação pendente), quero que a opção de
   solicitar não apareça ou seja bloqueada, para não enviar pedidos duplicados.
7. Como Super-admin, quero ver a fila de solicitações pendentes (nome, e-mail, data), para
   analisá-las.
8. Como Super-admin, quero aprovar ou rejeitar uma solicitação, para que a permissão do usuário seja
   ligada (na aprovação) e ele seja notificado do resultado.

**Notificações (in-platform)**

9. Como usuário, quero receber uma notificação na plataforma quando for convidado para um projeto,
   para saber que devo agir sobre o convite.
10. Como usuário, quero receber uma notificação quando minha solicitação de permissão for aprovada
    ou rejeitada, para saber o desfecho.
11. Como usuário, quero marcar notificações como lidas, para acompanhar o que já vi.

**Projeto**

12. Como usuário com permissão, quero criar um projeto com nome (obrigatório) e descrição
    (opcional), para iniciar um processo; ao criar, torno-me automaticamente o Administrador.
13. Como Administrador, quero declarar opcionalmente o tipo de tarefa do projeto (Classificação,
    Avaliação de qualidade, Geração, Não sei/Misto) ao criá-lo, para que a ferramenta personalize as
    tooltips de autoria do codebook mais adiante. *(emenda da HU-012,
    [ADR 0005](../adr/0005-ferramenta-agnostica-de-tarefa.md))*
14. Como usuário, quero ver todos os projetos de que participo, como Administrador ou Avaliador, com
    nome, meu papel e status, para navegar entre eles.
15. Como usuário que aceitou um convite mas ainda não concluí o onboarding, quero ver esse projeto na
    minha lista com um indicador de "onboarding pendente", para retomar de onde parei.
    *(revisão da HU-013)*
16. Como Administrador, quero editar nome e descrição do meu projeto, exceto quando ele estiver
    concluído ou arquivado (somente leitura).
17. Como Administrador, quero concluir um projeto para torná-lo somente leitura, ficando ele visível
    na lista com indicação visual. *(revisão da HU-015: cai o gate "após a Fase 4"; por ora a
    conclusão é a critério do Administrador, e o gate "após a Fase 3" entra quando o conceito de fase
    existir, a partir do Épico 1)*
18. Como Administrador, quero arquivar um projeto ativo para tirá-lo da lista padrão sem perder
    dados (visível com filtro, somente leitura).
19. Como Administrador, quero reativar um projeto concluído ou arquivado, para retomar o trabalho.

**Gestão de membros**

20. Como Administrador, quero convidar um Avaliador informando o e-mail, mesmo que a pessoa ainda não
    tenha entrado na plataforma; o convite fica pendente e é resolvido no primeiro login dela.
    *(revisão da HU-018,
    [ADR 0006](../adr/0006-convite-por-email-pendente-ate-primeiro-login.md))*
21. Como Administrador, quero ser impedido de convidar alguém que já é membro ativo, ou que já tem
    convite pendente para o mesmo projeto, para evitar duplicidade.
22. Como pessoa convidada por e-mail antes de ter conta, quero que, ao entrar pela primeira vez com
    Google, meus convites pendentes apareçam automaticamente (e eu seja notificado), para não
    depender de descobrir sozinho.
23. Como usuário, quero ver os convites pendentes que recebi (nome do projeto, quem convidou, data),
    para decidir sobre eles.
24. Como usuário, quero aceitar ou recusar um convite; ao aceitar, passo pelo onboarding antes de
    virar membro, e se eu abandonar o onboarding o convite volta a pendente.
25. Como Administrador, quero remover um Avaliador do projeto (com confirmação), preservando as
    avaliações dele; convites pendentes dele são cancelados.
26. Como Avaliador, quero sair voluntariamente de um projeto (com confirmação), preservando minhas
    avaliações.
27. Como Administrador, quero me adicionar como Avaliador no meu próprio projeto, passando pelo
    onboarding (consentimento e perguntas, se houver), aparecendo na lista com os dois papéis.
    *(revisão da HU-024: a linha de Avaliador do Administrador passa por `pending_onboarding` e
    consentimento, como qualquer Avaliador)*
28. Como membro, quero ver os membros do projeto e seus papéis e status, para saber com quem
    trabalho; membros inativos têm indicação visual.

**Onboarding de avaliadores**

29. Como Administrador, quero definir perguntas de onboarding, abertas ou de múltipla escolha com
    opção "Outro", para caracterizar o perfil dos avaliadores. *(confirma múltipla escolha e
    "Outro")*
30. Como Administrador, quero editar ou remover perguntas de onboarding; editar mantém as respostas,
    que passam a ser exibidas com o texto novo, e remover cascateia as respostas daquela pergunta.
31. Como Avaliador, antes de responder, quero ver uma declaração de finalidade e marcar um
    consentimento explícito, registrado com timestamp e snapshot do texto, para saber para que meus
    dados serão usados.
32. Como Avaliador, quero responder a todas as perguntas de onboarding, que são obrigatórias, para
    concluir minha entrada; só então passo a membro ativo.
33. Como Administrador, quero ver as respostas de onboarding de cada Avaliador (somente leitura),
    para caracterizar a amostra.

## Decisões de implementação

- **Stack:** Next.js 16 (App Router) com TypeScript e Supabase; acesso a dados via Drizzle ORM como
  dono do schema, com autorização na camada de aplicação (`lib/authz`) e o `supabase-js` restrito à
  autenticação ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), "Drizzle only", issue #22;
  antes era `supabase-js` direto sem ORM, depois Drizzle sob RLS). A sessão passa por um *proxy*, já
  que o Next 16 substituiu o middleware. Hospedagem na Vercel com Supabase Cloud. (ADR-001 da wiki;
  ele menciona "Next 14+" enquanto o código está no 16, divergência benigna a anotar.)
- **Autenticação:** só Google OAuth, qualquer conta (ADR-005 da wiki). O perfil é criado no primeiro
  login pelo `provisionUserOnFirstLogin` (`lib/auth/provision.ts`), chamado pelo
  `app/auth/callback/route.ts`, espelhando `name` e `email` do Google para `profiles`. É idempotente
  e substituiu o antigo trigger `handle_new_user`.
- **Modelo de dados** (`lib/db/schema.ts`, baseline `0000_baseline.sql`): `profiles`, `super_admins`,
  `platform_permission_requests`, `projects`, `project_members`, `project_invitations`,
  `notifications`, `onboarding_questions` e `onboarding_responses`. O super-admin fica em tabela
  separada (ADR-004 da wiki), consultada pelo predicado `isSuperAdmin` de `lib/authz`.
- **Permissões:** autorização 100% na app-layer, sem RLS no banco. Os predicados de `lib/authz`
  (`isMemberOf`, `isProjectAdmin`, `isProjectMember`, `sharesProjectWith`, `hasPendingInvitation`,
  `canCreateProjects`, `canViewResponse`, `canAnswerOnboarding`) espelham as antigas policies e são
  chamados antes de cada action ou página, ou junto delas. Ações sensíveis, como resolver um e-mail
  sem permitir enumeração, ficam em funções dedicadas (`findInviteeByEmail`). O escalonamento é
  impedido porque nenhuma action expõe a escrita de `role`, `can_create_projects` ou
  `evaluations_enabled` ao usuário comum.
- **Ciclo de vida do membership** (Opção A, ADR-003 da wiki): aceitar convite materializa a linha em
  `project_members` com `status = 'pending_onboarding'`; concluir o onboarding promove para `active`;
  abandonar deleta a linha e reverte o convite para `pending`. As listagens de membros ativos filtram
  o `pending_onboarding`. CHECK constraints garantem que um Avaliador ativo tenha consentimento e
  onboarding concluídos, e o Administrador criado via HU-012 é isento, entrando ativo sem onboarding.
- **Notificações:** somente in-platform, sem e-mail, emitidas em TypeScript pelas actions e pelo
  provisionamento, com `lib/notifications/invitation.ts` como fonte única do payload de convite.
- **Agregação de papéis:** o admin-avaliador tem duas linhas, uma por papel, e as listagens (US 14,
  27 e 28) agregam por usuário na camada de aplicação (`array_agg(role)`).

**Mudanças de schema necessárias** (revisões, em `lib/db/schema.ts`):

- Convite por e-mail pendente
  ([ADR 0006](../adr/0006-convite-por-email-pendente-ate-primeiro-login.md)): `project_invitations`
  ganha `invitee_email` e `invitee_id` passa a NULLABLE, preenchido na resolução. O provisionamento
  no primeiro login (`provisionUserOnFirstLogin`, `lib/auth/provision.ts`) passa a resolver os
  convites pendentes daquele e-mail, vinculando `invitee_id` e emitindo a notificação. Cai a
  validação "usuário já cadastrado" da US 20.
- Tipo de tarefa (US 13, [ADR 0005](../adr/0005-ferramenta-agnostica-de-tarefa.md)): `projects` ganha
  um campo de tipo, nullable, com os valores Classificação, Avaliação, Geração ou vazio. Ele só guia
  tooltips mais adiante e não ramifica comportamento.
- HU-015 re-ancorada: remover qualquer dependência da Fase 4. A transição para `completed` continua
  livre, a critério do Administrador, até o conceito de fase existir.

## Decisões de teste

- **Um seam, no ponto mais alto: as Server Actions e o `lib/authz`.** O comportamento do Épico 0 vive
  nas actions, nas páginas e nos predicados de autorização. Os testes de integração exercem uma
  action com um `userId` explícito e afirmam comportamento externo: o que esse usuário consegue ver
  ou fazer (a action autoriza ou recusa) e os efeitos colaterais de suas ações (linha de notificação
  criada, membro materializado, flag ligada). Não se testa detalhe de implementação, só o que um
  usuário observaria.
- **Ferramenta:** Vitest de integração (`*.int.test.ts` ao lado de cada action) rodando contra o
  Supabase local (`supabase start`), com fixtures em `test/helpers.ts` que criam usuários e projetos
  e trocam o `userId` entre asserções. Sem mockar app, com schema real. Comando único: `npm test`.
- **Prior art:** o harness original era pgTAP, que testava a RLS no banco personificando um usuário
  via `request.jwt.claims` e `set role authenticated`. Com o flip Drizzle-only (issue #22) a
  autorização foi para a app-layer e a verificação passou a ser o Vitest de integração.
- **Comportamentos a cobrir (exemplos):**
  - Não-membro não vê um projeto; membro ativo vê; convidado pendente vê o nome do projeto.
  - Criar projeto materializa o criador como Administrador ativo.
  - Convidar dispara notificação ao convidado.
  - Convidar um e-mail sem perfil cria convite pendente, e o primeiro login daquele e-mail resolve o
    convite e notifica.
  - Não dá para convidar membro ativo nem duplicar convite pendente (unique index).
  - Aceitar convite cria membro em `pending_onboarding`, oculto aos outros membros e visível ao
    próprio e ao admin; concluir o onboarding (consentimento e todas as respostas) promove a
    `active`; as CHECK constraints rejeitam Avaliador ativo sem consentimento.
  - Super-admin aprovando liga `can_create_projects` e notifica; não-super-admin não consegue
    resolver.
  - Projeto `completed` ou `archived` rejeita edição de nome e descrição.
  - Regressão de segurança (item 7): um membro inativo não deve conseguir reativar a própria linha
    (`inactive → active`), o que desfaria a remoção (HU-021) e a saída (HU-022). Com a autorização na
    app-layer, a garantia é que nenhuma Server Action expõe esse caminho: `removeMember` e
    `leaveProject` só emitem `active → inactive` (com `where status = 'active'`) e não existe action
    que reative a própria linha. O teste de integração fixa isso. (Nota histórica: quando havia RLS o
    furo era real, porque a policy `pm_update` liberava `user_id = auth.uid()`, e ele foi fechado por
    um trigger `BEFORE UPDATE`; o flip trocou o trigger pela ausência de caminho na app.)

## Fora do escopo

- Fases 1 a 3 (codebook, prompts, itens, respostas, avaliação, ICR), que ficam para o Épico 1 em
  diante.
- HU-023 (ligar e desligar avaliações de um membro), movida para o Épico 2 ou 3, junto do seu
  consumidor, que é a análise de concordância. A coluna `evaluations_enabled` já existe no schema (a
  antiga RPC `set_member_evaluations` foi removida no flip, e a HU será uma Server Action quando for
  entregue), mas a HU não é entregue aqui.
- Gate de "concluir só após a Fase 3" (US 17), que depende do conceito de fase (Épico 1 em diante).
- Notificações por e-mail, já que aqui só há in-platform.
- Trilha de auditoria: o `audit_log` foi removido, e será reintroduzido quando houver consumidor.
- Autenticação por e-mail e senha e MFA. O projeto é Google-only, e isso é adicionável depois
  (ADR-005 da wiki).
- Política de retenção de `notifications`, ainda em aberto, a confirmar com a orientadora.

## Notas adicionais

- Boa parte já está implementada: login com Google ponta a ponta, logout global, dashboard e as 9
  tabelas do domínio (hoje em `lib/db/schema.ts` e no baseline do Drizzle). Este PRD serve para
  documentar o que foi construído e para especificar as revisões pendentes (convite por e-mail, tipo
  de tarefa, AC de `pending_onboarding`, re-âncora da HU-015, consentimento da HU-024, múltipla
  escolha com "Outro" e trava da reativação de membro). O schema nasceu SQL-first, com RLS, triggers
  e RPCs, e foi migrado para Drizzle-only, com autorização na app-layer (ver
  [ADR 0007](../adr/0007-migracao-para-drizzle-orm.md)).
- Pendências de ratificação com a orientadora: a
  [ADR 0006](../adr/0006-convite-por-email-pendente-ate-primeiro-login.md), sobre convite por e-mail,
  ainda `proposed`, e o ciclo de vida do membership (Opção A, ADR-003 da wiki).
- Rastreabilidade: as 29 HUs originais estão em `wiki/requisitos/user-stories-index.md` e o modelo de
  dados em `wiki/analyses/der-inicial-sprint-1.md`.
