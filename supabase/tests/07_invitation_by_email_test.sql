-- 07_invitation_by_email_test.sql — convite por e-mail pendente até o 1º login
-- (ADR 0006, Issue 07).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - o admin convida um E-MAIL que ainda NÃO tem conta (invitee_id NULL);
--   - o convite fica pendente e NÃO gera notificação antes do 1º login;
--   - não dá pra duplicar convite pendente pro mesmo e-mail (índice único, case-insensitive);
--   - convite sem alvo (id e e-mail nulos) é barrado (check inv_target_present);
--   - o 1º login com Google daquele e-mail (handle_new_user) RESOLVE o convite —
--     vincula o invitee_id e dispara a notificação in-platform (trigger de resolução);
--   - o convidado então enxerga o convite e o lista via RPC; um terceiro não vê nada.
-- Molde: ver 03_invitation_notification_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(13);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin07@test.local', 'Admin 07')::text, true);
select set_config('tests.stranger_id',
  tests.create_user('stranger07@test.local', 'Estranho 07')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);

update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Como o admin autenticado ------------------------------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

insert into public.projects (id, name, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 07',
        current_setting('tests.admin_id')::uuid);

-- Um e-mail sem conta não é encontrado (é justamente o caso que a fatia 07 destrava).
select is(
  (select count(*)::int from public.find_invitee_by_email('novo07@test.local')),
  0,
  'find_invitee_by_email não acha um e-mail que ainda não tem conta'
);

-- Convidar por e-mail (sem conta): invitee_id fica NULL, invitee_email guarda o alvo.
insert into public.project_invitations (project_id, invitee_email, invited_by, status)
values (current_setting('tests.p1_id')::uuid, 'novo07@test.local',
        current_setting('tests.admin_id')::uuid, 'pending');

select is(
  (select count(*)::int from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid
       and invitee_id is null and lower(invitee_email) = 'novo07@test.local'
       and status = 'pending'),
  1,
  'convite por e-mail fica pendente sem invitee_id'
);

-- Duplicado pendente pro mesmo e-mail é barrado (índice único, case-insensitive).
select throws_ok(
  $$ insert into public.project_invitations (project_id, invitee_email, invited_by, status)
     values (current_setting('tests.p1_id')::uuid, 'NOVO07@test.local',
             current_setting('tests.admin_id')::uuid, 'pending') $$,
  '23505', null,
  'não é possível duplicar um convite pendente pro mesmo e-mail (inv_one_pending_per_email)'
);

-- Convite precisa de um alvo: id e e-mail nulos violam o check inv_target_present.
select throws_ok(
  $$ insert into public.project_invitations (project_id, invited_by, status)
     values (current_setting('tests.p1_id')::uuid,
             current_setting('tests.admin_id')::uuid, 'pending') $$,
  '23514', null,
  'convite sem alvo (invitee_id e invitee_email nulos) é barrado (check inv_target_present)'
);

-- --- Volta ao superusuário: confirma que NADA foi notificado e faz o 1º login -
reset role;

select is(
  (select count(*)::int from public.notifications where type = 'project_invitation'),
  0,
  'convite por e-mail não gera notificação antes do 1º login (sem inbox p/ notificar)'
);

-- 1º login com Google daquele e-mail: handle_new_user cria o perfil e RESOLVE o
-- convite pendente (vincula invitee_id → dispara inv_notify_resolved).
select set_config('tests.invitee_id',
  tests.create_user('novo07@test.local', 'Novo 07')::text, true);

-- --- Como o admin: enxerga o convite já resolvido ----------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
select is(
  (select invitee_id from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid
       and lower(invitee_email) = 'novo07@test.local'),
  current_setting('tests.invitee_id')::uuid,
  'o 1º login vincula o invitee_id ao novo perfil (resolução)'
);

-- --- Como o convidado: vê o convite, foi notificado, lista os pendentes -------
select tests.authenticate_as(current_setting('tests.invitee_id')::uuid);

select is(
  (select count(*)::int from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid and status = 'pending'),
  1,
  'o convidado enxerga o próprio convite depois de resolvido (RLS inv_select)'
);

-- HU-010: a resolução gera a notificação in-platform (agora que há um inbox).
select is(
  (select count(*)::int from public.notifications where type = 'project_invitation'),
  1,
  'o 1º login dispara a notificação in-platform do convidado (inv_notify_resolved)'
);
select is(
  (select payload ->> 'project_name' from public.notifications
     where type = 'project_invitation' limit 1),
  'Projeto 07',
  'a notificação carrega o nome do projeto'
);
select is(
  (select payload ->> 'inviter_name' from public.notifications
     where type = 'project_invitation' limit 1),
  'Admin 07',
  'a notificação carrega o nome de quem convidou'
);

-- HU-019: a RPC lista o convite (agora vinculado) com os nomes denormalizados.
select is(
  (select project_name from public.list_my_pending_invitations() limit 1),
  'Projeto 07',
  'list_my_pending_invitations devolve o convite resolvido ao convidado'
);

-- --- Um terceiro não enxerga nada --------------------------------------------
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

select * from finish();
rollback;
