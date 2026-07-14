-- seed.sql — scaffolding de TESTE da camada de dados.
--
-- Carregado em `supabase start` / `supabase db reset` (LOCAL apenas — seeds nunca são
-- enviados ao Supabase remoto). Fornece o helper que os testes de integração TS
-- (test/helpers.ts, rodados por `npm test` = Vitest) usam para criar usuários.
--
-- Antes do flip da Fase 4 (issue #22) este arquivo também instalava o pgTAP e helpers de
-- personificação (authenticate_as/clear_authentication) para testar a RLS. Com a RLS e o
-- pgTAP removidos, sobra só o essencial.

-- Schema isolado para os helpers de teste — não mistura com o schema da aplicação.
create schema if not exists tests;

-- ---------------------------------------------------------------------------
-- tests.create_user(email, name) -> uuid
--   Cria um usuário em auth.users E o profile correspondente. Antes do flip da
--   Fase 4 o profile era materializado pelo trigger handle_new_user; com ele
--   removido, o profile é inserido explicitamente aqui — o equivalente, no seam de
--   teste, ao provisionamento que hoje vive em lib/auth/provision. Devolve o id.
--   Sem `security definer`/`set search_path`: roda como o session user (superusuário);
--   só referencia objetos qualificados (auth.users, public.profiles) e built-ins.
--   Os tokens (confirmation_token, …) vão como '' porque versões do GoTrue os declaram
--   NOT NULL sem default — preenchê-los blinda contra `null value`.
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
  insert into public.profiles (id, name, email)
  values (v_id, coalesce(p_name, p_email), p_email);
  return v_id;
end;
$$;
