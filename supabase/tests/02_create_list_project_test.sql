-- 02_create_list_project_test.sql — criar projeto + listar (HU-012, HU-013).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS, personificando cada usuário:
--   - criar (com can_create_projects) materializa o criador como Administrador ativo;
--   - o tipo de tarefa opcional é salvo;
--   - papéis agregam por usuário (admin que se auto-adiciona como avaliador);
--   - um não-membro não vê o projeto;
--   - sem can_create_projects, a RLS barra a criação.
-- Molde: ver projects_rls_test.sql (Issue 00). Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(6);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.admin_id',
  tests.create_user('admin02@test.local', 'Admin 02')::text, true);
select set_config('tests.stranger_id',
  tests.create_user('stranger02@test.local', 'Estranho 02')::text, true);
-- id do projeto gerado de antemão: deixa o INSERT abaixo ser um statement simples
-- (RLS WITH CHECK não avalia direito dentro de um CTE que escreve — daí evitá-lo).
select set_config('tests.p1_id', gen_random_uuid()::text, true);

-- Só quem tem can_create_projects cria (fatia 08 entrega o fluxo de pedir; aqui
-- ligamos a flag direto, como o demo prevê fazer via SQL).
update public.profiles set can_create_projects = true
  where id = current_setting('tests.admin_id')::uuid;

-- --- Criar UNDER RLS, como o admin autenticado -------------------------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

-- INSERT simples sob RLS (role authenticated), com o id pré-gerado para reusar
-- depois das trocas de usuário. O trigger auto_add_creator_as_admin (security
-- definer) materializa a linha de Administrador do criador.
insert into public.projects (id, name, description, task_type, created_by)
values (current_setting('tests.p1_id')::uuid, 'Projeto 02', 'descrição opcional',
        'classification', current_setting('tests.admin_id')::uuid);

-- O criador enxerga o próprio projeto (projects_select via is_project_member).
select is(
  (select count(*)::int from public.projects
     where id = current_setting('tests.p1_id')::uuid),
  1,
  'o criador (admin) enxerga o projeto que criou'
);

-- HU-012: trigger materializou o criador como Administrador ATIVO.
select is(
  (select count(*)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id    = current_setting('tests.admin_id')::uuid
       and role = 'administrator' and status = 'active'),
  1,
  'criar materializa o criador como Administrador ativo'
);

-- HU-013/ADR 0005: o tipo de tarefa opcional foi salvo.
select is(
  (select task_type from public.projects
     where id = current_setting('tests.p1_id')::uuid),
  'classification',
  'o tipo de tarefa declarado na criação é salvo'
);

-- HU-024: o admin se auto-adiciona como Avaliador (linha extra, pending_onboarding).
insert into public.project_members (project_id, user_id, role, status)
values (current_setting('tests.p1_id')::uuid, current_setting('tests.admin_id')::uuid,
        'evaluator', 'pending_onboarding');

-- Papéis agregam por usuário: o mesmo usuário tem Administrador + Avaliador.
select is(
  (select count(distinct role)::int from public.project_members
     where project_id = current_setting('tests.p1_id')::uuid
       and user_id    = current_setting('tests.admin_id')::uuid),
  2,
  'papéis agregam por usuário (Administrador + Avaliador no mesmo projeto)'
);

-- --- Não-membro NÃO vê o projeto ---------------------------------------------
select tests.authenticate_as(current_setting('tests.stranger_id')::uuid);

select is(
  (select count(*)::int from public.projects
     where id = current_setting('tests.p1_id')::uuid),
  0,
  'um não-membro não enxerga o projeto sob RLS'
);

-- Sem can_create_projects, a RLS (projects_insert) barra a criação (42501).
select throws_ok(
  $$ insert into public.projects (name, created_by) values ('Bloqueado', auth.uid()) $$,
  '42501',
  null,
  'usuário sem can_create_projects é barrado pela RLS ao criar projeto'
);

select * from finish();
rollback;
