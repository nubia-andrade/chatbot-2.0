-- CHATBOT 2.0 — Datas especiais: dias da semana específicos dentro do
-- período. Caso real: o Mais Você, de janeiro a abril, tem valor
-- diferenciado só às quartas-feiras — a seção só aceitava "todo o período",
-- e esse caso não cabia.
--
-- `dias_da_semana smallint[]` é OPCIONAL: vazio ou nulo continua significando
-- "todos os dias do período" — o comportamento que já existia antes deste
-- arquivo, e que continua funcionando sem mudança nenhuma para quem já tem
-- períodos cadastrados. Convenção 0=domingo … 6=sábado, a mesma de
-- `programas.dias_da_semana` e de `Date.getUTCDay()`.
--
-- A regra "períodos do mesmo programa não podem se sobrepor" (checada em
-- `src/lib/dominio/datas-especiais.ts`, não no banco) muda para considerar
-- também os dias da semana: dois períodos só conflitam quando têm data E
-- dia da semana em comum de verdade. Nada aqui precisa mudar por causa
-- disso — é regra de domínio, na aplicação.
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
--   7. supabase/schema-datas-especiais-dias.sql            <- este
--
-- ---------------------------------------------------------------------------
-- 1. Coluna
-- ---------------------------------------------------------------------------
alter table datas_especiais
  add column if not exists dias_da_semana smallint[];

comment on column datas_especiais.dias_da_semana is
  '0=domingo … 6=sábado. Vazio ou nulo = todos os dias do período.';

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto não deve dar erro nenhum:
--
--   select id, nome, data_inicio, data_fim, dias_da_semana
--   from datas_especiais limit 1;
--
-- E isto deve gravar normalmente, com o período valendo só às quartas
-- (dia 3) dentro do intervalo:
--
--   insert into datas_especiais (programa_id, nome, data_inicio, data_fim, percentual_acrescimo, dias_da_semana)
--   values ((select id from programas limit 1), 'Teste quartas', '2026-01-01', '2026-04-30', 15, array[3]::smallint[]);
--
-- E as linhas já existentes, sem `dias_da_semana`, continuam com o campo
-- nulo — "todos os dias" — sem precisar de nenhum UPDATE de backfill.
