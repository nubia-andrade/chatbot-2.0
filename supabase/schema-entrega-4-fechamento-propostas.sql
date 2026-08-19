-- CHATBOT 2.0 — Fechamento da Entrega 4: governança de marcas e distribuição de propostas.
--
-- Rode no SQL Editor do Supabase depois dos schemas anteriores da Entrega 4.
-- Idempotente: tabelas/colunas usam IF NOT EXISTS e funções usam CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. MARCAS MANUAIS
-- Permite cadastrar uma marca que ainda não apareceu no Globo Take e ligá-la
-- imediatamente a um cliente/anunciante oficial da carteira.
-- Um vínculo manual é uma decisão explícita de governança e, por isso, tem
-- precedência sobre relações aprendidas automaticamente para a mesma marca.
-- ---------------------------------------------------------------------------
create table if not exists marca_cliente_manual (
  marca_id uuid not null references marcas (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (marca_id, cliente_id)
);

-- Uma marca pode ter somente um anunciante oficial definido manualmente.
-- Mantemos a PK composta por compatibilidade estrutural, mas este índice
-- garante a regra de governança na coluna que realmente precisa ser única.
create unique index if not exists marca_cliente_manual_marca_unica_idx
  on marca_cliente_manual (marca_id);

create index if not exists marca_cliente_manual_cliente_idx
  on marca_cliente_manual (cliente_id, marca_id);

alter table marca_cliente_manual enable row level security;

drop policy if exists "marca manual leitura autenticada" on marca_cliente_manual;
create policy "marca manual leitura autenticada" on marca_cliente_manual
  for select to authenticated using (true);

drop policy if exists "marca manual escrita administrador" on marca_cliente_manual;
create policy "marca manual escrita administrador" on marca_cliente_manual
  for all to authenticated
  using (e_administrador())
  with check (e_administrador());

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

  -- Se já havia uma decisão manual para a marca, substitui o anunciante
  -- anterior em vez de manter duas verdades concorrentes.
  delete from marca_cliente_manual
  where marca_id = v_marca_id
    and cliente_id is distinct from p_cliente_id;

  insert into marca_cliente_manual (marca_id, cliente_id, criado_por, criado_em)
  values (v_marca_id, p_cliente_id, auth.uid(), now())
  on conflict (marca_id, cliente_id) do update
    set criado_por = excluded.criado_por,
        criado_em = excluded.criado_em;

  return v_marca_id;
end;
$$;

revoke all on function vincular_marca_manual(text, uuid) from public;
grant execute on function vincular_marca_manual(text, uuid) to authenticated;

create or replace function remover_vinculo_marca_manual(
  p_marca_id uuid,
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_administrador() then
    raise exception 'Você não tem permissão para remover vínculos de marcas.';
  end if;

  delete from marca_cliente_manual
  where marca_id = p_marca_id and cliente_id = p_cliente_id;
end;
$$;

revoke all on function remover_vinculo_marca_manual(uuid, uuid) from public;
grant execute on function remover_vinculo_marca_manual(uuid, uuid) to authenticated;

-- Busca consolidada da Nova Consulta:
--   * respeita carteira do executivo;
--   * vínculo manual Marca → Cliente prevalece para aquela marca;
--   * na ausência dele, preserva override Marca + alias do Take;
--   * mantém cliente selecionável mesmo sem marca.
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
  with contexto as (
    select
      trim(coalesce(termo_busca, '')) as termo,
      lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email_logado,
      normalizar_nome_take(coalesce((
        select u.nome
        from usuario u
        where u.usuario_id = auth.uid()
      ), '')) as nome_logado,
      e_proprietario() or tem_perfil('consultor_programa') as pode_ver_toda_carteira
  ),
  clientes_visiveis as (
    select c.*
    from clientes c
    cross join contexto ctx
    where ctx.pode_ver_toda_carteira
       or lower(trim(coalesce(c.email, ''))) = ctx.email_logado
       or (
         ctx.nome_logado <> ''
         and normalizar_nome_take(coalesce(c.executivo, '')) = ctx.nome_logado
       )
  ),
  relacoes_marca as (
    -- Relações do Take somente quando não há uma decisão manual para a marca.
    select distinct
      m.id as marca_id,
      m.nome as marca_nome,
      coalesce(atm.cliente_id_override, at.cliente_id) as cliente_id
    from anunciante_take_marcas atm
    join anunciantes_take at on at.id = atm.anunciante_take_id
    join marcas m on m.id = atm.marca_id
    where coalesce(atm.cliente_id_override, at.cliente_id) is not null
      and not exists (
        select 1
        from marca_cliente_manual mcm
        where mcm.marca_id = m.id
      )

    union all

    -- Vínculo explícito é a fonte de verdade quando existir.
    select
      m.id,
      m.nome,
      mcm.cliente_id
    from marca_cliente_manual mcm
    join marcas m on m.id = mcm.marca_id
  ),
  resultados as (
    select
      null::uuid as marca_id,
      null::text as marca_nome,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.cnpj,
      c.setor,
      c.industria,
      c.apto_regional,
      0 as prioridade
    from clientes_visiveis c
    cross join contexto ctx
    where ctx.termo = ''
       or c.nome ilike '%' || ctx.termo || '%'

    union all

    select distinct
      rm.marca_id,
      rm.marca_nome,
      c.id,
      c.nome,
      c.cnpj,
      c.setor,
      c.industria,
      c.apto_regional,
      1 as prioridade
    from relacoes_marca rm
    join clientes_visiveis c on c.id = rm.cliente_id
    cross join contexto ctx
    where ctx.termo <> ''
      and (
        rm.marca_nome ilike '%' || ctx.termo || '%'
        or c.nome ilike '%' || ctx.termo || '%'
      )
  )
  select
    r.marca_id,
    r.marca_nome,
    r.cliente_id,
    r.cliente_nome,
    r.cnpj,
    r.setor,
    r.industria,
    r.apto_regional
  from resultados r
  order by
    r.prioridade,
    r.cliente_nome,
    r.marca_nome nulls first
  limit greatest(1, least(coalesce(limite_busca, 20), 50));
$$;

revoke execute on function buscar_marcas(text, integer) from public;
grant execute on function buscar_marcas(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. CONFIGURAÇÃO DE E-MAIL POR PROGRAMA
-- Permissão de sistema e recebimento de cópia são conceitos separados.
-- Responsáveis de e-mail precisam existir em auth.users, mas não precisam ser
-- consultores do programa.
-- ---------------------------------------------------------------------------
create table if not exists programa_email_config (
  programa_id uuid primary key references programas (id) on delete cascade,
  ativo boolean not null default false,
  atualizado_por uuid references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table if not exists programa_email_responsaveis (
  programa_id uuid not null references programas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (programa_id, usuario_id)
);

alter table programa_email_config enable row level security;
alter table programa_email_responsaveis enable row level security;

drop policy if exists "email config leitura autenticada" on programa_email_config;
create policy "email config leitura autenticada" on programa_email_config
  for select to authenticated using (true);

drop policy if exists "email config escrita consultor" on programa_email_config;
create policy "email config escrita consultor" on programa_email_config
  for all to authenticated
  using (e_consultor_de(programa_id))
  with check (e_consultor_de(programa_id));

drop policy if exists "email responsaveis leitura consultor" on programa_email_responsaveis;
create policy "email responsaveis leitura consultor" on programa_email_responsaveis
  for select to authenticated using (e_consultor_de(programa_id));

drop policy if exists "email responsaveis escrita consultor" on programa_email_responsaveis;
create policy "email responsaveis escrita consultor" on programa_email_responsaveis
  for all to authenticated
  using (e_consultor_de(programa_id))
  with check (e_consultor_de(programa_id));

create or replace function listar_usuarios_email_programa(p_programa_id uuid)
returns table (
  usuario_id uuid,
  email text,
  nome text,
  selecionado boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not e_consultor_de(p_programa_id) then
    raise exception 'Você não pode configurar o e-mail deste programa.';
  end if;

  return query
  select
    au.id,
    coalesce(au.email, '')::text,
    coalesce(u.nome, au.email, '')::text,
    exists (
      select 1
      from programa_email_responsaveis per
      where per.programa_id = p_programa_id
        and per.usuario_id = au.id
    )
  from auth.users au
  left join usuario u on u.usuario_id = au.id
  where au.email is not null
  order by coalesce(u.nome, au.email, '');
end;
$$;

revoke all on function listar_usuarios_email_programa(uuid) from public;
grant execute on function listar_usuarios_email_programa(uuid) to authenticated;

create or replace function salvar_email_programa(
  p_programa_id uuid,
  p_ativo boolean,
  p_responsaveis uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not e_consultor_de(p_programa_id) then
    raise exception 'Você não pode configurar o e-mail deste programa.';
  end if;

  insert into programa_email_config (programa_id, ativo, atualizado_por, atualizado_em)
  values (p_programa_id, coalesce(p_ativo, false), auth.uid(), now())
  on conflict (programa_id) do update
    set ativo = excluded.ativo,
        atualizado_por = excluded.atualizado_por,
        atualizado_em = excluded.atualizado_em;

  delete from programa_email_responsaveis where programa_id = p_programa_id;

  insert into programa_email_responsaveis (programa_id, usuario_id, criado_por)
  select p_programa_id, ids.usuario_id, auth.uid()
  from (
    select distinct unnest(coalesce(p_responsaveis, '{}'::uuid[])) as usuario_id
  ) ids
  join auth.users au on au.id = ids.usuario_id
  where au.email is not null;
end;
$$;

revoke all on function salvar_email_programa(uuid, boolean, uuid[]) from public;
grant execute on function salvar_email_programa(uuid, boolean, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. STATUS DE E-MAIL INDEPENDENTE DO STATUS DO PDF
-- ---------------------------------------------------------------------------
alter table propostas
  add column if not exists email_status text not null default 'desativado',
  add column if not exists email_erro text,
  add column if not exists email_enviado_em timestamptz;

alter table propostas drop constraint if exists propostas_email_status_check;
alter table propostas add constraint propostas_email_status_check
  check (email_status in ('desativado', 'nao_configurado', 'pendente', 'enviando', 'enviado', 'falha'));

-- Migra o significado das propostas antigas sem apagar histórico.
update propostas
set
  email_status = case
    when status = 'enviada' then 'enviado'
    when status = 'enviando' then 'pendente'
    when status = 'falha' and pdf_path is not null then 'falha'
    else email_status
  end,
  email_enviado_em = coalesce(email_enviado_em, enviado_em),
  status = case
    when status in ('enviada', 'enviando') then 'gerada'
    when status = 'falha' and pdf_path is not null then 'gerada'
    else status
  end
where status in ('enviada', 'enviando', 'falha');

alter table proposta_destinatarios drop constraint if exists proposta_destinatarios_tipo_check;
alter table proposta_destinatarios add constraint proposta_destinatarios_tipo_check
  check (tipo in ('executivo', 'consultor_programa', 'responsavel_programa'));

-- Executivo original = PARA. Responsáveis configurados = CC.
-- Consultores/proprietário podem informar o executivo original ao reenviar.
drop function if exists destinatarios_da_proposta(uuid);
create or replace function destinatarios_da_proposta(
  p_programa_id uuid,
  p_executivo_id uuid
)
returns table (
  usuario_id uuid,
  email text,
  tipo text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  if p_executivo_id is distinct from auth.uid() and not e_consultor_de(p_programa_id) then
    raise exception 'Você não pode resolver destinatários para este executivo.';
  end if;

  return query
  select au.id, au.email::text, 'executivo'::text
  from auth.users au
  where au.id = p_executivo_id and au.email is not null

  union

  select au.id, au.email::text, 'responsavel_programa'::text
  from programa_email_responsaveis per
  join auth.users au on au.id = per.usuario_id
  where per.programa_id = p_programa_id
    and au.email is not null
    and au.id is distinct from p_executivo_id;
end;
$$;

revoke all on function destinatarios_da_proposta(uuid, uuid) from public;
grant execute on function destinatarios_da_proposta(uuid, uuid) to authenticated;

-- Conferências úteis:
-- select * from programa_email_config;
-- select * from programa_email_responsaveis;
-- select * from marca_cliente_manual;
-- select id, status, email_status, email_erro from propostas order by criado_em desc limit 20;
