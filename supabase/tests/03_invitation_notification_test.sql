-- 03_invitation_notification_test.sql — convidar avaliador cadastrado +
-- notificação + listar/recusar (HU-018 parcial, HU-010, HU-019).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - o admin acha o convidado por e-mail (só id+name; negado a quem não cria projetos);
--   - convidar gera a notificação in-platform do convidado (trigger);
--   - não dá pra duplicar convite pendente (índice único) nem convidar membro ativo (trigger);
--   - terceiros não enxergam o convite nem a notificação (RLS);
--   - o convidado lista seus pendentes (RPC) com nome do projeto e de quem convidou;
--   - o convidado marca a notificação como lida e recusa o convite (status → declined).
-- Molde: ver projects_rls_test.sql (Issue 00). Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(15);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin03@test.local', 'Admin 03')::text, true);
select set_config('tests.invitee_id',
  tests.create_user('avaliador03@test.local', 'Avaliador 03')::text, true);
select set_config('tests.stranger_id',
  tests.create_user('stranger03@test.local', 'Estranho 03')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);

update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Como o admin autenticado ------------------------------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

-- Inserir o projeto dispara auto_add_creator_as_admin (admin vira membro ATIVO).
insert into public.projects (id, name, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 03',
        current_setting('tests.admin_id')::uuid);

-- HU-018: o admin acha o convidado por e-mail (só id+name, sem enumerar).
select is(
  (select id from public.find_invitee_by_email('avaliador03@test.local')),
  current_setting('tests.invitee_id')::uuid,
  'find_invitee_by_email devolve o id do usuário cadastrado para quem pode criar projetos'
);

-- Convidar: convite pendente (dispara notify_on_invitation).
insert into public.project_invitations (project_id, invitee_id, invited_by, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.invitee_id')::uuid,
        current_setting('tests.admin_id')::uuid, 'pending');

-- Unicidade: um segundo convite pendente para o mesmo par viola o índice único.
select throws_ok(
  $$ insert into public.project_invitations (project_id, invitee_id, invited_by, status)
     values (current_setting('tests.p1_id')::uuid, current_setting('tests.invitee_id')::uuid,
             current_setting('tests.admin_id')::uuid, 'pending') $$,
  '23505', null,
  'não é possível duplicar um convite pendente (índice único)'
);

-- Não convidar membro ativo: o admin já é membro ativo do próprio projeto.
select throws_ok(
  $$ insert into public.project_invitations (project_id, invitee_id, invited_by, status)
     values (current_setting('tests.p1_id')::uuid, current_setting('tests.admin_id')::uuid,
             current_setting('tests.admin_id')::uuid, 'pending') $$,
  'P0001', null,
  'não é possível convidar quem já é membro ativo (check_invitation_target)'
);

-- --- Um terceiro não enxerga nada do convite ---------------------------------
select tests.authenticate_as(current_setting('tests.stranger_id')::uuid);

select is(
  (select count(*)::int from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid),
  0,
  'um terceiro não enxerga o convite (RLS inv_select)'
);
select is(
  (select count(*)::int from public.notifications),
  0,
  'um terceiro não enxerga a notificação do convidado (RLS notifications_select_own)'
);
select is(
  (select count(*)::int from public.find_invitee_by_email('avaliador03@test.local')),
  0,
  'find_invitee_by_email não responde a quem não pode criar projetos (anti-enumeração)'
);

-- --- O convidado: vê, é notificado, marca como lida e recusa -----------------
select tests.authenticate_as(current_setting('tests.invitee_id')::uuid);

select is(
  (select count(*)::int from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid and status = 'pending'),
  1,
  'o convidado enxerga o próprio convite pendente'
);

-- HU-010: convidar gerou a notificação in-platform do convidado.
select is(
  (select count(*)::int from public.notifications where type = 'project_invitation'),
  1,
  'criar o convite gera uma notificação in-platform para o convidado'
);
select is(
  (select payload ->> 'project_name' from public.notifications
     where type = 'project_invitation' limit 1),
  'Projeto 03',
  'a notificação carrega o nome do projeto'
);
select is(
  (select payload ->> 'inviter_name' from public.notifications
     where type = 'project_invitation' limit 1),
  'Admin 03',
  'a notificação carrega o nome de quem convidou'
);

-- HU-019: a RPC lista os pendentes do convidado com nomes denormalizados (o
-- convidado não enxergaria o profile do admin pela RLS — driblado pela RPC).
select is(
  (select project_name from public.list_my_pending_invitations() limit 1),
  'Projeto 03',
  'list_my_pending_invitations devolve o nome do projeto ao convidado'
);
select is(
  (select inviter_name from public.list_my_pending_invitations() limit 1),
  'Admin 03',
  'list_my_pending_invitations devolve o nome de quem convidou'
);

-- Marcar como lida (grant por coluna só permite read_at).
update public.notifications set read_at = now()
  where type = 'project_invitation' and read_at is null;
select is(
  (select count(*)::int from public.notifications where read_at is not null),
  1,
  'o convidado consegue marcar a notificação como lida'
);

-- Recusar (status → declined).
update public.project_invitations set status = 'declined', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();
select is(
  (select status from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid()),
  'declined',
  'o convidado recusa o convite (status vira declined)'
);
select is(
  (select count(*)::int from public.list_my_pending_invitations()),
  0,
  'convite recusado some da lista de pendentes do convidado'
);

select * from finish();
rollback;
