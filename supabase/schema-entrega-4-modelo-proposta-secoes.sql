-- CHATBOT 2.0 — Entrega 4: seções do modelo de proposta.
-- Execute depois de schema-entrega-4-modelo-proposta.sql.
-- Idempotente: pode ser reaplicado.

alter table programa_modelo_slides
  add column if not exists secao text not null default 'conteudo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'programa_modelo_slides_secao_check'
  ) then
    alter table programa_modelo_slides
      add constraint programa_modelo_slides_secao_check
      check (secao in (
        'capa',
        'conteudo',
        'digital',
        'redes_sociais',
        'valor',
        'observacoes',
        'contracapa'
      ));
  end if;
end $$;

-- Slides criados antes desta migração ficam em Conteúdo. Isso preserva os
-- arquivos existentes e permite que a pessoa os reorganize pela nova tela.
update programa_modelo_slides
set secao = 'conteudo'
where secao is null or secao = '';

create index if not exists programa_modelo_slides_programa_secao_ordem_idx
  on programa_modelo_slides (programa_id, secao, ordem, criado_em);

-- Capa, Valor (fundo opcional do resumo calculado) e Contracapa são seções
-- de slide único. As demais aceitam múltiplas imagens.
create unique index if not exists programa_modelo_slides_capa_unica_idx
  on programa_modelo_slides (programa_id)
  where secao = 'capa';

create unique index if not exists programa_modelo_slides_valor_unico_idx
  on programa_modelo_slides (programa_id)
  where secao = 'valor';

create unique index if not exists programa_modelo_slides_contracapa_unica_idx
  on programa_modelo_slides (programa_id)
  where secao = 'contracapa';
