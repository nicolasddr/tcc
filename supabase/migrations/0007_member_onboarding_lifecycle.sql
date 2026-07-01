-- 0007_member_onboarding_lifecycle.sql — aceitar convite (Opção A) + abandonar o
-- onboarding (Fatia 04, HU-020 / ADR-003).
--
-- Fluxo Opção A: aceitar um convite MATERIALIZA a linha em project_members
-- (pending_onboarding); ao consentir, ela é promovida a active; ABANDONAR o
-- onboarding DELETA a linha e reverte o convite para pending.
--
-- O INSERT (pm_insert) e o UPDATE (pm_update) já eram permitidos pela RLS do 0002.
-- O que faltava era o DELETE do abandono: project_members não tinha policy de DELETE
-- (nem grant de tabela) — sem isto o abandono não removeria nada (RLS negaria, 0
-- linhas apagadas). Liberamos SÓ o caso do abandono: o próprio usuário apagando a
-- própria linha AINDA em pending_onboarding. Sair de um membership já ATIVO é
-- UPDATE→inactive (fatia 10), nunca DELETE — daí o filtro por status. Mesma exceção
-- pontual, via SQL numerado, de 0005/0006.

create policy pm_delete_own_pending
  on public.project_members for delete
  using (user_id = auth.uid() and status = 'pending_onboarding');

grant delete on public.project_members to authenticated;
