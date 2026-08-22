-- GLOBO SLOTS — Entrega 7: edição/exclusão de oportunidades e descrição ampliada.
-- Execute este arquivo inteiro no SQL Editor do Supabase após a Entrega 6.

-- ---------------------------------------------------------------------------
-- 1. Amplia o campo "Sobre a oportunidade" de 300 para 600 caracteres.
-- ---------------------------------------------------------------------------
alter table if exists oportunidades
  drop constraint if exists oportunidades_descricao_check;

alter table if exists oportunidades
  add constraint oportunidades_descricao_check
  check (char_length(trim(descricao)) between 1 and 600);

-- ---------------------------------------------------------------------------
-- 2. Exclusão: somente Consultor de programa vinculado ao programa da ação.
--    Proprietário sozinho não recebe permissão de exclusão.
-- ---------------------------------------------------------------------------
drop policy if exists "oportunidades remover consultor" on oportunidades;
create policy "oportunidades remover consultor" on oportunidades
  for delete to authenticated
  using (
    tem_perfil('consultor_programa')
    and exists (
      select 1
      from consultor_programa cp
      where cp.usuario_id = auth.uid()
        and cp.programa_id = oportunidades.programa_id
    )
  );

-- Conferência rápida:
select conname as constraint_name
from pg_constraint
where conrelid = 'oportunidades'::regclass
  and conname = 'oportunidades_descricao_check';

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'oportunidades'
  and policyname = 'oportunidades remover consultor';
