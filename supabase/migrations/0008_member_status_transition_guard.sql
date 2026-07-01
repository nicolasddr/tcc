-- 0008_member_status_transition_guard.sql — trava transições de `status` em
-- project_members por ator (Fatia 05, correção do item 7 do DER).
--
-- FURO FECHADO: um membro removido/saído (`inactive`) conseguia reativar a
-- própria linha (`inactive → active`), desfazendo a remoção (HU-021) e a saída
-- (HU-022). A policy `pm_update` libera `user_id = auth.uid()`, o grant da seção 5
-- inclui a coluna `status`, os CHECK de consentimento/onboarding continuam
-- satisfeitos e não havia guarda de transição — logo o UPDATE passava.
--
-- Esta é uma guarda de segurança *load-bearing* (impede restaurar privilégio):
-- fica NO BANCO, num trigger BEFORE UPDATE, não numa checagem só de app
-- (esquecível). Alinhado ao ADR 0007 — a meta de reduzir PL/pgSQL não vale para
-- predicados/guardas de segurança, e a "Fase 5" (remover triggers) foi cancelada.
--
-- Regras por ator (só quando o `status` muda; outras colunas seguem livres):
--   • Administrador ATIVO do projeto → transições administrativas (remover =
--     active→inactive de outrem; reativar = inactive→active).
--   • O próprio membro (não-admin, na PRÓPRIA linha) → apenas o próprio ciclo:
--       pending_onboarding → active   (concluir onboarding, HU-020/028)
--       active            → inactive  (sair voluntariamente, HU-022)
--     Qualquer outra — em especial inactive → active — é NEGADA.

create function public.enforce_member_status_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Sem mudança de status: consentimento, updated_at etc. seguem livres.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Administrador do projeto faz as transições administrativas.
  if public.is_project_admin(new.project_id) then
    return new;
  end if;

  -- Não-admin: só as transições do próprio ciclo de vida, na própria linha.
  if new.user_id = auth.uid()
     and ( (old.status = 'pending_onboarding' and new.status = 'active')
        or (old.status = 'active'            and new.status = 'inactive') ) then
    return new;
  end if;

  raise exception
    'transição de status % -> % não permitida para o próprio membro (member %, project %)',
    old.status, new.status, new.user_id, new.project_id
    using errcode = '42501';  -- insufficient_privilege
end;
$$;

create trigger project_members_status_transition_guard
  before update on public.project_members
  for each row execute function public.enforce_member_status_transition();
