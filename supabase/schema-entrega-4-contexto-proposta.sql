-- CHATBOT 2.0 — Entrega 4: contexto informado pelo executivo.
-- Rode depois de `schema-entrega-4-propostas-acessos.sql`.
-- Idempotente: pode ser executado novamente sem duplicar colunas.

alter table propostas
  add column if not exists produto text not null default '',
  add column if not exists objetivo text not null default '';

comment on column propostas.produto is
  'Produto/campanha informado pelo executivo. Snapshot para histórico e relatórios; não é impresso no slide de investimento.';
comment on column propostas.objetivo is
  'Objetivo livre informado pelo executivo e impresso na proposta comercial.';
