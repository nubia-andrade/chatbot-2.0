-- GLOBO SLOTS — Entrega 6: oportunidades persistentes + governança comercial.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Pode ser executado novamente: as evoluções abaixo são idempotentes.
-- Pré-requisitos: schemas de perfis, consultor_programa, programas e Globo Take já aplicados.

-- ---------------------------------------------------------------------------
-- 1. Categorias governadas
-- ---------------------------------------------------------------------------
create table if not exists oportunidade_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint oportunidade_categorias_nome_check check (char_length(trim(nome)) between 1 and 60)
);

create unique index if not exists oportunidade_categorias_nome_unico_idx
  on oportunidade_categorias (lower(trim(nome)));

insert into oportunidade_categorias (nome, slug, ordem)
values
  ('Datas comemorativas', 'datas-comemorativas', 10),
  ('Talento', 'talento', 20),
  ('Sazonais', 'sazonais', 30)
on conflict (slug) do update
set nome = excluded.nome,
    ordem = excluded.ordem;

alter table oportunidade_categorias enable row level security;

drop policy if exists "categorias oportunidade leitura autenticada" on oportunidade_categorias;
create policy "categorias oportunidade leitura autenticada" on oportunidade_categorias
  for select to authenticated using (true);

drop policy if exists "categorias oportunidade escrita proprietario" on oportunidade_categorias;
create policy "categorias oportunidade escrita proprietario" on oportunidade_categorias
  for all to authenticated
  using (e_proprietario())
  with check (e_proprietario());

-- ---------------------------------------------------------------------------
-- 2. Formatos comerciais governados
--    Separados de `formatos`, que é a classificação técnica vinda do Take.
-- ---------------------------------------------------------------------------
create table if not exists oportunidade_formatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint oportunidade_formatos_nome_check check (char_length(trim(nome)) between 1 and 80)
);

create unique index if not exists oportunidade_formatos_nome_unico_idx
  on oportunidade_formatos (lower(trim(nome)));

insert into oportunidade_formatos (nome, slug, ordem)
values
  ('Ação no conteúdo', 'acao-no-conteudo', 10),
  ('Ação plena', 'acao-plena', 20),
  ('Participação de talento', 'participacao-de-talento', 30),
  ('Intervalo comercial', 'intervalo-comercial', 40)
on conflict (slug) do update
set nome = excluded.nome,
    ordem = excluded.ordem;

alter table oportunidade_formatos enable row level security;

drop policy if exists "formatos oportunidade leitura autenticada" on oportunidade_formatos;
create policy "formatos oportunidade leitura autenticada" on oportunidade_formatos
  for select to authenticated using (true);

drop policy if exists "formatos oportunidade escrita proprietario" on oportunidade_formatos;
create policy "formatos oportunidade escrita proprietario" on oportunidade_formatos
  for all to authenticated
  using (e_proprietario())
  with check (e_proprietario());

-- ---------------------------------------------------------------------------
-- 3. Oportunidades publicadas
-- ---------------------------------------------------------------------------
create table if not exists oportunidades (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  categoria_id uuid not null references oportunidade_categorias (id) on delete restrict,
  formato_id uuid references oportunidade_formatos (id) on delete restrict,
  tipo_exibicao text not null default 'data_unica',
  data_evento date,
  data_inicio date,
  data_fim date,
  expira_em date not null,
  prazo_envio_pi date,
  sigla text,
  valor_acao numeric(14, 2),
  direitos_conexos numeric(14, 2),
  custo_producao_tipo text not null default 'valor',
  custo_producao numeric(14, 2),
  titulo text not null,
  descricao text not null,
  imagem_url text,
  criado_por uuid not null references auth.users (id) on delete restrict,
  criado_por_nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Compatibilidade caso a primeira versão da Entrega 6 já tenha sido aplicada.
alter table oportunidades add column if not exists formato_id uuid references oportunidade_formatos (id) on delete restrict;
alter table oportunidades add column if not exists tipo_exibicao text not null default 'data_unica';
alter table oportunidades add column if not exists data_inicio date;
alter table oportunidades add column if not exists data_fim date;
alter table oportunidades add column if not exists prazo_envio_pi date;
alter table oportunidades add column if not exists sigla text;
alter table oportunidades add column if not exists valor_acao numeric(14, 2);
alter table oportunidades add column if not exists direitos_conexos numeric(14, 2);
alter table oportunidades add column if not exists custo_producao_tipo text not null default 'valor';
alter table oportunidades add column if not exists custo_producao numeric(14, 2);
alter table oportunidades alter column data_evento drop not null;

update oportunidades
set tipo_exibicao = 'data_unica'
where tipo_exibicao is null;

alter table oportunidades drop constraint if exists oportunidades_titulo_check;
alter table oportunidades add constraint oportunidades_titulo_check
  check (char_length(trim(titulo)) between 1 and 160);

alter table oportunidades drop constraint if exists oportunidades_descricao_check;
alter table oportunidades add constraint oportunidades_descricao_check
  check (char_length(trim(descricao)) between 1 and 300);

alter table oportunidades drop constraint if exists oportunidades_tipo_exibicao_check;
alter table oportunidades add constraint oportunidades_tipo_exibicao_check
  check (tipo_exibicao in ('data_unica', 'periodo'));

alter table oportunidades drop constraint if exists oportunidades_datas_exibicao_check;
alter table oportunidades add constraint oportunidades_datas_exibicao_check check (
  (tipo_exibicao = 'data_unica' and data_evento is not null and data_inicio is null and data_fim is null)
  or
  (tipo_exibicao = 'periodo' and data_evento is null and data_inicio is not null and data_fim is not null and data_inicio <= data_fim)
);

alter table oportunidades drop constraint if exists oportunidades_custo_producao_tipo_check;
alter table oportunidades add constraint oportunidades_custo_producao_tipo_check
  check (custo_producao_tipo in ('valor', 'sob_consulta'));

alter table oportunidades drop constraint if exists oportunidades_valores_check;
alter table oportunidades add constraint oportunidades_valores_check check (
  (valor_acao is null or valor_acao >= 0)
  and (direitos_conexos is null or direitos_conexos >= 0)
  and (custo_producao is null or custo_producao >= 0)
);

create index if not exists oportunidades_vitrine_idx
  on oportunidades (ativo, expira_em, data_evento);
create index if not exists oportunidades_programa_data_idx
  on oportunidades (programa_id, data_evento);
create index if not exists oportunidades_programa_periodo_idx
  on oportunidades (programa_id, data_inicio, data_fim);
create index if not exists oportunidades_categoria_idx
  on oportunidades (categoria_id, ativo, expira_em);
create index if not exists oportunidades_formato_idx
  on oportunidades (formato_id, ativo, expira_em);

alter table oportunidades enable row level security;

drop policy if exists "oportunidades leitura autenticada" on oportunidades;
create policy "oportunidades leitura autenticada" on oportunidades
  for select to authenticated using (true);

drop policy if exists "oportunidades inserir consultor" on oportunidades;
create policy "oportunidades inserir consultor" on oportunidades
  for insert to authenticated with check (
    criado_por = auth.uid()
    and (
      e_proprietario()
      or exists (
        select 1 from consultor_programa cp
        where cp.usuario_id = auth.uid()
          and cp.programa_id = oportunidades.programa_id
      )
    )
  );

drop policy if exists "oportunidades atualizar consultor" on oportunidades;
create policy "oportunidades atualizar consultor" on oportunidades
  for update to authenticated
  using (
    e_proprietario()
    or (
      criado_por = auth.uid()
      and exists (
        select 1 from consultor_programa cp
        where cp.usuario_id = auth.uid()
          and cp.programa_id = oportunidades.programa_id
      )
    )
  )
  with check (
    e_proprietario()
    or (
      criado_por = auth.uid()
      and exists (
        select 1 from consultor_programa cp
        where cp.usuario_id = auth.uid()
          and cp.programa_id = oportunidades.programa_id
      )
    )
  );

drop policy if exists "oportunidades remover consultor" on oportunidades;
create policy "oportunidades remover consultor" on oportunidades
  for delete to authenticated using (
    e_proprietario()
    or (
      criado_por = auth.uid()
      and exists (
        select 1 from consultor_programa cp
        where cp.usuario_id = auth.uid()
          and cp.programa_id = oportunidades.programa_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Storage público das imagens da vitrine
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('oportunidades', 'oportunidades', true)
on conflict (id) do update set public = true;

drop policy if exists "oportunidades imagens leitura publica" on storage.objects;
create policy "oportunidades imagens leitura publica" on storage.objects
  for select using (bucket_id = 'oportunidades');

drop policy if exists "oportunidades imagens escrita consultor" on storage.objects;
create policy "oportunidades imagens escrita consultor" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'oportunidades'
    and (e_proprietario() or tem_perfil('consultor_programa'))
  );

drop policy if exists "oportunidades imagens remocao consultor" on storage.objects;
create policy "oportunidades imagens remocao consultor" on storage.objects
  for delete to authenticated using (
    bucket_id = 'oportunidades'
    and (e_proprietario() or tem_perfil('consultor_programa'))
  );

-- Conferência rápida após aplicar:
select nome, slug, ativo, ordem from oportunidade_categorias order by ordem, nome;
select nome, slug, ativo, ordem from oportunidade_formatos order by ordem, nome;