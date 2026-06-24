-- projects_rls_test.sql — teste de referência do harness (Issue 00).
--
-- Afirma COMPORTAMENTO EXTERNO sob RLS (o que cada usuário enxerga), não detalhe
-- de implementação. Serve de molde para as demais fatias (01..10): cria usuários,
-- personifica um de cada vez com tests.authenticate_as() e checa o SELECT visível.
--
-- Roda com `npm test` (= `supabase test db`). Cada arquivo roda numa transação
-- que é revertida ao final (begin/rollback), então não suja o banco local.

begin;
-- pgTAP fica em public via seed.sql; `extensions` no path por robustez.
set local search_path = public, extensions;
select plan(5);

-- --- Fixtures (como superusuário, RLS desligada para o setup) ----------------
-- Os ids ficam em GUCs transação-locais (current_setting), legíveis depois de
-- trocar de papel — temp tables não seriam acessíveis sob `role authenticated`.
select set_config('tests.admin_id',
  tests.create_user('admin@test.local', 'Admin de Teste')::text, true);
select set_config('tests.stranger_id',
  tests.create_user('stranger@test.local', 'Estranho de Teste')::text, true);

-- Inserir o projeto dispara auto_add_creator_as_admin: o criador vira
-- administrador ATIVO (membro do projeto).
insert into public.projects (name, created_by)
values ('Projeto de referência', current_setting('tests.admin_id')::uuid);

-- Sanity: o trigger handle_new_user materializou o profile do admin.
select is(
  (select count(*)::int from public.profiles
     where id = current_setting('tests.admin_id')::uuid),
  1,
  'create_user dispara handle_new_user e cria o profile'
);

-- --- Não-membro NÃO vê o projeto ---------------------------------------------
select tests.authenticate_as(current_setting('tests.stranger_id')::uuid);

select is(
  (select count(*)::int from public.projects),
  0,
  'um não-membro não enxerga o projeto sob RLS'
);

-- --- Membro ativo VÊ o projeto (e a troca de usuário funciona) ----------------
select tests.authenticate_as(current_setting('tests.admin_id')::uuid);

select is(
  (select auth.uid()),
  current_setting('tests.admin_id')::uuid,
  'authenticate_as troca o usuário corrente (auth.uid)'
);

select is(
  (select count(*)::int from public.projects),
  1,
  'o administrador ativo enxerga o próprio projeto'
);

-- --- Visitante anônimo não vê nada -------------------------------------------
select tests.clear_authentication();

select is(
  (select count(*)::int from public.projects),
  0,
  'um visitante anônimo não enxerga o projeto'
);

select * from finish();
rollback;
