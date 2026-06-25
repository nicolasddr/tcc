-- 0005_fix_projects_select_creator.sql — o criador precisa enxergar o próprio
-- projeto já no RETURNING do INSERT.
--
-- Bug (Issue 02): criar projeto pela app falhava com "new row violates row-level
-- security policy for table projects", mesmo com can_create_projects = true.
--
-- Causa: o supabase-js `.insert().select()` gera `INSERT ... RETURNING` (PostgREST,
-- return=representation). Quando há policy de SELECT, o Postgres revalida a linha
-- retornada contra ela (não dá pra retornar linha que você não poderia ler). A
-- linha de Administrador do criador só nasce no trigger AFTER INSERT
-- (auto_add_creator_as_admin), que ainda NÃO rodou no momento do RETURNING — então
-- is_project_member() era falso e o INSERT inteiro era barrado. Um INSERT sem
-- RETURNING passava (por isso o trigger e os testes diretos não pegavam).
--
-- Correção: o criador enxerga o próprio projeto por created_by, sem depender da
-- materialização do membership. (created_by é imutável; não escala visibilidade.)

alter policy projects_select on public.projects
  using (
    created_by = auth.uid()
    or public.is_project_member(id)
    or public.has_pending_invitation(id)
  );
