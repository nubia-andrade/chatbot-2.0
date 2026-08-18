-- CHATBOT 2.0 — Entrega 4: modelo visual de propostas por programa.
-- Execute depois de schema-entrega-4-propostas-acessos.sql.
-- Idempotente: pode ser reaplicado.

create table if not exists programa_modelo_slides (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  imagem_url text not null,
  secao text not null default 'conteudo'
    check (secao in (
      'capa', 'conteudo', 'digital', 'redes_sociais',
      'valor', 'observacoes', 'contracapa'
    )),
  ordem integer not null default 1 check (ordem >= 1),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Para bancos que já tinham a versão anterior desta tabela.
alter table programa_modelo_slides
  add column if not exists secao text not null default 'conteudo';

create index if not exists programa_modelo_slides_programa_ordem_idx
  on programa_modelo_slides (programa_id, ordem, criado_em);

create index if not exists programa_modelo_slides_programa_secao_ordem_idx
  on programa_modelo_slides (programa_id, secao, ordem, criado_em);

alter table programa_modelo_slides enable row level security;

drop policy if exists "modelo proposta leitura autenticada" on programa_modelo_slides;
create policy "modelo proposta leitura autenticada" on programa_modelo_slides
  for select to authenticated using (true);

drop policy if exists "modelo proposta inserir autorizado" on programa_modelo_slides;
create policy "modelo proposta inserir autorizado" on programa_modelo_slides
  for insert to authenticated with check (
    e_proprietario()
    or exists (
      select 1 from consultor_programa cp
      where cp.usuario_id = auth.uid()
        and cp.programa_id = programa_id
    )
  );

drop policy if exists "modelo proposta atualizar autorizado" on programa_modelo_slides;
create policy "modelo proposta atualizar autorizado" on programa_modelo_slides
  for update to authenticated
  using (
    e_proprietario()
    or exists (
      select 1 from consultor_programa cp
      where cp.usuario_id = auth.uid()
        and cp.programa_id = programa_id
    )
  )
  with check (
    e_proprietario()
    or exists (
      select 1 from consultor_programa cp
      where cp.usuario_id = auth.uid()
        and cp.programa_id = programa_id
    )
  );

drop policy if exists "modelo proposta remover autorizado" on programa_modelo_slides;
create policy "modelo proposta remover autorizado" on programa_modelo_slides
  for delete to authenticated using (
    e_proprietario()
    or exists (
      select 1 from consultor_programa cp
      where cp.usuario_id = auth.uid()
        and cp.programa_id = programa_id
    )
  );
