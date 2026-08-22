-- GLOBO SLOTS — Entrega 7: edição de oportunidades e descrição ampliada.
-- Execute este arquivo inteiro no SQL Editor do Supabase após a Entrega 6.

-- Amplia o campo "Sobre a oportunidade" de 300 para 600 caracteres.
-- A constraint antiga pode existir com o mesmo nome; por isso removemos e recriamos.
alter table if exists oportunidades
  drop constraint if exists oportunidades_descricao_check;

alter table if exists oportunidades
  add constraint oportunidades_descricao_check
  check (char_length(trim(descricao)) between 1 and 600);

-- Conferência rápida:
select conname as constraint_name
from pg_constraint
where conrelid = 'oportunidades'::regclass
  and conname = 'oportunidades_descricao_check';
