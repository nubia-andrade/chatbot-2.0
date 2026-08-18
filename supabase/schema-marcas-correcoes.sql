-- CHATBOT 2.0 — Correções manuais de Marca → Anunciante.
-- Rode DEPOIS de supabase/schema-marcas-take.sql.
--
-- Por que a correção é POR RELAÇÃO e não no alias inteiro:
-- uma marca pode chegar associada ao anunciante errado na origem ou exigir
-- uma exceção de governança. Corrigir `anunciantes_take.cliente_id` mudaria
-- TODAS as marcas observadas sob aquele anunciante. Aqui o override vale só
-- para a marca específica.

alter table anunciante_take_marcas
  add column if not exists cliente_id_override uuid references clientes (id) on delete set null,
  add column if not exists corrigido_em timestamptz,
  add column if not exists corrigido_por uuid references auth.users (id) on delete set null;

create index if not exists anunciante_take_marcas_cliente_override_idx
  on anunciante_take_marcas (cliente_id_override);

comment on column anunciante_take_marcas.cliente_id_override is
  'Correção manual do cliente/anunciante para ESTA relação Marca + anunciante do Take. Nulo usa o cliente padrão de anunciantes_take.';
comment on column anunciante_take_marcas.corrigido_em is
  'Momento da última correção manual da relação Marca + anunciante do Take.';
comment on column anunciante_take_marcas.corrigido_por is
  'Usuário que fez a última correção manual da relação Marca + anunciante do Take.';

-- Administradores podem corrigir uma relação específica. Executivos só leem.
drop policy if exists "atualizacao administrador" on anunciante_take_marcas;
create policy "atualizacao administrador" on anunciante_take_marcas
  for update to authenticated
  using (e_administrador())
  with check (e_administrador());

-- A Nova Consulta passa a resolver o anunciante assim:
--   override da relação (quando existe)
--   senão cliente padrão do alias do Take.
create or replace function buscar_marcas(
  termo_busca text,
  limite_busca integer default 20
)
returns table (
  marca_id uuid,
  marca_nome text,
  cliente_id uuid,
  cliente_nome text,
  cnpj text,
  setor text,
  industria text,
  apto_regional boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct
    m.id,
    m.nome,
    c.id,
    c.nome,
    c.cnpj,
    c.setor,
    c.industria,
    c.apto_regional
  from marcas m
  join anunciante_take_marcas atm on atm.marca_id = m.id
  join anunciantes_take at on at.id = atm.anunciante_take_id
  join clientes c on c.id = coalesce(atm.cliente_id_override, at.cliente_id)
  where trim(coalesce(termo_busca, '')) <> ''
    and m.nome ilike '%' || termo_busca || '%'
  order by m.nome, c.nome
  limit greatest(1, least(coalesce(limite_busca, 20), 50));
$$;

revoke execute on function buscar_marcas(text, integer) from public;
grant execute on function buscar_marcas(text, integer) to authenticated;

-- Busca administrativa dos relacionamentos, inclusive os já resolvidos.
-- `cliente_efetivo` é o que a Nova Consulta realmente usará.
create or replace function buscar_relacionamentos_marcas(
  termo_busca text default '',
  limite_busca integer default 100
)
returns table (
  anunciante_take_id uuid,
  anunciante_take_nome text,
  status_alias text,
  marca_id uuid,
  marca_nome text,
  cliente_padrao_id uuid,
  cliente_padrao_nome text,
  cliente_override_id uuid,
  cliente_override_nome text,
  cliente_efetivo_id uuid,
  cliente_efetivo_nome text,
  ultimo_visto_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    at.id,
    at.nome,
    at.status,
    m.id,
    m.nome,
    cp.id,
    cp.nome,
    co.id,
    co.nome,
    ce.id,
    ce.nome,
    atm.ultimo_visto_em
  from anunciante_take_marcas atm
  join anunciantes_take at on at.id = atm.anunciante_take_id
  join marcas m on m.id = atm.marca_id
  left join clientes cp on cp.id = at.cliente_id
  left join clientes co on co.id = atm.cliente_id_override
  left join clientes ce on ce.id = coalesce(atm.cliente_id_override, at.cliente_id)
  where trim(coalesce(termo_busca, '')) = ''
     or m.nome ilike '%' || termo_busca || '%'
     or at.nome ilike '%' || termo_busca || '%'
     or cp.nome ilike '%' || termo_busca || '%'
     or co.nome ilike '%' || termo_busca || '%'
  order by atm.ultimo_visto_em desc, m.nome, at.nome
  limit greatest(1, least(coalesce(limite_busca, 100), 200));
$$;

revoke execute on function buscar_relacionamentos_marcas(text, integer) from public;
grant execute on function buscar_relacionamentos_marcas(text, integer) to authenticated;

-- Conferência depois de aplicar:
-- select * from buscar_relacionamentos_marcas('PAGBANK', 100);
-- select * from buscar_marcas('PAGBANK', 20);
