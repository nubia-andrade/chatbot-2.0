-- CHATBOT 2.0 — Entrega 3: consultas gravadas.
--
-- Rode no SQL Editor do Supabase DEPOIS de toda a sequência da Entrega 2.
-- Pode rodar quantas vezes quiser: tudo usa `if not exists` / `drop policy if
-- exists`.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql
--   6. supabase/schema-datas-especiais.sql
--   7. supabase/schema-datas-especiais-dias.sql
--   8. supabase/schema-clientes-regional.sql
--   9. supabase/schema-entrega-3.sql   <- este

-- ---------------------------------------------------------------------------
-- Uma consulta é o RETRATO do que foi validado num instante, não um ponteiro
-- para o estado atual. Preço muda, programa é renomeado, cliente é
-- reclassificado — a consulta de agosto precisa continuar dizendo em novembro
-- o que dizia em agosto. Por isso `cliente_nome` convive com `cliente_id`, do
-- mesmo jeito que `acoes_regionais` já faz.
-- ---------------------------------------------------------------------------
create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,

  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  cliente_setor text,
  cliente_industria text,

  programa_id uuid references programas (id),
  programa_nome text not null,

  modalidade text not null check (modalidade in ('nacional', 'regional')),
  valor_total numeric(14, 2) not null default 0,

  -- O que NÃO pôde ser verificado: hoje, ações cujo anunciante não casou com
  -- a carteira. jsonb porque a lista vai crescer e ninguém consulta por ela —
  -- só a lê junto da consulta.
  avisos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now()
);

create index if not exists consultas_usuario_idx on consultas (usuario_id, criado_em desc);

create table if not exists consulta_itens (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas (id) on delete cascade,
  data date not null,
  quantidade integer not null check (quantidade >= 1),
  -- Vazio no nacional; até `max_pracas_por_acao` códigos no regional.
  pracas text[] not null default '{}',
  valor_unitario numeric(14, 2),
  valor_total numeric(14, 2) not null default 0,
  periodo_especial_nome text,
  periodo_especial_percentual numeric(5, 2),
  unique (consulta_id, data)
);

create index if not exists consulta_itens_consulta_idx on consulta_itens (consulta_id);

-- ---------------------------------------------------------------------------
-- RLS — o executivo vê as PRÓPRIAS consultas; o proprietário vê todas.
-- Ninguém edita consulta gravada: um retrato que se altera não é retrato.
-- ---------------------------------------------------------------------------
alter table consultas enable row level security;
alter table consulta_itens enable row level security;

drop policy if exists "consulta propria" on consultas;
create policy "consulta propria" on consultas
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "grava consulta propria" on consultas;
create policy "grava consulta propria" on consultas
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "item de consulta propria" on consulta_itens;
create policy "item de consulta propria" on consulta_itens
  for select to authenticated using (
    exists (
      select 1 from consultas c
      where c.id = consulta_id and (c.usuario_id = auth.uid() or e_proprietario())
    )
  );

drop policy if exists "grava item de consulta propria" on consulta_itens;
create policy "grava item de consulta propria" on consulta_itens
  for insert to authenticated with check (
    exists (select 1 from consultas c where c.id = consulta_id and c.usuario_id = auth.uid())
  );
