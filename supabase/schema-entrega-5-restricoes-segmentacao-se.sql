-- CHATBOT 2.0 — Restrição por Segmentação SE da Carteira.
-- Execute no SQL Editor do Supabase depois de schema-clientes-regional.sql.
--
-- Segmentação SE é um campo próprio de `clientes` e não deve ser confundida
-- com Setor ou Indústria. Esta migration mantém eventuais restrições legadas
-- (somente setor OU somente indústria) para auditoria, mas elas deixam de ser
-- consideradas pela regra nova e devem ser recadastradas quando necessário.

alter table restricoes_anunciante
  add column if not exists segmentacao_se text;

comment on column restricoes_anunciante.segmentacao_se is
  'Segmentação SE própria da Carteira. Nula quando a restrição é por anunciante ou por Setor + Indústria.';

-- Remove o check antigo, que só conhecia anunciante/setor/indústria e impediria
-- uma restrição exclusivamente por Segmentação SE. O nome original pode variar
-- conforme a instalação, por isso localizamos o check pela definição.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.restricoes_anunciante'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%anunciante%'
      and pg_get_constraintdef(oid) ilike '%setor%'
      and pg_get_constraintdef(oid) ilike '%industria%'
  loop
    execute format('alter table public.restricoes_anunciante drop constraint %I', r.conname);
  end loop;
end $$;

alter table restricoes_anunciante
  drop constraint if exists restricoes_anunciante_alvo_check;

-- NOT VALID preserva linhas antigas gravadas pelo antigo modo "Só categoria"
-- (somente setor OU somente indústria), mas passa a impedir novas linhas nesse
-- formato. Depois de revisar/remover as legadas, podemos validar o constraint.
alter table restricoes_anunciante
  add constraint restricoes_anunciante_alvo_check
  check (
    nullif(trim(anunciante), '') is not null
    or (
      nullif(trim(setor), '') is not null
      and nullif(trim(industria), '') is not null
    )
    or nullif(trim(segmentacao_se), '') is not null
  ) not valid;

create index if not exists restricoes_segmentacao_se_idx
  on restricoes_anunciante (programa_id, segmentacao_se)
  where segmentacao_se is not null;

-- Conferência: estas linhas são legadas do antigo "Só categoria".
-- Elas NÃO serão tratadas como Segmentação SE pela aplicação nova.
select
  id,
  programa_id,
  anunciante,
  setor,
  industria,
  motivo
from restricoes_anunciante
where nullif(trim(coalesce(anunciante, '')), '') is null
  and nullif(trim(coalesce(segmentacao_se, '')), '') is null
  and (
    (nullif(trim(coalesce(setor, '')), '') is not null and nullif(trim(coalesce(industria, '')), '') is null)
    or
    (nullif(trim(coalesce(setor, '')), '') is null and nullif(trim(coalesce(industria, '')), '') is not null)
  )
order by criado_em desc;
