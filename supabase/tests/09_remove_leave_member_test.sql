-- 09_remove_leave_member_test.sql — remover avaliador (HU-021) e sair
-- voluntariamente (HU-022), fatia 10.
--
-- Afirma o COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   • o Administrador remove um avaliador ATIVO (active → inactive) — pm_update
--     (is_project_admin) + trigger enforce_member_status_transition (ramo admin);
--   • a remoção CANCELA os convites pendentes daquele avaliador para o projeto
--     (pending → cancelled) — inv_update (is_project_admin);
--   • as AVALIAÇÕES são preservadas (a resposta de onboarding do removido continua lá);
--   • o Avaliador sai voluntariamente da PRÓPRIA linha (active → inactive);
--   • (rede da fatia 05) o removido/saído NÃO se reativa (inactive → active barrado).
-- A trava amigável ("só o admin remove", filtro por status) é da app; aqui provamos a
-- camada de dados. Molde: ver 05_member_status_transition_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(8);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin09@test.local', 'Admin 09')::text, true);
select set_config('tests.ev_id',
  tests.create_user('ev-09@test.local', 'Avaliador 09')::text, true);
select set_config('tests.ev2_id',
  tests.create_user('ev2-09@test.local', 'Avaliador 09 dois')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);
select set_config('tests.q1_id', gen_random_uuid()::text, true);
select set_config('tests.pm_ev_id', gen_random_uuid()::text, true);

-- Projeto (o trigger materializa o admin como Administrador ativo).
insert into public.projects (id, name, status, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 09', 'active',
        current_setting('tests.admin_id')::uuid);

-- Convite pendente do 1º avaliador ANTES de ele virar membro ativo (check_invitation_target
-- barra convidar quem já é ativo). Modela o convite pendente residual que a remoção cancela.
insert into public.project_invitations (project_id, invitee_id, invited_by, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev_id')::uuid,
        current_setting('tests.admin_id')::uuid, 'pending');

-- O 1º avaliador ATIVO (com onboarding e consentimento, p/ satisfazer os CHECKs
-- pm_onboarding_done / pm_consent_required).
insert into public.project_members
  (id, project_id, user_id, role, status, onboarding_completed_at,
   consent_accepted_at, consent_text_snapshot)
values (current_setting('tests.pm_ev_id')::uuid, current_setting('tests.p1_id')::uuid,
        current_setting('tests.ev_id')::uuid, 'evaluator', 'active', now(), now(), 'Termo v1');

-- Um segundo avaliador ativo, que sairá voluntariamente.
insert into public.project_members
  (project_id, user_id, role, status, onboarding_completed_at,
   consent_accepted_at, consent_text_snapshot)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev2_id')::uuid,
        'evaluator', 'active', now(), now(), 'Termo v1');

-- Uma avaliação (resposta de onboarding) do 1º avaliador — deve ser PRESERVADA.
insert into public.onboarding_questions (id, project_id, question_text, question_type, order_index)
values (current_setting('tests.q1_id')::uuid, current_setting('tests.p1_id')::uuid,
        'Qual sua experiência?', 'open', 0);
insert into public.onboarding_responses (project_member_id, question_id, answer)
values (current_setting('tests.pm_ev_id')::uuid, current_setting('tests.q1_id')::uuid,
        'resposta preservada');

-- --- HU-021: o Administrador remove o 1º avaliador -----------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

update public.project_members set status = 'inactive'
 where project_id = current_setting('tests.p1_id')::uuid
   and user_id = current_setting('tests.ev_id')::uuid
   and role = 'evaluator' and status = 'active';
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev_id')::uuid),
  'inactive',
  'o Administrador remove o avaliador (active -> inactive)'
);

-- Cancela os convites pendentes do removido para o projeto.
update public.project_invitations set status = 'cancelled', resolved_at = now()
 where project_id = current_setting('tests.p1_id')::uuid
   and invitee_id = current_setting('tests.ev_id')::uuid
   and status = 'pending';
select is(
  (select status from public.project_invitations
     where project_id = current_setting('tests.p1_id')::uuid
       and invitee_id = current_setting('tests.ev_id')::uuid),
  'cancelled',
  'a remoção cancela o convite pendente do avaliador (pending -> cancelled)'
);

-- As avaliações do removido são PRESERVADAS.
select is(
  (select answer from public.onboarding_responses
     where project_member_id = current_setting('tests.pm_ev_id')::uuid),
  'resposta preservada',
  'a remoção preserva as avaliações do avaliador'
);

-- Rede do grant de coluna: `updated_at` está FORA do grant de UPDATE do papel
-- `authenticated` (seção 5 da 0002 — só status/consent/onboarding). Setá-la direto é
-- negado (42501); foi exatamente isso que quebrou a action em produção quando ela
-- setava updated_at à mão. Quem mantém a coluna é o trigger set_updated_at — por isso
-- a action seta SÓ status. Este teste trava a fronteira do grant contra regressão.
select throws_ok(
  $$ update public.project_members set updated_at = now()
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev_id')::uuid $$,
  '42501', null,
  'setar updated_at direto é negado ao authenticated (coluna fora do grant)'
);

-- --- (Rede da fatia 05) o removido NÃO se reativa ------------------------------
select tests.authenticate_as(current_setting('tests.ev_id')::uuid);
select throws_ok(
  $$ update public.project_members set status = 'active'
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid() $$,
  '42501', null,
  'o removido NÃO se reativa (inactive -> active barrado)'
);

-- --- HU-022: o 2º avaliador sai voluntariamente -------------------------------
select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
update public.project_members set status = 'inactive'
 where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid()
   and role = 'evaluator' and status = 'active';
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev2_id')::uuid),
  'inactive',
  'o Avaliador sai voluntariamente (active -> inactive na própria linha)'
);

-- ... e também não se reativa depois de sair.
select throws_ok(
  $$ update public.project_members set status = 'active'
     where project_id = current_setting('tests.p1_id')::uuid and user_id = auth.uid() $$,
  '42501', null,
  'quem saiu NÃO se reativa (inactive -> active barrado)'
);

-- --- Um avaliador NÃO remove outro avaliador (não é admin) --------------------
-- O ev2 (agora inactive, mas o teste é sobre a RLS, não o status) tenta desativar o ev1:
-- pm_update exige is_project_admin OR user_id = auth.uid(); a linha do ev1 não é dele,
-- então a RLS filtra o UPDATE (0 linhas), sem erro. O ev1 segue inactive (já removido),
-- então usamos o admin p/ reativá-lo antes e provar que o não-admin não consegue mexer.
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
update public.project_members set status = 'active'
 where project_id = current_setting('tests.p1_id')::uuid
   and user_id = current_setting('tests.ev_id')::uuid;

select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
update public.project_members set status = 'inactive'
 where project_id = current_setting('tests.p1_id')::uuid
   and user_id = current_setting('tests.ev_id')::uuid;

-- Lê o estado como o admin (o ev2, não-admin, nem enxerga a linha do ev1 por pm_select):
-- o ev1 segue ATIVO, prova de que o UPDATE de linha alheia foi filtrado pela RLS.
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
select is(
  (select status from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id = current_setting('tests.ev_id')::uuid),
  'active',
  'um não-admin não desativa outro membro (RLS pm_update filtra o UPDATE de linha alheia)'
);

select * from finish();
rollback;
