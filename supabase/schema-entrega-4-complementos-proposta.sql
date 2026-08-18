-- CHATBOT 2.0 — Entrega 4: complementos opcionais da proposta.
-- Rode depois de `schema-entrega-4-propostas-acessos.sql`.
-- Idempotente: pode ser executado novamente sem duplicar colunas.

-- Cadastro do programa: Redes Sociais possui valor comercial e uma produção
-- separada, ainda opcional até validação final da área de Produtos.
alter table programas
  add column if not exists custo_midia_redes_sociais numeric(14, 2),
  add column if not exists custo_producao_redes_sociais numeric(14, 2);

-- Snapshot da proposta: registra as escolhas do executivo e seus valores para
-- que histórico/PDF/relatórios não mudem quando o cadastro do programa mudar.
alter table propostas
  add column if not exists inclui_digital boolean not null default false,
  add column if not exists inclui_redes_sociais boolean not null default false,
  add column if not exists valor_redes_sociais numeric(14, 2) not null default 0,
  add column if not exists valor_producao_tv numeric(14, 2) not null default 0,
  add column if not exists valor_producao_digital numeric(14, 2) not null default 0,
  add column if not exists valor_producao_redes_sociais numeric(14, 2) not null default 0;

comment on column programas.custo_midia_redes_sociais is
  'Valor comercial de Redes Sociais por ação; regra ainda sujeita a validação da área.';
comment on column programas.custo_producao_redes_sociais is
  'Custo de produção de Redes Sociais por ação, quando aplicável.';
comment on column propostas.inclui_digital is
  'Digital foi selecionado como complemento global para todas as datas da proposta.';
comment on column propostas.inclui_redes_sociais is
  'Redes Sociais foi selecionado como complemento global para todas as datas da proposta.';
