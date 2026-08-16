-- CHATBOT 2.0 — Elegibilidade de clientes para ações regionais. Caso real: a
-- área marcou, numa coluna nova da carteira (`dados/Carteira.xlsx`, que foi
-- de 8 para 12 colunas), quais dos 15.519 clientes podem comprar ação
-- regional — só 779 deles.
--
-- A elegibilidade é do CLIENTE, GLOBAL: vale para qualquer programa que
-- aceite regional, não é configuração por programa. Por isso a coluna entra
-- em `clientes`, não em `preco_regional`/`acoes_regionais`.
--
-- As outras três colunas novas da planilha (`Segmentação SE`, `Cód SISCOM`,
-- `Setor IBOPE`) entram junto, só para guardar o dado. `Setor IBOPE` NÃO
-- participa da regra de concorrência: `concorrenteNaData`
-- (`src/lib/dominio/restricoes.ts`) continua usando `setor` + `industria`
-- como hoje — decisão da área, não mude essa regra por causa desta coluna.
--
-- Rode no SQL Editor do Supabase DEPOIS de todos os arquivos abaixo, na
-- ordem. Idempotente: `add column if not exists`.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql
--   6. supabase/schema-datas-especiais.sql
--   7. supabase/schema-datas-especiais-dias.sql
--   8. supabase/schema-clientes-regional.sql                 <- este
--
-- ---------------------------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------------------------
alter table clientes
  add column if not exists segmentacao_se text,
  add column if not exists cod_siscom text,
  add column if not exists apto_regional boolean not null default false,
  add column if not exists setor_ibope text;

comment on column clientes.segmentacao_se is
  'Segmentação SE da carteira (dados/Carteira.xlsx). Só guardada — nenhuma regra depende dela.';
comment on column clientes.cod_siscom is
  'Cód SISCOM da carteira. Só guardado — nenhuma regra depende dele.';
comment on column clientes.apto_regional is
  'Cliente elegível para ações regionais, em qualquer programa. Vem de "Apto Proposta '
  'Regional = Elegível" na carteira. Global — não é configuração por programa.';
comment on column clientes.setor_ibope is
  'Setor IBOPE da carteira. Só guardado — a regra de concorrência (concorrenteNaData, '
  'src/lib/dominio/restricoes.ts) continua usando setor + industria, não esta coluna.';

-- ---------------------------------------------------------------------------
-- 2. Índice
-- ---------------------------------------------------------------------------
-- "Quem é elegível" roda em toda busca do wizard regional (a tela de gestão
-- em /configuracoes/clientes-regionais e o resumo na aba Regional de cada
-- programa) — sem índice, cada consulta varreria os 15.519 clientes.
create index if not exists clientes_apto_regional_idx on clientes (apto_regional);

-- ---------------------------------------------------------------------------
-- 3. RLS — escrita de elegibilidade
-- ---------------------------------------------------------------------------
-- `clientes` só tinha política de leitura (`supabase/schema.sql`). A tela de
-- gestão da elegibilidade precisa gravar `apto_regional`; usa a mesma regra
-- de "quem administra" das outras tabelas de configuração
-- (`e_administrador()`, definida em `supabase/schema-entrega-2.sql`):
-- consultor de programa ou proprietário.
drop policy if exists "escrita administrador" on clientes;
create policy "escrita administrador" on clientes
  for update to authenticated using (e_administrador()) with check (e_administrador());

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto não deve dar erro nenhum:
--
--   select id, nome, segmentacao_se, cod_siscom, apto_regional, setor_ibope
--   from clientes limit 1;
--
-- E isto deve bater com o que a carteira original marcou como "Elegível"
-- (esperado, na carga de referência: 779 de 15.519):
--
--   select count(*) filter (where apto_regional), count(*) from clientes;
