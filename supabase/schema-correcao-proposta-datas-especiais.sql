-- CHATBOT 2.0 — Correção consolidada: Datas Especiais + contexto/complementos da proposta
-- Data: 2026-08-18
--
-- Objetivo: permitir que ambientes que já possuem a estrutura da Entrega 4
-- recebam, em uma única execução, as colunas incrementais necessárias para:
--   1) cadastrar Datas Especiais por dias da semana;
--   2) salvar Produto e Objetivo na proposta;
--   3) salvar Digital, Redes Sociais e custos de produção separados.
--
-- PRÉ-REQUISITO: `schema-entrega-4-propostas-acessos.sql` já deve ter sido
-- executado, pois este arquivo pressupõe que as tabelas `propostas`,
-- `programas` e `datas_especiais` existem.
--
-- É IDEMPOTENTE: pode ser executado novamente sem duplicar colunas.

begin;

-- ---------------------------------------------------------------------------
-- Datas especiais — dias da semana opcionais dentro do intervalo
-- 0=domingo … 6=sábado; nulo/vazio = todos os dias do período.
-- ---------------------------------------------------------------------------
alter table datas_especiais
  add column if not exists dias_da_semana smallint[];

comment on column datas_especiais.dias_da_semana is
  '0=domingo … 6=sábado. Vazio ou nulo = todos os dias do período.';

-- ---------------------------------------------------------------------------
-- Cadastro do programa — Redes Sociais
-- ---------------------------------------------------------------------------
alter table programas
  add column if not exists custo_midia_redes_sociais numeric(14, 2),
  add column if not exists custo_producao_redes_sociais numeric(14, 2);

-- ---------------------------------------------------------------------------
-- Snapshot da proposta — contexto informado pelo executivo
-- ---------------------------------------------------------------------------
alter table propostas
  add column if not exists produto text not null default '',
  add column if not exists objetivo text not null default '';

comment on column propostas.produto is
  'Produto/campanha informado pelo executivo. Snapshot para histórico e relatórios; não é impresso no slide de investimento.';
comment on column propostas.objetivo is
  'Objetivo livre informado pelo executivo e impresso na proposta comercial.';

-- ---------------------------------------------------------------------------
-- Snapshot da proposta — complementos e produções
-- ---------------------------------------------------------------------------
alter table propostas
  add column if not exists inclui_digital boolean not null default false,
  add column if not exists inclui_redes_sociais boolean not null default false,
  add column if not exists valor_redes_sociais numeric(14, 2) not null default 0,
  add column if not exists valor_producao_tv numeric(14, 2) not null default 0,
  add column if not exists valor_producao_digital numeric(14, 2) not null default 0,
  add column if not exists valor_producao_redes_sociais numeric(14, 2) not null default 0;

comment on column propostas.inclui_digital is
  'Digital foi selecionado como complemento global para todas as datas da proposta.';
comment on column propostas.inclui_redes_sociais is
  'Redes Sociais foi selecionado como complemento global para todas as datas da proposta.';

commit;

-- Solicita ao PostgREST/Supabase que atualize o cache do schema imediatamente.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA
-- Se este SELECT retornar as 11 linhas abaixo, a correção estrutural está ok.
-- ---------------------------------------------------------------------------
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'datas_especiais' and column_name = 'dias_da_semana')
    or (table_name = 'programas' and column_name in (
      'custo_midia_redes_sociais',
      'custo_producao_redes_sociais'
    ))
    or (table_name = 'propostas' and column_name in (
      'produto',
      'objetivo',
      'inclui_digital',
      'inclui_redes_sociais',
      'valor_redes_sociais',
      'valor_producao_tv',
      'valor_producao_digital',
      'valor_producao_redes_sociais'
    ))
  )
order by table_name, column_name;
