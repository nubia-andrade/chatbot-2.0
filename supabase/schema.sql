-- CHATBOT 2.0 — Entrega 1. Rode uma vez no SQL Editor do Supabase.

create table if not exists perfil_usuario (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cargo text,
  perfil text not null default 'executivo'
    check (perfil in ('executivo', 'admin_programa', 'admin_geral')),
  criado_em timestamptz not null default now()
);

create table if not exists programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mnemonico text not null unique,
  imagem_url text,
  canal text not null,
  possui_fluxo_aprovacao boolean not null default false,
  contem_digital boolean not null default false,
  redes_sociais boolean not null default false,
  estado text not null default 'em_configuracao'
    check (estado in ('ativo', 'inativo', 'em_configuracao')),
  dias_da_semana smallint[] not null default '{}',
  slots integer not null check (slots >= 1),
  bloqueio_mensal integer not null default 0,
  acoes_minimas integer not null default 1,
  acoes_maximas integer not null default 1,
  custo_midia numeric(14, 2),
  custo_producao numeric(14, 2),
  prazo_minimo_dias integer not null default 0 check (prazo_minimo_dias >= 0),
  percentual_simulcast numeric(5, 2),
  custo_multishow numeric(14, 2),
  disponivel_para_proposta boolean not null default false,
  criado_em timestamptz not null default now(),
  check (acoes_minimas <= acoes_maximas)
);

-- Quatro dos 23 programas chegam da API sem mnemônico. Sem apelido, ficariam
-- invisíveis ao cálculo de ocupação.
create table if not exists programa_apelidos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  texto text not null unique
);

create table if not exists formatos (
  formato text primary key,
  categoria text not null check (categoria in (
    'AÇÃO DE CONTEÚDO', 'COMERCIAL', 'CONTEÚDO NO BREAK',
    'INSERT', 'VINHETA', 'CHAMADA'
  ))
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  setor text,
  industria text,
  executivo text,
  email text
);

create index if not exists clientes_nome_idx on clientes (nome);
create index if not exists clientes_cnpj_idx on clientes (cnpj);

-- Snapshot da API do Globo Take. Substituído por inteiro a cada importação:
-- uma venda cancelada some da origem e precisa sumir daqui também.
create table if not exists acoes_vendidas (
  numero_da_entrega text primary key,
  programa text not null,
  data_de_exibicao date not null,
  anunciante text,
  marca text,
  formato text,
  tipo_da_entrega text,
  status_aprovacao text,
  importado_em timestamptz not null default now()
);

create index if not exists acoes_programa_data_idx
  on acoes_vendidas (programa, data_de_exibicao);

alter table perfil_usuario enable row level security;
alter table programas enable row level security;
alter table programa_apelidos enable row level security;
alter table formatos enable row level security;
alter table clientes enable row level security;
alter table acoes_vendidas enable row level security;

create or replace function e_administrador()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfil_usuario
    where usuario_id = auth.uid()
      and perfil in ('admin_programa', 'admin_geral')
  );
$$;

drop policy if exists "perfil proprio" on perfil_usuario;
create policy "perfil proprio" on perfil_usuario
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "leitura autenticada" on programas;
create policy "leitura autenticada" on programas
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programas;
create policy "escrita administrador" on programas
  for all to authenticated using (e_administrador()) with check (e_administrador());

drop policy if exists "leitura autenticada" on programa_apelidos;
create policy "leitura autenticada" on programa_apelidos
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programa_apelidos;
create policy "escrita administrador" on programa_apelidos
  for all to authenticated using (e_administrador()) with check (e_administrador());

drop policy if exists "leitura autenticada" on formatos;
create policy "leitura autenticada" on formatos
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on clientes;
create policy "leitura autenticada" on clientes
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on acoes_vendidas;
create policy "leitura autenticada" on acoes_vendidas
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage: imagens dos programas
-- ---------------------------------------------------------------------------
-- Bucket público: a imagem do programa aparece na lista do cadastro e, nas
-- próximas entregas, na proposta — não é dado sensível e não vale o custo de
-- gerar URL assinada a cada exibição. Escrever, porém, continua restrito a
-- administradores.
--
-- Se este trecho falhar por permissão no SQL Editor, dá para criar o bucket
-- pelo painel (Storage > New bucket > nome `programas`, marcado como Public)
-- — o README explica o passo a passo.
insert into storage.buckets (id, name, public)
values ('programas', 'programas', true)
on conflict (id) do update set public = true;

drop policy if exists "imagens de programa: leitura publica" on storage.objects;
create policy "imagens de programa: leitura publica" on storage.objects
  for select using (bucket_id = 'programas');

drop policy if exists "imagens de programa: escrita administrador" on storage.objects;
create policy "imagens de programa: escrita administrador" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'programas' and e_administrador());

drop policy if exists "imagens de programa: substituicao administrador" on storage.objects;
create policy "imagens de programa: substituicao administrador" on storage.objects
  for update to authenticated
  using (bucket_id = 'programas' and e_administrador())
  with check (bucket_id = 'programas' and e_administrador());

drop policy if exists "imagens de programa: remocao administrador" on storage.objects;
create policy "imagens de programa: remocao administrador" on storage.objects
  for delete to authenticated
  using (bucket_id = 'programas' and e_administrador());
