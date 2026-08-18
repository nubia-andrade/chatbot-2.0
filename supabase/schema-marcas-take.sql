-- CHATBOT 2.0 — Entrega 3: marcas aprendidas a partir do Globo Take.
-- Rode DEPOIS de schema-clientes-regional.sql.
--
-- Objetivo:
--   * a Nova Consulta passa a começar pela MARCA;
--   * a API do Globo Take já traz `anunciante` + `marca` em cada ação;
--   * um anunciante pode ter várias marcas;
--   * o relacionamento aprendido NÃO é apagado quando o snapshot de
--     `acoes_vendidas` muda;
--   * casamento automático só acontece quando o nome normalizado do
--     anunciante do Take encontra exatamente UM cliente na carteira;
--   * casos sem casamento inequívoco ficam pendentes para revisão futura.

-- ---------------------------------------------------------------------------
-- 1. Normalização equivalente à usada no TypeScript para nomes próprios.
-- ---------------------------------------------------------------------------
create or replace function normalizar_nome_take(valor text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      translate(
        upper(coalesce(valor, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

-- Índice persistido na carteira para o casamento exato não precisar
-- normalizar as ~15,5 mil linhas a cada ação importada.
alter table clientes
  add column if not exists nome_normalizado_take text;

update clientes
set nome_normalizado_take = normalizar_nome_take(nome)
where nome_normalizado_take is distinct from normalizar_nome_take(nome);

create index if not exists clientes_nome_normalizado_take_idx
  on clientes (nome_normalizado_take);

-- Mantém o índice derivado sincronizado quando uma recarga futura alterar o nome.
create or replace function sincronizar_nome_normalizado_take()
returns trigger
language plpgsql
as $$
begin
  new.nome_normalizado_take := normalizar_nome_take(new.nome);
  return new;
end;
$$;

drop trigger if exists clientes_nome_normalizado_take_trigger on clientes;
create trigger clientes_nome_normalizado_take_trigger
before insert or update of nome on clientes
for each row execute function sincronizar_nome_normalizado_take();

-- ---------------------------------------------------------------------------
-- 2. Entidades persistentes.
-- ---------------------------------------------------------------------------
create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text not null unique,
  primeiro_visto_em timestamptz not null default now(),
  ultimo_visto_em timestamptz not null default now()
);

-- Cada grafia de anunciante que chega do Take vira um alias persistente.
-- `cliente_id` nulo = ainda não conseguimos associar com segurança à carteira.
create table if not exists anunciantes_take (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text not null unique,
  cliente_id uuid references clientes (id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'automatico', 'confirmado')),
  primeiro_visto_em timestamptz not null default now(),
  ultimo_visto_em timestamptz not null default now()
);

-- Relação N:N observada na origem. Uma marca pode aparecer sob mais de um
-- alias do mesmo cliente, e um cliente pode ter várias marcas.
create table if not exists anunciante_take_marcas (
  anunciante_take_id uuid not null references anunciantes_take (id) on delete cascade,
  marca_id uuid not null references marcas (id) on delete cascade,
  primeiro_visto_em timestamptz not null default now(),
  ultimo_visto_em timestamptz not null default now(),
  primary key (anunciante_take_id, marca_id)
);

create index if not exists anunciantes_take_cliente_idx on anunciantes_take (cliente_id);
create index if not exists anunciante_take_marcas_marca_idx on anunciante_take_marcas (marca_id);

-- ---------------------------------------------------------------------------
-- 3. Aprendizado de um par Anunciante + Marca.
-- ---------------------------------------------------------------------------
create or replace function registrar_marca_take(p_anunciante text, p_marca text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anunciante_norm text := normalizar_nome_take(p_anunciante);
  v_marca_norm text := normalizar_nome_take(p_marca);
  v_marca_id uuid;
  v_alias_id uuid;
  v_cliente_id uuid;
  v_status text;
  v_candidato uuid;
  v_total_candidatos integer;
begin
  if v_anunciante_norm = '' or v_marca_norm = '' or v_marca_norm = '-' then
    return;
  end if;

  insert into marcas (nome, nome_normalizado, ultimo_visto_em)
  values (trim(p_marca), v_marca_norm, now())
  on conflict (nome_normalizado) do update
    set nome = excluded.nome,
        ultimo_visto_em = excluded.ultimo_visto_em
  returning id into v_marca_id;

  insert into anunciantes_take (nome, nome_normalizado, ultimo_visto_em)
  values (trim(p_anunciante), v_anunciante_norm, now())
  on conflict (nome_normalizado) do update
    set nome = excluded.nome,
        ultimo_visto_em = excluded.ultimo_visto_em
  returning id, cliente_id, status into v_alias_id, v_cliente_id, v_status;

  -- Nunca sobrescreve um vínculo confirmado manualmente. Para pendentes ou
  -- aliases novos, só casa automaticamente quando existe exatamente UM nome
  -- normalizado igual na carteira.
  if v_cliente_id is null and v_status <> 'confirmado' then
    select min(id), count(*)::integer
      into v_candidato, v_total_candidatos
    from clientes
    where nome_normalizado_take = v_anunciante_norm;

    if v_total_candidatos = 1 then
      update anunciantes_take
      set cliente_id = v_candidato,
          status = 'automatico',
          ultimo_visto_em = now()
      where id = v_alias_id
      returning cliente_id into v_cliente_id;
    end if;
  end if;

  insert into anunciante_take_marcas (
    anunciante_take_id,
    marca_id,
    ultimo_visto_em
  )
  values (v_alias_id, v_marca_id, now())
  on conflict (anunciante_take_id, marca_id) do update
    set ultimo_visto_em = excluded.ultimo_visto_em;
end;
$$;

-- O snapshot continua sendo responsabilidade do importador. Este trigger só
-- aprende a dimensão Marca/Anunciante e nunca impede a escrita de uma ação.
create or replace function aprender_marca_ao_importar_acao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform registrar_marca_take(new.anunciante, new.marca);
  return new;
end;
$$;

drop trigger if exists acoes_vendidas_aprender_marca on acoes_vendidas;
create trigger acoes_vendidas_aprender_marca
after insert or update of anunciante, marca on acoes_vendidas
for each row execute function aprender_marca_ao_importar_acao();

-- Aprende imediatamente com o snapshot que já existe antes da criação do trigger.
do $$
declare
  linha record;
begin
  for linha in
    select distinct anunciante, marca
    from acoes_vendidas
    where coalesce(trim(anunciante), '') <> ''
      and coalesce(trim(marca), '') <> ''
  loop
    perform registrar_marca_take(linha.anunciante, linha.marca);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Busca da Nova Consulta.
-- ---------------------------------------------------------------------------
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
  join clientes c on c.id = at.cliente_id
  where trim(coalesce(termo_busca, '')) <> ''
    and m.nome ilike '%' || termo_busca || '%'
  order by m.nome, c.nome
  limit greatest(1, least(coalesce(limite_busca, 20), 50));
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS.
-- ---------------------------------------------------------------------------
alter table marcas enable row level security;
alter table anunciantes_take enable row level security;
alter table anunciante_take_marcas enable row level security;

drop policy if exists "leitura autenticada" on marcas;
create policy "leitura autenticada" on marcas
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on anunciantes_take;
create policy "leitura autenticada" on anunciantes_take
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on anunciante_take_marcas;
create policy "leitura autenticada" on anunciante_take_marcas
  for select to authenticated using (true);

-- A futura tela de pendências poderá confirmar/corrigir aliases. Executivos
-- apenas leem; importações usam service_role e portanto não dependem de policy.
drop policy if exists "atualizacao administrador" on anunciantes_take;
create policy "atualizacao administrador" on anunciantes_take
  for update to authenticated
  using (e_administrador())
  with check (e_administrador());

grant execute on function buscar_marcas(text, integer) to authenticated;

-- Conferência útil depois de aplicar:
--
-- select status, count(*) from anunciantes_take group by status order by status;
-- select * from buscar_marcas('Nesc', 20);
-- select at.nome as anunciante_take, c.nome as cliente, m.nome as marca
-- from anunciantes_take at
-- left join clientes c on c.id = at.cliente_id
-- join anunciante_take_marcas atm on atm.anunciante_take_id = at.id
-- join marcas m on m.id = atm.marca_id
-- order by at.nome, m.nome;
