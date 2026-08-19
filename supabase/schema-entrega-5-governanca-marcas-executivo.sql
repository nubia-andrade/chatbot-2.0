-- CHATBOT 2.0 — Entrega 5: cadastro de marca pelo executivo + governança diária.
-- Rode depois de schema-entrega-4-fechamento-propostas.sql.
-- Idempotente para colunas, constraints, índices, tabelas e funções.

alter table marca_cliente_manual
  add column if not exists origem text not null default 'administracao',
  add column if not exists revisao_status text not null default 'revisada',
  add column if not exists revisado_por uuid references auth.users (id) on delete set null,
  add column if not exists revisado_em timestamptz;

alter table marca_cliente_manual drop constraint if exists marca_cliente_manual_origem_check;
alter table marca_cliente_manual add constraint marca_cliente_manual_origem_check
  check (origem in ('administracao', 'consulta'));

alter table marca_cliente_manual drop constraint if exists marca_cliente_manual_revisao_check;
alter table marca_cliente_manual add constraint marca_cliente_manual_revisao_check
  check (revisao_status in ('pendente', 'revisada'));

-- Vínculos antigos foram decisões administrativas e já são considerados revisados.
update marca_cliente_manual
set origem = coalesce(origem, 'administracao'),
    revisao_status = coalesce(revisao_status, 'revisada')
where origem is null or revisao_status is null;

create index if not exists marca_cliente_manual_revisao_idx
  on marca_cliente_manual (revisao_status, criado_em desc);

-- Registro das execuções do relatório diário para evitar disparo duplicado.
create table if not exists relatorio_marcas_diario (
  data_referencia date primary key,
  quantidade integer not null default 0,
  enviado_em timestamptz not null default now()
);

alter table relatorio_marcas_diario enable row level security;
-- Sem policy: uso exclusivo do job servidor com service role.

-- Cadastro durante a Nova Consulta.
-- Executivo só pode cadastrar marca para cliente da própria carteira.
create or replace function cadastrar_marca_da_carteira(
  p_nome_marca text,
  p_cliente_id uuid
)
returns table (
  marca_id uuid,
  marca_nome text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_nome text := trim(coalesce(p_nome_marca, ''));
  v_normalizado text;
  v_marca_id uuid;
  v_cliente_existente uuid;
  v_email_logado text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_nome_logado text;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  if v_nome = '' then
    raise exception 'Informe somente o nome da marca.';
  end if;

  if length(v_nome) > 120 then
    raise exception 'O nome da marca deve ter no máximo 120 caracteres.';
  end if;

  select normalizar_nome_take(coalesce(u.nome, ''))
    into v_nome_logado
  from usuario u
  where u.usuario_id = auth.uid();

  if p_cliente_id is null or not exists (
    select 1
    from clientes c
    where c.id = p_cliente_id
      and (
        e_proprietario()
        or tem_perfil('consultor_programa')
        or lower(trim(coalesce(c.email, ''))) = v_email_logado
        or (
          coalesce(v_nome_logado, '') <> ''
          and normalizar_nome_take(coalesce(c.executivo, '')) = v_nome_logado
        )
      )
  ) then
    raise exception 'Escolha um anunciante válido da sua carteira.';
  end if;

  v_normalizado := normalizar_nome_take(v_nome);

  select m.id into v_marca_id
  from marcas m
  where m.nome_normalizado = v_normalizado
  limit 1;

  -- Não permite que o executivo desloque silenciosamente uma marca já governada
  -- para outro anunciante. Esse conflito precisa ser revisado por administrador.
  if v_marca_id is not null then
    select mcm.cliente_id into v_cliente_existente
    from marca_cliente_manual mcm
    where mcm.marca_id = v_marca_id
    limit 1;

    if v_cliente_existente is not null and v_cliente_existente is distinct from p_cliente_id then
      raise exception 'Esta marca já está vinculada a outro anunciante. Solicite a revisão em Marcas e anunciantes.';
    end if;
  end if;

  insert into marcas (nome, nome_normalizado, primeiro_visto_em, ultimo_visto_em)
  values (v_nome, v_normalizado, now(), now())
  on conflict (nome_normalizado) do update
    set ultimo_visto_em = greatest(marcas.ultimo_visto_em, excluded.ultimo_visto_em)
  returning id into v_marca_id;

  insert into marca_cliente_manual (
    marca_id,
    cliente_id,
    criado_por,
    criado_em,
    origem,
    revisao_status,
    revisado_por,
    revisado_em
  )
  values (
    v_marca_id,
    p_cliente_id,
    auth.uid(),
    now(),
    'consulta',
    'pendente',
    null,
    null
  )
  on conflict on constraint marca_cliente_manual_pkey do nothing;

  return query
  select m.id, m.nome
  from marcas m
  where m.id = v_marca_id;
end;
$$;

revoke all on function cadastrar_marca_da_carteira(text, uuid) from public;
grant execute on function cadastrar_marca_da_carteira(text, uuid) to authenticated;

-- Cadastro/correção administrativa continua disponível e já encerra a revisão.
create or replace function vincular_marca_manual(
  p_nome_marca text,
  p_cliente_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_nome text := trim(coalesce(p_nome_marca, ''));
  v_normalizado text;
  v_marca_id uuid;
begin
  if not e_administrador() then
    raise exception 'Você não tem permissão para vincular marcas.';
  end if;

  if v_nome = '' then
    raise exception 'Informe o nome da marca.';
  end if;

  if p_cliente_id is null or not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'Escolha um anunciante válido da carteira.';
  end if;

  v_normalizado := normalizar_nome_take(v_nome);

  insert into marcas (nome, nome_normalizado, primeiro_visto_em, ultimo_visto_em)
  values (v_nome, v_normalizado, now(), now())
  on conflict (nome_normalizado) do update
    set nome = excluded.nome,
        ultimo_visto_em = greatest(marcas.ultimo_visto_em, excluded.ultimo_visto_em)
  returning id into v_marca_id;

  delete from marca_cliente_manual
  where marca_id = v_marca_id
    and cliente_id is distinct from p_cliente_id;

  insert into marca_cliente_manual (
    marca_id,
    cliente_id,
    criado_por,
    criado_em,
    origem,
    revisao_status,
    revisado_por,
    revisado_em
  )
  values (
    v_marca_id,
    p_cliente_id,
    auth.uid(),
    now(),
    'administracao',
    'revisada',
    auth.uid(),
    now()
  )
  on conflict (marca_id, cliente_id) do update
    set revisao_status = 'revisada',
        revisado_por = auth.uid(),
        revisado_em = now();

  return v_marca_id;
end;
$$;

revoke all on function vincular_marca_manual(text, uuid) from public;
grant execute on function vincular_marca_manual(text, uuid) to authenticated;

create or replace function marcar_marca_manual_revisada(
  p_marca_id uuid,
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not e_administrador() then
    raise exception 'Você não tem permissão para revisar marcas.';
  end if;

  update marca_cliente_manual
  set revisao_status = 'revisada',
      revisado_por = auth.uid(),
      revisado_em = now()
  where marca_id = p_marca_id
    and cliente_id = p_cliente_id;
end;
$$;

revoke all on function marcar_marca_manual_revisada(uuid, uuid) from public;
grant execute on function marcar_marca_manual_revisada(uuid, uuid) to authenticated;

-- Conferência rápida após aplicar a migration.
select
  origem,
  revisao_status,
  count(*) as quantidade
from marca_cliente_manual
group by origem, revisao_status
order by origem, revisao_status;