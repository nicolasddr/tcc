-- 0004_project_task_type.sql — tipo de tarefa do projeto (HU-013, ADR 0005).
--
-- Dica OPCIONAL por projeto, declarada na criação. Mais adiante (Épico 1+) só
-- personaliza tooltips/exemplos da autoria do codebook; NÃO ramifica comportamento
-- aqui. Nullable porque declarar o tipo é opcional. Valores em código (inglês,
-- como o resto do schema); o rótulo em PT é da UI. "mixed" (Não sei/Misto) e
-- "other" (Outro) caem na tooltip genérica — ver ADR 0005.
--
-- O grant table-level de INSERT/UPDATE em projects (0003) já cobre a coluna nova,
-- então o cliente pode gravar task_type sem novo grant.

alter table public.projects
  add column task_type text
    check (task_type in ('classification', 'quality_evaluation', 'generation', 'mixed', 'other'));
