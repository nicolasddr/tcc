-- 05_member_status_transition_test.sql — trava de transições de status por ator
-- (Fatia 05, correção do item 7 do DER).
--
-- FURO original (sem a migration 0008): um avaliador `inactive` reativava a
-- própria linha (`inactive → active`), desfazendo remoção/saída. Este teste:
--   1. Prova que o furo está FECHADO: o próprio membro NÃO faz inactive → active.
--   2. Prova que as transições legítimas do ciclo do membro seguem funcionando
--      (pending_onboarding → active ao consentir; active → inactive ao sair).
--   3. Prova que o Administrador AINDA faz as transições administrativas
--      (reativar um membro: inactive → active).
-- Molde: ver 04_accept_onboarding_members_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(5);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin05@test.local', 'Admin 05')::text, true);
select set_config('tests.ev_id',
  tests.create_user('ev-05@test.local', 'Avaliador 05')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);

update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Como o admin: cria o projeto (vira admin ativo) e convida o avaliador ----
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

insert into public.projects (id, name, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 05',
        current_setting('tests.admin_id')::uuid);

insert into public.project_invitations (project_id, invitee_id, invited_by, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev_id')::uuid,
        current_setting('tests.admin_id')::uuid, 'pending');

-- --- O avaliador aceita, consente (pending_onboarding → active) e sai ---------
select tests.authenticate_as(current_setting('tests.ev_id')::uuid);
insert into public.project_members (project_id, user_id, role, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev_id')::uuid,
        'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();

-- (1) transição legítima do próprio membro: concluir onboarding.
update public.project_members
   set status = 'active', consent_accepted_at = now(),
       consent_text_snapshot = 'termo', onboarding_completed_at = now()
 where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid();
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  'active',
  'o próprio membro conclui o onboarding (pending_onboarding -> active)'
);

-- (2) transição legítima do próprio membro: sair voluntariamente (HU-022).
update public.project_members set status = 'inactive'
 where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid();
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  'inactive',
  'o próprio membro sai voluntariamente (active -> inactive)'
);

-- (3) O FURO: o próprio membro NÃO reativa a si mesmo (inactive -> active).
select throws_ok(
  $$ update public.project_members set status = 'active'
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid() $$,
  '42501', null,
  'o próprio membro NÃO se reativa (inactive -> active barrado) — furo do item 7 fechado'
);
-- ... e continua inactive.
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev_id')::uuid),
  'inactive',
  'após a tentativa barrada o membro segue inactive'
);

-- (4) O admin AINDA reativa o membro (transição administrativa).
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
update public.project_members set status = 'active'
 where project_id = current_setting('tests.p1_id')::uuid
   and user_id = current_setting('tests.ev_id')::uuid;
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev_id')::uuid),
  'active',
  'o administrador reativa o membro (inactive -> active permitido ao admin)'
);

select * from finish();
rollback;
