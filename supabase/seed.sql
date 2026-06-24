-- seed.sql — scaffolding de TESTE da camada de dados (Issue 00).
--
-- Carregado em `supabase start` / `supabase db reset` (LOCAL apenas — seeds nunca
-- são enviados ao Supabase remoto via `db push`). Estabelece o seam único de teste
-- do Épico 0: pgTAP + helpers que PERSONIFICAM um usuário (setando
-- `request.jwt.claims` + `role`), conforme as Testing Decisions do PRD
-- (docs/prd/epico-0-fundacao.md). Os testes ficam em `supabase/tests/*_test.sql`
-- e rodam com `npm test` (`supabase test db`).

-- pgTAP fica disponível para os arquivos de teste (no schema public para resolver
-- plan()/is()/ok() sem qualificar). Local apenas, via seed.
create extension if not exists pgtap;

-- Schema isolado para os helpers de teste — não mistura com o schema da aplicação.
create schema if not exists tests;

-- ---------------------------------------------------------------------------
-- tests.create_user(email, name) -> uuid
--   Cria um usuário em auth.users; o trigger on_auth_user_created
--   (handle_new_user) materializa o profile correspondente. Devolve o id, que
--   é usado depois em tests.authenticate_as().
--   Sem `security definer`/`set search_path`: roda como o session user (o
--   superusuário do `supabase test db`); só referencia objetos qualificados
--   (auth.users) e built-ins do pg_catalog.
--   Os tokens (confirmation_token, …) vão como '' porque versões do GoTrue os
--   declaram NOT NULL sem default — preenchê-los blinda contra `null value`.
-- ---------------------------------------------------------------------------
create or replace function tests.create_user(p_email text, p_name text default null)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, email_confirmed_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    p_email,
    jsonb_build_object('provider', 'google', 'providers', jsonb_build_array('google')),
    jsonb_build_object('full_name', coalesce(p_name, p_email)),
    now(), now(), now(),
    '', '', '', ''
  );
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- tests.authenticate_as(user_id)
--   Personifica um usuário pelo resto da transação: role `authenticated` +
--   `request.jwt.claims` com o `sub` esperado por auth.uid(). Chamar de novo
--   com outro id troca de usuário entre asserções.
--   (set_config(..., is_local := true) = SET LOCAL; persiste até o fim da
--   transação porque a função não declara cláusula SET própria.)
-- ---------------------------------------------------------------------------
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- tests.clear_authentication()
--   Volta para o papel anônimo (auth.uid() = null), simulando um visitante não
--   autenticado. A troca de papel é permitida porque o session user continua
--   sendo o superusuário.
-- ---------------------------------------------------------------------------
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', null, true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Os helpers são chamados DEPOIS de já estar personificando (p/ trocar de
-- usuário), então anon/authenticated precisam de acesso ao schema tests.
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
