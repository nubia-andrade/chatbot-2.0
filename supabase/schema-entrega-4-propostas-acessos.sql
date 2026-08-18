-- CHATBOT 2.0 — Entrega 4: propostas, destinatários e gestão de acessos.
--
-- Rode no SQL Editor do Supabase DEPOIS de `schema-entrega-3.sql` e dos
-- schemas de marcas já aplicados. O arquivo é idempotente para estrutura e
-- policies; as funções usam `create or replace`.

-- ---------------------------------------------------------------------------
-- PROPOSTAS
-- Uma proposta é o documento final gerado a partir de uma consulta gravada.
-- A consulta continua sendo o retrato da disponibilidade; a proposta guarda
-- o retrato comercial/financeiro e o resultado do envio.
-- ---------------------------------------------------------------------------
create table if not exists propostas (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null unique references consultas (id) on delete restrict,
  usuario_id uuid not null references auth.users (id) on delete restrict,

  marca_id uuid references marcas (id),
  marca_nome text,
  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  programa_id uuid references programas (id),
  programa_nome text not null,
  modalidade text not null check (modalidade in ('nacional', 'regional')),

  -- Bloco comercial: o que compõe o Total Comercial exibido na proposta.
  valor_midia_tv numeric(14, 2) not null default 0,
  valor_midia_digital numeric(14, 2) not null default 0,
  valor_simulcast numeric(14, 2) not null default 0,
  valor_total_comercial numeric(14, 2) not null default 0,

  -- Valores destacados fora do Total Comercial.
  valor_producao numeric(14, 2) not null default 0,
  valor_direitos_tv numeric(14, 2) not null default 0,
  valor_direitos_digital numeric(14, 2) not null default 0,
  valor_direitos_total numeric(14, 2) not null default 0,

  -- Total financeiro completo, útil para relatórios internos. Na apresentação
  -- ao cliente, Produção e Direitos continuam discriminados separadamente.
  valor_total_geral numeric(14, 2) not null default 0,

  pdf_path text,
  status text not null default 'gerando'
    check (status in ('gerando', 'gerada', 'enviando', 'enviada', 'falha')),
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);

create index if not exists propostas_usuario_idx on propostas (usuario_id, criado_em desc);
create index if not exists propostas_programa_idx on propostas (programa_id, criado_em desc);
create index if not exists propostas_cliente_idx on propostas (cliente_id, criado_em desc);

create table if not exists proposta_destinatarios (
  proposta_id uuid not null references propostas (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  email text not null,
  tipo text not null check (tipo in ('executivo', 'consultor_programa')),
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'falha')),
  erro text,
  enviado_em timestamptz,
  primary key (proposta_id, email)
);

create index if not exists proposta_destinatarios_usuario_idx
  on proposta_destinatarios (usuario_id, proposta_id);

alter table propostas enable row level security;
alter table proposta_destinatarios enable row level security;

-- O executivo vê as próprias propostas. Consultores enxergam as propostas
-- dos programas a que estão vinculados. Proprietário enxerga tudo porque
-- `e_consultor_de` já considera o perfil proprietário.
drop policy if exists "proposta visivel" on propostas;
create policy "proposta visivel" on propostas
  for select to authenticated using (
    usuario_id = auth.uid()
    or (programa_id is not null and e_consultor_de(programa_id))
  );

drop policy if exists "proposta propria inserir" on propostas;
create policy "proposta propria inserir" on propostas
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "proposta propria atualizar" on propostas;
create policy "proposta propria atualizar" on propostas
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "destinatario de proposta visivel" on proposta_destinatarios;
create policy "destinatario de proposta visivel" on proposta_destinatarios
  for select to authenticated using (
    exists (
      select 1 from propostas p
      where p.id = proposta_id
        and (p.usuario_id = auth.uid() or (p.programa_id is not null and e_consultor_de(p.programa_id)))
    )
  );

drop policy if exists "destinatario de proposta propria inserir" on proposta_destinatarios;
create policy "destinatario de proposta propria inserir" on proposta_destinatarios
  for insert to authenticated with check (
    exists (select 1 from propostas p where p.id = proposta_id and p.usuario_id = auth.uid())
  );

drop policy if exists "destinatario de proposta propria atualizar" on proposta_destinatarios;
create policy "destinatario de proposta propria atualizar" on proposta_destinatarios
  for update to authenticated
  using (exists (select 1 from propostas p where p.id = proposta_id and p.usuario_id = auth.uid()))
  with check (exists (select 1 from propostas p where p.id = proposta_id and p.usuario_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- PDF — bucket privado.
-- O caminho canônico será `<usuario_id>/<proposta_id>.pdf`.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('propostas', 'propostas', false)
on conflict (id) do update set public = false;

drop policy if exists "pdf proposta: leitura autorizada" on storage.objects;
create policy "pdf proposta: leitura autorizada" on storage.objects
  for select to authenticated using (
    bucket_id = 'propostas'
    and exists (
      select 1
      from propostas p
      where (p.id::text || '.pdf') = split_part(name, '/', 2)
        and (
          p.usuario_id = auth.uid()
          or (p.programa_id is not null and e_consultor_de(p.programa_id))
        )
    )
  );

drop policy if exists "pdf proposta: escrita propria" on storage.objects;
create policy "pdf proposta: escrita propria" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'propostas'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "pdf proposta: atualizacao propria" on storage.objects;
create policy "pdf proposta: atualizacao propria" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'propostas'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'propostas'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- GESTÃO DE PERFIS E ACESSOS
-- A estrutura perfil_usuario + consultor_programa já existe desde a Entrega 2.
-- As RPCs abaixo expõem uma interface administrativa segura para a futura tela
-- Configurações > Perfis e acessos.
-- ---------------------------------------------------------------------------
create or replace function listar_usuarios_acessos()
returns table (
  usuario_id uuid,
  email text,
  nome text,
  cargo text,
  perfis text[],
  programas uuid[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not e_proprietario() then
    raise exception 'Apenas o proprietário pode administrar perfis e acessos.';
  end if;

  return query
  select
    au.id,
    coalesce(au.email, ''),
    coalesce(u.nome, au.email, ''),
    u.cargo,
    coalesce(
      (select array_agg(pu.perfil order by pu.perfil)
       from public.perfil_usuario pu
       where pu.usuario_id = au.id),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(cp.programa_id order by cp.programa_id)
       from public.consultor_programa cp
       where cp.usuario_id = au.id),
      '{}'::uuid[]
    )
  from auth.users au
  left join public.usuario u on u.usuario_id = au.id
  order by coalesce(u.nome, au.email, '');
end;
$$;

revoke all on function listar_usuarios_acessos() from public;
grant execute on function listar_usuarios_acessos() to authenticated;

create or replace function atualizar_acessos_usuario(
  p_usuario_id uuid,
  p_perfis text[],
  p_programas uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text;
begin
  if not e_proprietario() then
    raise exception 'Apenas o proprietário pode administrar perfis e acessos.';
  end if;

  if p_usuario_id is null then
    raise exception 'Usuário inválido.';
  end if;

  if p_perfis is null or cardinality(p_perfis) = 0 then
    raise exception 'O usuário precisa ter ao menos um perfil.';
  end if;

  foreach v_perfil in array p_perfis loop
    if v_perfil not in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario') then
      raise exception 'Perfil inválido: %', v_perfil;
    end if;
  end loop;

  delete from perfil_usuario where usuario_id = p_usuario_id;
  insert into perfil_usuario (usuario_id, perfil)
  select p_usuario_id, unnest(p_perfis);

  delete from consultor_programa where usuario_id = p_usuario_id;
  if 'consultor_programa' = any(p_perfis) then
    insert into consultor_programa (usuario_id, programa_id)
    select p_usuario_id, programa_id
    from unnest(coalesce(p_programas, '{}'::uuid[])) as programa_id
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function atualizar_acessos_usuario(uuid, text[], uuid[]) from public;
grant execute on function atualizar_acessos_usuario(uuid, text[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Destinatários automáticos de uma proposta.
-- Devolve o executivo autenticado + consultores vinculados ao programa.
-- O e-mail dos consultores vem de auth.users; a UI nunca precisa manter uma
-- lista paralela de destinatários.
-- ---------------------------------------------------------------------------
create or replace function destinatarios_da_proposta(p_programa_id uuid)
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

  return query
  select au.id, au.email::text, 'executivo'::text
  from auth.users au
  where au.id = auth.uid() and au.email is not null

  union

  select au.id, au.email::text, 'consultor_programa'::text
  from public.consultor_programa cp
  join public.perfil_usuario pu
    on pu.usuario_id = cp.usuario_id and pu.perfil = 'consultor_programa'
  join auth.users au on au.id = cp.usuario_id
  where cp.programa_id = p_programa_id
    and au.email is not null;
end;
$$;

revoke all on function destinatarios_da_proposta(uuid) from public;
grant execute on function destinatarios_da_proposta(uuid) to authenticated;
