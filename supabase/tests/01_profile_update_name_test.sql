-- 01_profile_update_name_test.sql — editar o próprio nome no perfil (Fatia 01, HU-005).
--
-- Prova o par de garantias da fatia:
--   1. O usuário atualiza o PRÓPRIO nome (profiles_update_own + grant de coluna `name`).
--   2. u1 não enxerga o perfil de u2 (profiles_select_own) e uma tentativa de mudar o
--      nome de u2 filtra a linha pela RLS: afeta zero linhas, então o nome de u2 —
--      lido depois como o próprio u2 — segue intacto.
--   3. Escalar outra coluna (can_create_projects) é barrado pelo grant de coluna
--      (0002: `grant update (name)` — só `name`), levantando 42501.
-- Molde: ver 05_member_status_transition_test.sql. Roda com `npm test`.

begin;
set local search_path = public, extensions;
select plan(4);

-- --- Fixtures (como superusuário, RLS desligada) -----------------------------
select set_config('tests.u1_id',
  tests.create_user('u1-01@test.local', 'Nome Antigo 1')::text, true);
select set_config('tests.u2_id',
  tests.create_user('u2-01@test.local', 'Nome Original 2')::text, true);

-- --- Como u1: edita o próprio nome e tenta editar o de u2 ---------------------
select tests.authenticate_as(current_setting('tests.u1_id')::uuid);

update public.profiles set name = 'Nome Novo 1'
  where id = current_setting('tests.u1_id')::uuid;
select is(
  (select name from public.profiles where id = current_setting('tests.u1_id')::uuid),
  'Nome Novo 1',
  'o usuário atualiza o próprio nome (profiles_update_own)'
);

-- u1 não enxerga a linha de u2 (profiles_select_own só devolve a própria).
select is_empty(
  $$ select 1 from public.profiles where id = current_setting('tests.u2_id')::uuid $$,
  'u1 não enxerga o perfil de u2 (profiles_select_own)'
);

-- Tentativa de mudar o nome de u2: a RLS filtra a linha, o UPDATE não tem efeito.
update public.profiles set name = 'Invasao'
  where id = current_setting('tests.u2_id')::uuid;

-- Escalar outra coluna é barrado pelo grant de coluna (só `name` é atualizável).
select throws_ok(
  $$ update public.profiles set can_create_projects = true
     where id = current_setting('tests.u1_id')::uuid $$,
  '42501', null,
  'não dá para escalar outra coluna: só `name` é atualizável (grant de coluna)'
);

-- --- Como u2: seu nome seguiu intacto após a tentativa de u1 ------------------
select tests.authenticate_as(current_setting('tests.u2_id')::uuid);
select is(
  (select name from public.profiles where id = current_setting('tests.u2_id')::uuid),
  'Nome Original 2',
  'atualizar o perfil de outro usuário não tem efeito (RLS filtra a linha)'
);

select * from finish();
rollback;
