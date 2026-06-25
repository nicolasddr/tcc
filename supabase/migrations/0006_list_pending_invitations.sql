-- 0006_list_pending_invitations.sql — o convidado lista seus convites pendentes
-- com o nome de quem convidou (HU-019).
--
-- Bug (Issue 03): o convidado precisa ver "quem convidou", mas a RLS de profiles
-- (profiles_select_shared_members via shares_project_with) só expõe membros que
-- compartilham um projeto ATIVO. Um convidado ainda NÃO é membro, então não
-- enxerga o profile do administrador que o convidou — um join direto devolveria
-- nome nulo.
--
-- Correção: RPC security definer que devolve os convites pendentes do PRÓPRIO
-- usuário (filtra por invitee_id = auth.uid(), sem enumerar nada de terceiros) já
-- com nome do projeto e do convidante denormalizados. Mesmo padrão das demais
-- RPCs do 0002 (find_invitee_by_email etc.).

create function public.list_my_pending_invitations()
returns table (
  invitation_id uuid,
  project_id    uuid,
  project_name  text,
  inviter_name  text,
  created_at    timestamptz
)
language sql security definer stable set search_path = public as $$
  select i.id, i.project_id, p.name, inv.name, i.created_at
  from public.project_invitations i
  join public.projects p on p.id = i.project_id
  left join public.profiles inv on inv.id = i.invited_by
  where i.invitee_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;

revoke execute on function public.list_my_pending_invitations() from anon;
grant  execute on function public.list_my_pending_invitations() to authenticated;
