-- 08_project_lifecycle_test.sql — ciclo de vida do projeto (HU-014/015/016/017).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - o Administrador edita nome/descrição enquanto o projeto está `active`
--     (projects_update exige is_project_admin);
--   - um Avaliador (membro, não-admin) NÃO edita: a RLS filtra a linha do UPDATE,
--     que não altera nada (0 linhas) — o nome permanece o que o admin gravou;
--   - o Administrador conclui (active→completed) e arquiva/reativa livremente
--     (a transição de status NÃO é barrada);
--   - em `completed`/`archived` o projeto é somente leitura: editar nome/descrição
--     dispara enforce_project_readonly (rede no banco, P0001);
--   - reativar (→active) volta a permitir edição;
--   - um Avaliador não muda o status (RLS filtra o UPDATE);
--   - quem é de fora não enxerga o projeto (projects_select).
-- A trava amigável ("só edita em projeto ativo") é da action updateProject (app);
-- aqui provamos a rede da camada de dados. Molde: ver 02_create_list_project_test.sql.

begin;
set local search_path = public, extensions;
select plan(11);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin08@test.local', 'Admin 08')::text, true);
select set_config('tests.ev_id',
  tests.create_user('ev-08@test.local', 'Avaliador 08')::text, true);
select set_config('tests.out_id',
  tests.create_user('out-08@test.local', 'De Fora 08')::text, true);
select set_config('tests.p1_id', gen_random_uuid()::text, true);

-- Cria o projeto (o trigger auto_add_creator_as_admin materializa o admin como
-- Administrador ativo) e adiciona o avaliador como membro ATIVO (com onboarding e
-- consentimento, p/ satisfazer os CHECKs pm_onboarding_done / pm_consent_required).
insert into public.projects (id, name, description, status, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 08', 'descrição original',
        'active', current_setting('tests.admin_id')::uuid);

insert into public.project_members
  (project_id, user_id, role, status, onboarding_completed_at,
   consent_accepted_at, consent_text_snapshot)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.ev_id')::uuid,
        'evaluator', 'active', now(), now(), 'Termo v1');

-- --- Admin edita nome/descrição com o projeto ATIVO --------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

update public.projects
   set name = 'Editado', description = 'nova descrição'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select name from public.projects where id = current_setting('tests.p1_id')::uuid),
  'Editado',
  'o Administrador edita o nome com o projeto ativo (projects_update)'
);

-- --- Avaliador (membro, não-admin) NÃO edita ---------------------------------
select tests.authenticate_as(current_setting('tests.ev_id')::uuid);

-- A RLS (projects_update exige is_project_admin) filtra a linha: o UPDATE não
-- levanta erro, mas não altera nada (0 linhas). O nome segue o que o admin gravou.
update public.projects set name = 'invasao'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select name from public.projects where id = current_setting('tests.p1_id')::uuid),
  'Editado',
  'um Avaliador (não-admin) não edita o projeto (RLS filtra o UPDATE)'
);

-- --- Admin conclui (active→completed) ----------------------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

update public.projects set status = 'completed'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select status from public.projects where id = current_setting('tests.p1_id')::uuid),
  'completed',
  'o Administrador conclui o projeto (active→completed)'
);

-- --- Concluído é somente leitura: editar nome dispara o guard ----------------
select throws_ok(
  $$ update public.projects set name = 'depois de concluir'
     where id = current_setting('tests.p1_id')::uuid $$,
  'P0001', null,
  'projeto concluído é somente leitura (enforce_project_readonly barra a edição)'
);

-- --- Reativar (completed→active) e voltar a editar ---------------------------
update public.projects set status = 'active'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select status from public.projects where id = current_setting('tests.p1_id')::uuid),
  'active',
  'reativar volta o projeto a ativo (completed→active)'
);

update public.projects set name = 'Editado de novo'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select name from public.projects where id = current_setting('tests.p1_id')::uuid),
  'Editado de novo',
  'reativado, o projeto volta a ser editável'
);

-- --- Arquivar (active→archived): sai da lista padrão e vira somente leitura ---
update public.projects set status = 'archived'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select status from public.projects where id = current_setting('tests.p1_id')::uuid),
  'archived',
  'o Administrador arquiva o projeto (active→archived)'
);

select throws_ok(
  $$ update public.projects set description = 'edição em arquivado'
     where id = current_setting('tests.p1_id')::uuid $$,
  'P0001', null,
  'projeto arquivado é somente leitura (enforce_project_readonly barra a edição)'
);

update public.projects set status = 'active'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select status from public.projects where id = current_setting('tests.p1_id')::uuid),
  'active',
  'reativar volta o projeto arquivado a ativo (archived→active)'
);

-- --- Avaliador não muda o status ---------------------------------------------
select tests.authenticate_as(current_setting('tests.ev_id')::uuid);
update public.projects set status = 'completed'
 where id = current_setting('tests.p1_id')::uuid;
select is(
  (select status from public.projects where id = current_setting('tests.p1_id')::uuid),
  'active',
  'um Avaliador não muda o status do projeto (RLS filtra o UPDATE)'
);

-- --- Quem é de fora não enxerga o projeto ------------------------------------
select tests.authenticate_as(current_setting('tests.out_id')::uuid);
select is(
  (select count(*)::int from public.projects
     where id = current_setting('tests.p1_id')::uuid),
  0,
  'quem não participa não enxerga o projeto (projects_select)'
);

select * from finish();
rollback;
