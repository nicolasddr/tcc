-- 06_onboarding_questions_test.sql — perguntas de onboarding (HU-026/027/028/029).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - o admin define perguntas (oq_insert exige is_project_admin); um avaliador NÃO pode;
--   - qualquer membro do projeto enxerga as perguntas (oq_select); quem é de fora, não;
--   - só o próprio avaliador (linha pending) responde (or_insert / can_answer_onboarding);
--     outro avaliador não pode responder pela linha alheia;
--   - a resposta é IMUTÁVEL (sem policy/grant de UPDATE/DELETE);
--   - o admin vê as respostas de um avaliador (can_view_response); outro avaliador, não;
--   - remover uma pergunta cascateia as respostas (FK ON DELETE CASCADE);
--   - editar uma pergunta mantém as respostas já dadas.
-- Obrigatoriedade (todas as perguntas) é regra da action completeOnboarding (app) —
-- coberta pelo script de sanidade tsx, não aqui (pgTAP testa a camada de dados).
-- Molde: ver 04_accept_onboarding_members_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(12);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin06@test.local', 'Admin 06')::text, true);
select set_config('tests.ev1_id',
  tests.create_user('ev1-06@test.local', 'Avaliador Um')::text, true);
select set_config('tests.ev2_id',
  tests.create_user('ev2-06@test.local', 'Avaliador Dois')::text, true);
select set_config('tests.out_id',
  tests.create_user('out-06@test.local', 'De Fora')::text, true);
select set_config('tests.p1_id',     gen_random_uuid()::text, true);
select set_config('tests.q_open_id', gen_random_uuid()::text, true);
select set_config('tests.q_mc_id',   gen_random_uuid()::text, true);
select set_config('tests.m1_id',     gen_random_uuid()::text, true);
select set_config('tests.m2_id',     gen_random_uuid()::text, true);

update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Admin: cria o projeto, convida os dois e DEFINE as perguntas ------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

insert into public.projects (id, name, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 06',
        current_setting('tests.admin_id')::uuid);

insert into public.project_invitations (project_id, invitee_id, invited_by, status)
values
  (current_setting('tests.p1_id')::uuid, current_setting('tests.ev1_id')::uuid,
   current_setting('tests.admin_id')::uuid, 'pending'),
  (current_setting('tests.p1_id')::uuid, current_setting('tests.ev2_id')::uuid,
   current_setting('tests.admin_id')::uuid, 'pending');

-- oq_insert exige is_project_admin: o admin consegue.
insert into public.onboarding_questions (id, project_id, question_text, question_type, options, order_index)
values
  (current_setting('tests.q_open_id')::uuid, current_setting('tests.p1_id')::uuid,
   'Qual é a sua área de formação?', 'open', null, 0),
  (current_setting('tests.q_mc_id')::uuid, current_setting('tests.p1_id')::uuid,
   'Qual o seu nível de formação?', 'multiple_choice',
   '["Graduação","Mestrado","Doutorado"]'::jsonb, 1);

-- --- ev1 aceita (materializa a linha pending) e RESPONDE ----------------------
select tests.authenticate_as(current_setting('tests.ev1_id')::uuid);
insert into public.project_members (id, project_id, user_id, role, status)
values (current_setting('tests.m1_id')::uuid, current_setting('tests.p1_id')::uuid,
        current_setting('tests.ev1_id')::uuid, 'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();

select is(
  (select count(*)::int from public.onboarding_questions
     where project_id = current_setting('tests.p1_id')::uuid),
  2,
  'um avaliador (membro) enxerga as perguntas do projeto (oq_select)'
);

-- RLS: só o admin define. Um avaliador não pode inserir pergunta.
select throws_ok(
  $$ insert into public.onboarding_questions (project_id, question_text, question_type, order_index)
     values (current_setting('tests.p1_id')::uuid, 'pergunta pirata', 'open', 2) $$,
  '42501', null,
  'um avaliador não pode definir perguntas (oq_insert exige admin)'
);

-- Responde às duas perguntas (or_insert: própria linha, ainda pending).
insert into public.onboarding_responses (project_member_id, question_id, answer)
values
  (current_setting('tests.m1_id')::uuid, current_setting('tests.q_open_id')::uuid, 'Ciência da Computação'),
  (current_setting('tests.m1_id')::uuid, current_setting('tests.q_mc_id')::uuid,   'Mestrado');

select is(
  (select count(*)::int from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid),
  2,
  'o avaliador responde às perguntas (or_insert, própria linha pending)'
);

-- Imutabilidade: sem UPDATE/DELETE (nem grant nem policy) em onboarding_responses.
select throws_ok(
  $$ update public.onboarding_responses set answer = 'troca'
     where project_member_id = current_setting('tests.m1_id')::uuid $$,
  '42501', null,
  'a resposta é imutável: UPDATE negado (sem grant/policy)'
);
select throws_ok(
  $$ delete from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid $$,
  '42501', null,
  'a resposta é imutável: DELETE negado (sem grant/policy)'
);

-- --- Quem é de fora não enxerga as perguntas ---------------------------------
select tests.authenticate_as(current_setting('tests.out_id')::uuid);
select is(
  (select count(*)::int from public.onboarding_questions
     where project_id = current_setting('tests.p1_id')::uuid),
  0,
  'quem não participa do projeto não enxerga as perguntas (oq_select)'
);

-- --- ev2 aceita, mas NÃO responde pela linha de ev1 nem vê as respostas dele --
select tests.authenticate_as(current_setting('tests.ev2_id')::uuid);
insert into public.project_members (id, project_id, user_id, role, status)
values (current_setting('tests.m2_id')::uuid, current_setting('tests.p1_id')::uuid,
        current_setting('tests.ev2_id')::uuid, 'evaluator', 'pending_onboarding');
update public.project_invitations set status = 'accepted', resolved_at = now()
  where project_id = current_setting('tests.p1_id')::uuid and invitee_id = auth.uid();

-- Só o respondente responde: ev2 não pode responder pela linha (m1) de ev1.
select throws_ok(
  $$ insert into public.onboarding_responses (project_member_id, question_id, answer)
     values (current_setting('tests.m1_id')::uuid, current_setting('tests.q_open_id')::uuid, 'invasao') $$,
  '42501', null,
  'um avaliador não responde pela linha de outro (or_insert / can_answer_onboarding)'
);

-- ev2 (avaliador, não-admin) não enxerga as respostas de ev1.
select is(
  (select count(*)::int from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid),
  0,
  'um avaliador não vê as respostas de outro (or_select / can_view_response)'
);

-- --- Admin vê as respostas de ev1, remove e edita perguntas ------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);
select is(
  (select count(*)::int from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid),
  2,
  'o admin vê as respostas de onboarding do avaliador (can_view_response)'
);

-- Remover cascateia: apaga a resposta de ev1 àquela pergunta (FK ON DELETE CASCADE).
delete from public.onboarding_questions where id = current_setting('tests.q_open_id')::uuid;
select is(
  (select count(*)::int from public.onboarding_questions
     where project_id = current_setting('tests.p1_id')::uuid),
  1,
  'remover a pergunta a exclui da lista do projeto'
);
select is(
  (select count(*)::int from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid),
  1,
  'remover a pergunta cascateia a resposta dada a ela (ON DELETE CASCADE)'
);

-- Editar mantém a resposta já dada (só muda o texto/opções da pergunta).
update public.onboarding_questions
   set question_text = 'Qual o seu nível de formação (editado)?'
 where id = current_setting('tests.q_mc_id')::uuid;
select is(
  (select answer from public.onboarding_responses
     where project_member_id = current_setting('tests.m1_id')::uuid
       and question_id = current_setting('tests.q_mc_id')::uuid),
  'Mestrado',
  'editar a pergunta mantém a resposta já dada (HU-027)'
);

select * from finish();
rollback;
