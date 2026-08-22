-- GLOBO SLOTS — Entrega 6: oportunidades persistentes + categorias governadas.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
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
-- 2. Oportunidades publicadas
-- ---------------------------------------------------------------------------
create table if not exists oportunidades (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  categoria_id uuid not null references oportunidade_categorias (id) on delete restrict,
  data_evento date not null,
  expira_em date not null,
  titulo text not null,
  descricao text not null,
  imagem_url text,
  criado_por uuid not null references auth.users (id) on delete restrict,
  criado_por_nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint oportunidades_titulo_check check (char_length(trim(titulo)) between 1 and 160),
  constraint oportunidades_descricao_check check (char_length(trim(descricao)) between 1 and 300)
);

create index if not exists oportunidades_vitrine_idx
  on oportunidades (ativo, expira_em, data_evento);
create index if not exists oportunidades_programa_data_idx
  on oportunidades (programa_id, data_evento);
create index if not exists oportunidades_categoria_idx
  on oportunidades (categoria_id, ativo, expira_em);

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
-- 3. Storage público das imagens da vitrine
--    Conteúdo promocional, sem dado sensível; escrita continua protegida.
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
    and (
      e_proprietario()
      or tem_perfil('consultor_programa')
    )
  );

drop policy if exists "oportunidades imagens remocao consultor" on storage.objects;
create policy "oportunidades imagens remocao consultor" on storage.objects
  for delete to authenticated using (
    bucket_id = 'oportunidades'
    and (
      e_proprietario()
      or tem_perfil('consultor_programa')
    )
  );

-- Conferência rápida após aplicar:
select nome, slug, ativo, ordem
from oportunidade_categorias
order by ordem, nome;
