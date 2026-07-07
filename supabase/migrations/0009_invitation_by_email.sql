-- 0009_invitation_by_email.sql — convite por e-mail pendente até o 1º login
-- (ADR 0006, Issue 07).
--
-- Problema ovo-e-galinha da fatia 03: com login só-Google e notificação só
-- in-platform, o admin só conseguia convidar quem JÁ tinha perfil (já logou uma
-- vez). O avaliador externo nunca era achado por e-mail nem avisado.
--
-- Decisão (ADR 0006): o admin convida por E-MAIL mesmo sem perfil. O convite fica
-- pendente referenciando o e-mail (invitee_id NULL). No PRIMEIRO login com Google
-- daquele e-mail, handle_new_user() RESOLVE os convites pendentes — vincula o
-- invitee_id ao novo perfil e dispara a notificação in-platform (via trigger de
-- resolução). O convite então aparece sozinho na lista de pendentes do novo usuário.
--
-- Camada de dados (ADR 0007): handle_new_user permanece em SQL (trigger security
-- definer em auth.users, roda fora de qualquer Server Action) — é exatamente o tipo
-- de objeto privilegiado que a migração para Drizzle mantém no banco.

-- ---------------------------------------------------------------------------
-- (1) Schema: alvo por e-mail; invitee_id NULLABLE (preenchido na resolução).
-- ---------------------------------------------------------------------------
alter table public.project_invitations
  add column invitee_email text;

alter table public.project_invitations
  alter column invitee_id drop not null;

-- Todo convite precisa de ao menos um alvo: e-mail (pendente de perfil) e/ou id.
alter table public.project_invitations
  add constraint inv_target_present
    check (invitee_id is not null or invitee_email is not null);

-- HU-018: não convidar o mesmo e-mail duas vezes com pendência simultânea. O
-- índice antigo (project_id, invitee_id) where pending trata NULLs como distintos,
-- então não barra convites por e-mail (invitee_id NULL); este cobre o alvo por
-- e-mail (case-insensitive), inclusive já resolvidos que continuam pendentes.
create unique index inv_one_pending_per_email
  on public.project_invitations (project_id, lower(invitee_email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- (2) notify_on_invitation: pular quando ainda não há destinatário (invitee_id
--     NULL num convite por e-mail). A notificação sai na RESOLUÇÃO (abaixo).
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Convite por e-mail ainda sem perfil: sem inbox p/ notificar. notify_on_invitation_resolved
  -- cuida disso quando o convidado logar pela 1ª vez.
  if new.invitee_id is null then
    return new;
  end if;
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

-- ---------------------------------------------------------------------------
-- (3) Notificação na RESOLUÇÃO: quando invitee_id vai de NULL → perfil (só
--     acontece dentro de handle_new_user; o cliente não tem grant p/ tocar
--     invitee_id), dispara a mesma notificação in-platform da fatia 03.
-- ---------------------------------------------------------------------------
create function public.notify_on_invitation_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.invitee_id is null and new.invitee_id is not null and new.status = 'pending' then
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
  end if;
  return new;
end;
$$;

create trigger inv_notify_resolved
  after update of invitee_id on public.project_invitations
  for each row execute function public.notify_on_invitation_resolved();

-- ---------------------------------------------------------------------------
-- (4) handle_new_user: além de criar o perfil no 1º login, resolve os convites
--     por e-mail pendentes daquele endereço. O UPDATE de invitee_id dispara
--     inv_notify_resolved (uma notificação por convite). Roda como owner
--     (security definer): ignora a RLS e o grant por coluna que barram o cliente.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    new.email
  );

  -- ADR 0006: vincula os convites por e-mail pendentes ao perfil recém-criado.
  update public.project_invitations
     set invitee_id = new.id
   where invitee_id is null
     and status = 'pending'
     and lower(invitee_email) = lower(new.email);

  return new;
end;
$$;
