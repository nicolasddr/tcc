-- 0002_epico_0.sql — schema completo do Épico 0 (Fundação)


create extension if not exists pgcrypto;

-- ===========================================================================
-- (1) TABELAS  — em ordem de dependência de FK
-- ===========================================================================

-- 1.1 super_admins  (ADR-004) -----------------------------------------------
create table public.super_admins (
  user_id    uuid primary key references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null
);

-- 1.2 platform_permission_requests  (HU-007/008/009/011) --------------------
create table public.platform_permission_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
-- HU-007: usuário com solicitação pendente não pode reenviar.
create unique index ppr_one_pending_per_user
  on public.platform_permission_requests (user_id) where status = 'pending';
-- HU-008: fila de pendentes do super-admin.
create index ppr_status_created
  on public.platform_permission_requests (status, created_at);

-- 1.3 projects  (HU-012..017) -----------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text not null default 'active'
                check (status in ('active','completed','archived')),
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index projects_created_by_status on public.projects (created_by, status);
create index projects_status on public.projects (status);

-- 1.4 project_members  (HU-012/018/020/021/022/023/024/025/028) -------------
create table public.project_members (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  role                    text not null check (role in ('administrator','evaluator')),
  status                  text not null default 'pending_onboarding'
                            check (status in ('pending_onboarding','active','inactive')),
  evaluations_enabled     boolean not null default true,       -- HU-023
  joined_at               timestamptz not null default now(),
  onboarding_completed_at timestamptz,                          -- HU-028
  consent_accepted_at     timestamptz,                          -- HU-028
  consent_text_snapshot   text,                                 -- HU-028 (LGPD)
  updated_at              timestamptz,

  -- HU-024: admin pode ter 2 linhas (administrator + evaluator); mesmo papel não duplica.
  constraint pm_unique_role unique (project_id, user_id, role),

  -- Só sai de pending_onboarding com consentimento registrado — EXCETO o admin,
  -- que entra ativo via HU-012 sem passar por onboarding. (Correção do DER.)
  constraint pm_consent_required check (
    status = 'pending_onboarding'
    or role = 'administrator'
    or (consent_accepted_at is not null and consent_text_snapshot is not null)
  ),

  -- Avaliador ativo precisa ter concluído o onboarding.
  constraint pm_onboarding_done check (
    role = 'administrator'
    or status = 'pending_onboarding'
    or onboarding_completed_at is not null
  )
);
create index pm_user_status    on public.project_members (user_id, status);    -- HU-013
create index pm_project_status on public.project_members (project_id, status); -- HU-025

-- 1.5 project_invitations  (HU-018/019/020/021) -----------------------------
create table public.project_invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  invitee_id  uuid not null references public.profiles(id) on delete cascade,
  -- NULLABLE (correção do DER): permite ON DELETE SET NULL sem violar NOT NULL.
  invited_by  uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending'
                check (status in ('pending','accepted','declined','cancelled')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
-- HU-018: não convidar duas vezes simultâneas.
create unique index inv_one_pending_per_invitee
  on public.project_invitations (project_id, invitee_id) where status = 'pending';
create index inv_invitee_status on public.project_invitations (invitee_id, status); -- HU-019
create index inv_project_status on public.project_invitations (project_id, status);

-- 1.6 notifications  (HU-010/011) — in-platform only ------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('project_invitation','permission_decision')),
  payload    jsonb not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox on public.notifications (user_id, created_at desc);

-- 1.7 onboarding_questions  (HU-026/027) ------------------------------------
create table public.onboarding_questions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('open','multiple_choice')),
  options       jsonb,                 -- só quando question_type = 'multiple_choice'
  order_index   integer not null,
  created_at    timestamptz not null default now()
);
create index oq_project_order on public.onboarding_questions (project_id, order_index);

-- 1.8 onboarding_responses  (HU-028/029) ------------------------------------
create table public.onboarding_responses (
  id                uuid primary key default gen_random_uuid(),
  project_member_id uuid not null references public.project_members(id) on delete cascade,
  question_id       uuid not null references public.onboarding_questions(id) on delete cascade,
  answer            text not null,
  answered_at       timestamptz not null default now(),
  constraint or_unique_member_question unique (project_member_id, question_id)
);
create index or_member on public.onboarding_responses (project_member_id); -- HU-029

-- ===========================================================================
-- (2) FUNÇÕES
-- ===========================================================================

-- 2.1 Predicados de papel/associação (security definer p/ quebrar recursão de
--     RLS — executam como owner, ignorando RLS; DER § Limitações conhecidas).

create function public.is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

-- Membro ATIVO (qualquer papel) — definição do DER para is_member_of().
create function public.is_member_of(target_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project_id and user_id = auth.uid() and status = 'active'
  );
$$;

-- Tem QUALQUER linha de membership (inclui pending_onboarding/inactive).
create function public.is_project_member(target_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project_id and user_id = auth.uid()
  );
$$;

-- Administrador ATIVO do projeto.
create function public.is_project_admin(target_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project_id and user_id = auth.uid()
      and role = 'administrator' and status = 'active'
  );
$$;

-- Tem convite pendente para o projeto (HU-019 mostra o nome do projeto).
create function public.has_pending_invitation(target_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_invitations
    where project_id = target_project_id and invitee_id = auth.uid() and status = 'pending'
  );
$$;

-- Compartilha algum projeto com `other_user` (viewer precisa ser membro ativo).
create function public.shares_project_with(other_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.project_members me
    join public.project_members them on them.project_id = me.project_id
    where me.user_id = auth.uid() and me.status = 'active'
      and them.user_id = other_user
  );
$$;

-- Pode ver a resposta de onboarding (o próprio respondente ou o admin do projeto).
create function public.can_view_response(member_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.id = member_id
      and (m.user_id = auth.uid() or public.is_project_admin(m.project_id))
  );
$$;

-- Pode responder ao onboarding (próprio membro, ainda em pending_onboarding).
create function public.can_answer_onboarding(member_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.id = member_id and m.user_id = auth.uid() and m.status = 'pending_onboarding'
  );
$$;

-- 2.2 Funções de trigger ----------------------------------------------------

-- Sincroniza profiles.email quando o usuário troca o e-mail pelo Supabase Auth.
create function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

-- HU-012: criador do projeto vira administrador ativo. Security definer p/
-- ignorar a policy pm_insert (que exige convite/admin pré-existente).
create function public.auto_add_creator_as_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role, status)
  values (new.id, new.created_by, 'administrator', 'active');
  return new;
end;
$$;

-- Read-only em projetos completed/archived: bloqueia editar nome/descrição
-- (HU-014/016); a transição de status (reativar/concluir/arquivar) é permitida.
create function public.enforce_project_readonly()
returns trigger language plpgsql as $$
begin
  if old.status in ('completed','archived')
     and (new.name is distinct from old.name
          or new.description is distinct from old.description) then
    raise exception 'project % is read-only (status %)', old.id, old.status;
  end if;
  return new;
end;
$$;

-- HU-018: não convidar quem já é membro ativo do projeto.
create function public.check_invitation_target()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.project_members m
    where m.project_id = new.project_id and m.user_id = new.invitee_id and m.status = 'active'
  ) then
    raise exception 'invitee % is already an active member of project %',
      new.invitee_id, new.project_id;
  end if;
  return new;
end;
$$;

-- HU-010: notifica o convidado ao criar convite.
create function public.notify_on_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  select new.invitee_id, 'project_invitation',
    jsonb_build_object(
      'invitation_id', new.id,
      'project_id',    new.project_id,
      'project_name',  p.name,
      'invited_by',    new.invited_by,
      'inviter_name',  inv.name
    )
  from public.projects p
  left join public.profiles inv on inv.id = new.invited_by
  where p.id = new.project_id;
  return new;
end;
$$;

-- HU-011: notifica o solicitante quando a permissão é aprovada/rejeitada.
create function public.notify_on_permission_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved','rejected') and new.status is distinct from old.status then
    insert into public.notifications (user_id, type, payload)
    values (new.user_id, 'permission_decision',
      jsonb_build_object('request_id', new.id, 'result', new.status));
  end if;
  return new;
end;
$$;

-- 2.3 RPCs de plataforma (security definer) ---------------------------------

-- HU-018: o admin busca o convidado por e-mail. Retorna só id+name (evita
-- enumeração de e-mails); restrito a quem pode criar projetos.
create function public.find_invitee_by_email(p_email text)
returns table (id uuid, name text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name
  from public.profiles p
  where lower(p.email) = lower(p_email)
    and exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.can_create_projects)
  limit 1;
$$;

-- HU-009: super-admin aprova/rejeita. Faz a transição de status (dispara a
-- notificação HU-011 via trigger) e, na aprovação, liga can_create_projects
-- (que o cliente não pode tocar diretamente — REVOKE na seção 5).
create function public.resolve_permission_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_super_admin() then
    raise exception 'only a super-admin can resolve permission requests';
  end if;
  update public.platform_permission_requests
     set status      = case when p_approve then 'approved' else 'rejected' end,
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_request_id and status = 'pending'
   returning user_id into v_user;
  if v_user is null then
    raise exception 'request % not found or already resolved', p_request_id;
  end if;
  if p_approve then
    update public.profiles set can_create_projects = true where id = v_user;
  end if;
end;
$$;

-- HU-023: admin liga/desliga as avaliações de um membro. evaluations_enabled
-- é revogado do cliente (seção 5); só muda por aqui.
create function public.set_member_evaluations(p_member_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  select project_id into v_project from public.project_members where id = p_member_id;
  if v_project is null then
    raise exception 'member % not found', p_member_id;
  end if;
  if not public.is_project_admin(v_project) then
    raise exception 'only the project administrator can change evaluations';
  end if;
  update public.project_members
     set evaluations_enabled = p_enabled, updated_at = now()
   where id = p_member_id;
end;
$$;

-- ===========================================================================
-- (3) TRIGGERS
-- ===========================================================================
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger projects_auto_add_admin
  after insert on public.projects
  for each row execute function public.auto_add_creator_as_admin();

create trigger projects_readonly_guard
  before update on public.projects
  for each row execute function public.enforce_project_readonly();

create trigger project_members_set_updated_at
  before update on public.project_members
  for each row execute function public.set_updated_at();

create trigger inv_check_target
  before insert on public.project_invitations
  for each row execute function public.check_invitation_target();

create trigger inv_notify
  after insert on public.project_invitations
  for each row execute function public.notify_on_invitation();

create trigger ppr_notify
  after update of status on public.platform_permission_requests
  for each row execute function public.notify_on_permission_decision();

-- ===========================================================================
-- (4) RLS + POLICIES
-- ===========================================================================
alter table public.super_admins                 enable row level security;
alter table public.platform_permission_requests enable row level security;
alter table public.projects                      enable row level security;
alter table public.project_members              enable row level security;
alter table public.project_invitations          enable row level security;
alter table public.notifications                enable row level security;
alter table public.onboarding_questions         enable row level security;
alter table public.onboarding_responses         enable row level security;

-- profiles: SELECT cross-membro (HU-025) somado ao select-own do 0001.
create policy profiles_select_shared_members
  on public.profiles for select
  using (public.shares_project_with(id));

-- super_admins: SELECT só do próprio; demais comandos sem policy = negados.
create policy super_admins_select_own
  on public.super_admins for select using (user_id = auth.uid());

-- platform_permission_requests
create policy ppr_select
  on public.platform_permission_requests for select
  using (user_id = auth.uid() or public.is_super_admin());
create policy ppr_insert_own
  on public.platform_permission_requests for insert
  with check (user_id = auth.uid() and status = 'pending');
-- UPDATE: sem policy — resolução só via resolve_permission_request() (HU-009).

-- projects
create policy projects_select
  on public.projects for select
  using (public.is_project_member(id) or public.has_pending_invitation(id));
create policy projects_insert
  on public.projects for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.can_create_projects)
  );
create policy projects_update
  on public.projects for update
  using (public.is_project_admin(id)) with check (public.is_project_admin(id));

-- project_members
-- SELECT: o próprio usuário vê suas linhas (qualquer status); o admin vê todas
-- as do projeto; demais membros ativos veem linhas NÃO pending_onboarding.
create policy pm_select
  on public.project_members for select
  using (
    user_id = auth.uid()
    or public.is_project_admin(project_id)
    or (public.is_member_of(project_id) and status <> 'pending_onboarding')
  );
-- INSERT: convidado materializa a própria linha ao aceitar (HU-020); admin se
-- auto-adiciona como avaliador (HU-024). Linha do criador: via trigger.
create policy pm_insert
  on public.project_members for insert
  with check (
    user_id = auth.uid()
    and (public.has_pending_invitation(project_id) or public.is_project_admin(project_id))
  );
-- UPDATE: admin gerencia membros; o usuário mexe na própria linha (concluir
-- onboarding / sair). Colunas sensíveis são revogadas na seção 5.
create policy pm_update
  on public.project_members for update
  using (public.is_project_admin(project_id) or user_id = auth.uid())
  with check (public.is_project_admin(project_id) or user_id = auth.uid());

-- project_invitations
create policy inv_select
  on public.project_invitations for select
  using (invitee_id = auth.uid() or public.is_project_admin(project_id));
create policy inv_insert
  on public.project_invitations for insert
  with check (public.is_project_admin(project_id) and invited_by = auth.uid() and status = 'pending');
create policy inv_update
  on public.project_invitations for update
  using (invitee_id = auth.uid() or public.is_project_admin(project_id))
  with check (invitee_id = auth.uid() or public.is_project_admin(project_id));

-- notifications
create policy notifications_select_own
  on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_own
  on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- INSERT: sem policy — só via triggers security definer.

-- onboarding_questions
create policy oq_select
  on public.onboarding_questions for select
  using (public.is_project_member(project_id));
create policy oq_insert on public.onboarding_questions for insert
  with check (public.is_project_admin(project_id));
create policy oq_update on public.onboarding_questions for update
  using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));
create policy oq_delete on public.onboarding_questions for delete
  using (public.is_project_admin(project_id));

-- onboarding_responses
create policy or_select
  on public.onboarding_responses for select using (public.can_view_response(project_member_id));
create policy or_insert
  on public.onboarding_responses for insert with check (public.can_answer_onboarding(project_member_id));
-- UPDATE/DELETE: sem policy — resposta é imutável.

-- ===========================================================================
-- (5) GRANTS por coluna (restringem UPDATE onde há policy de UPDATE)
-- ===========================================================================
-- profiles: cliente só atualiza `name` (HU-005). `email` via trigger;
-- `can_create_projects` só via resolve_permission_request().
revoke update on public.profiles from authenticated;
grant  update (name) on public.profiles to authenticated;

-- project_members: cliente não toca role nem evaluations_enabled (anti-escalonamento).
revoke update on public.project_members from authenticated;
grant  update (status, consent_accepted_at, consent_text_snapshot, onboarding_completed_at)
  on public.project_members to authenticated;

-- project_invitations: cliente só muda status/resolved_at.
revoke update on public.project_invitations from authenticated;
grant  update (status, resolved_at) on public.project_invitations to authenticated;

-- notifications: cliente só marca como lida.
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- RPCs: bloqueadas para anon; liberadas para authenticated (guardas internas).
revoke execute on function public.find_invitee_by_email(text)              from anon;
revoke execute on function public.resolve_permission_request(uuid, boolean) from anon;
revoke execute on function public.set_member_evaluations(uuid, boolean)     from anon;
grant  execute on function public.find_invitee_by_email(text)              to authenticated;
grant  execute on function public.resolve_permission_request(uuid, boolean) to authenticated;
grant  execute on function public.set_member_evaluations(uuid, boolean)     to authenticated;

-- ===========================================================================
-- (6) Bootstrap do super-admin inicial
-- ===========================================================================
-- Feito MANUALMENTE no Supabase Studio (fora do versionamento) para não expor
-- e-mail/UUID no repositório. Pré-requisito: o super-admin já ter feito login
-- com Google ao menos uma vez (a linha em auth.users nasce no 1º login).
-- Snippet a rodar no SQL Editor:
--
--   insert into public.super_admins (user_id, granted_by)
--   select id, null from auth.users
--   where email = 'SEU_EMAIL_AQUI'
--   on conflict (user_id) do nothing;
