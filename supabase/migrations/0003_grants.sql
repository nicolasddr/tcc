-- 0003_grants.sql — privilégios de tabela que as policies de RLS pressupõem.
--
-- O default-privilege local do Supabase concede a anon/authenticated apenas
-- Dxtm (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) nas tabelas de public — SEM
-- SELECT/INSERT. Sem isto, o cliente leva "permission denied" mesmo quando a
-- RLS permitiria a linha (descoberto pelo harness da Issue 00). A RLS continua
-- sendo o gate de LINHAS; estes grants são só o teto de privilégio por COMANDO.
--
-- UPDATE NÃO é concedido em bloco nas tabelas com grant por coluna do 0002
-- (profiles, project_members, project_invitations, notifications —
-- anti-escalonamento): mantém-se o grant de coluna já existente.

-- SELECT em todas as tabelas (a RLS filtra as linhas). anon incluído para que um
-- visitante receba 0 linhas em vez de erro de permissão.
grant select on
  public.profiles,
  public.super_admins,
  public.platform_permission_requests,
  public.projects,
  public.project_members,
  public.project_invitations,
  public.notifications,
  public.onboarding_questions,
  public.onboarding_responses
to anon, authenticated;

-- INSERT onde há policy de insert para o cliente.
grant insert on
  public.platform_permission_requests,  -- ppr_insert_own
  public.projects,                       -- projects_insert
  public.project_members,                -- pm_insert
  public.project_invitations,            -- inv_insert
  public.onboarding_questions,           -- oq_insert
  public.onboarding_responses            -- or_insert
to authenticated;

-- UPDATE em bloco só onde o 0002 NÃO restringiu por coluna.
grant update on public.projects             to authenticated;  -- projects_update
grant update on public.onboarding_questions to authenticated;  -- oq_update

-- DELETE onde há policy de delete.
grant delete on public.onboarding_questions to authenticated;  -- oq_delete
