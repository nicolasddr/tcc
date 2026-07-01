-- 04_accept_onboarding_members_test.sql — aceitar convite (Opção A) + consentimento +
-- abandonar + listar membros (HU-020, HU-028 consent, HU-025).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - aceitar materializa a linha do avaliador em pending_onboarding e vira o convite p/ accepted;
--   - um membro pending_onboarding é INVISÍVEL a outro avaliador ativo, mas VISÍVEL ao admin (pm_select);
--   - o CHECK do banco recusa promover a active sem consentimento/onboarding (pm_consent_required);
--   - consentir grava timestamp + snapshot e promove a active;
--   - abandonar deleta a linha (pm_delete_own_pending, migration 0007) e reverte o convite a pending;
--   - a lista de membros do projeto enxerga todos os membros materializados (HU-025).
-- Molde: ver 03_invitation_notification_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(11);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin04@test.local', 'Admin 04')::text, true);
select set_config('tests.ev1_id',
  tests.create_user('ev1-04@test.local', 'Avaliador Um')::text, true);
select set_config('tests.ev2_id',
  tests.create_user('ev2-04@test.local', 'Avaliador Dois')::text, true);
select set_config('tests.ev3_id',
  tests.create_user('ev3-04@test.local', 'Avaliador Tres')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);

update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Como o admin: cria o projeto (vira admin ativo) e convida os três --------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

insert into public.projects (id, name, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 04',
        current_setting('tests.admin_id')::uuid);

insert into public.project_invitations (project_id, invitee_id, invited_by, status)
values
  (current_setting('tests.p1_id')::uuid, current_setting('tests.ev1_id')::uuid,
   current_setting('tests.admin_id')::uuid, 'pending'),
  (current_setting('tests.p1_id')::uuid, current_setting('tests.ev2_id')::uuid,
   current_setting('tests.admin_id')::uuid, 'pending'),
  (current_setting('tests.p1_id')::uuid, current_setting('tests.ev3_id')::uuid,
   current_setting('tests.admin_id')::uuid, 'pending');

-- --- ev2 aceita e conclui o onboarding (fica avaliador ATIVO) -----------------
-- (Necessário antes de ev1 para o teste de visibilidade: um avaliador ativo.)
select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
insert into public.project_members (project_id, user_id, role, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev2_id')::uuid,
        'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();
update public.project_members
   set status = 'active', consent_accepted_at = now(),
       consent_text_snapshot = 'termo', onboarding_completed_at = now()
 where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid();

-- --- ev1 aceita o convite (materializa a linha pending_onboarding) ------------
select tests.authenticate_as(current_setting('tests.ev1_id')::uuid);
insert into public.project_members (project_id, user_id, role, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev1_id')::uuid,
        'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();

select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  'pending_onboarding',
  'aceitar materializa a linha do avaliador em pending_onboarding'
);
select is(
  (select status from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid()),
  'accepted',
  'aceitar vira o convite para accepted'
);

-- CHECK do banco: não dá para ficar active sem consentimento/onboarding.
select throws_ok(
  $$ update public.project_members set status = 'active'
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid() $$,
  '23514', null,
  'o banco recusa promover a active sem consentimento (pm_consent_required)'
);

-- --- Visibilidade do pending_onboarding --------------------------------------
-- ev2 (avaliador ativo, não-admin) NÃO enxerga a linha pendente de ev1.
select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
select is(
  (select count(*)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev1_id')::uuid),
  0,
  'um avaliador ativo não enxerga um membro em pending_onboarding (pm_select)'
);

-- o admin enxerga a linha pendente de ev1.
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
select is(
  (select count(*)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev1_id')::uuid),
  1,
  'o admin enxerga o membro em pending_onboarding (pm_select)'
);

-- --- ev1 consente e é promovido a active -------------------------------------
select tests.authenticate_as(current_setting('tests.ev1_id')::uuid);
update public.project_members
   set status = 'active', consent_accepted_at = now(),
       consent_text_snapshot = 'termo lido por ev1', onboarding_completed_at = now()
 where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid();
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  'active',
  'consentir promove o avaliador a active'
);
select is(
  (select consent_text_snapshot from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  'termo lido por ev1',
  'o consentimento grava o snapshot do termo (LGPD)'
);

-- ev2 agora enxerga ev1 (já ativo).
select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
select is(
  (select count(*)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev1_id')::uuid),
  1,
  'um avaliador ativo enxerga outro membro depois que ele fica active'
);

-- --- ev3 aceita e ABANDONA o onboarding --------------------------------------
select tests.authenticate_as(current_setting('tests.ev3_id')::uuid);
insert into public.project_members (project_id, user_id, role, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev3_id')::uuid,
        'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();
-- abandona: deleta a linha e reverte o convite.
delete from public.project_members
  where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()
    and status = 'pending_onboarding';
update public.project_invitations set status = 'pending', resolved_at = null
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid()
    and status = 'accepted';

select is(
  (select count(*)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()),
  0,
  'abandonar deleta a linha do avaliador (pm_delete_own_pending)'
);
select is(
  (select count(*)::int from public.list_my_pending_invitations()),
  1,
  'abandonar reverte o convite para pending (volta a aparecer nos pendentes)'
);

-- --- Lista de membros do projeto (HU-025) ------------------------------------
-- o admin enxerga os três membros materializados (admin + ev1 + ev2; ev3 abandonou).
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
select is(
  (select count(distinct user_id)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid),
  3,
  'a lista de membros do projeto traz os três membros ativos (ev3 abandonou)'
);

select * from finish();
rollback;
