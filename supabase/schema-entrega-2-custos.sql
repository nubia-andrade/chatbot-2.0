-- CHATBOT 2.0 — reestruturação da seção de Custos do cadastro de programa:
-- nacional separado de regional, TV separado de digital, e "direitos e
-- conexos" deixa de ser um campo digitado para virar um valor calculado
-- (15% da mídia de TV com simulcast; 15% da mídia digital, sem simulcast —
-- ver `src/lib/dominio/direitos-e-conexos.ts`).
--
-- Rode no SQL Editor do Supabase DEPOIS de schema.sql, schema-entrega-2.sql
-- e schema-entrega-2-correcoes.sql. Pode rodar quantas vezes quiser: todo
-- rename é protegido por um `if exists`, todo `add column` usa
-- `if not exists`, e os `drop column` usam `if exists`.
--
-- Este arquivo é o ÚLTIMO da sequência. Os três anteriores já foram
-- aplicados no banco de produção e por isso não são editados — corrigi-los
-- no lugar faria a versão do repositório divergir do que a usuária realmente
-- rodou.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql   <- este
--
-- Depois deste arquivo, rode de novo `supabase/seed-regional.sql` — ele foi
-- atualizado para gravar nos nomes de coluna novos e não funciona mais
-- contra o schema antigo.
--
-- ---------------------------------------------------------------------------
-- O QUE ACONTECE COM CADA DADO QUE JÁ EXISTE NO BANCO
-- ---------------------------------------------------------------------------
-- Em `programas`:
--   custo_midia             → RENOMEADA para custo_midia_tv.        Dado preservado
--                              (ex.: o É de Casa mantém os 376.000,00 que
--                              tinha em custo_midia).
--   custo_producao          → RENOMEADA para custo_producao_tv.     Dado preservado
--                              (ex.: o É de Casa mantém os 8.300,00).
--   custo_midia_digital     → coluna NOVA, nasce nula em todo mundo.
--   custo_producao_digital  → coluna NOVA, nasce nula em todo mundo.
--   percentual_simulcast    → sem mudança nenhuma.
--   custo_multishow         → REMOVIDA. A área não usa este campo; o valor
--                              que existisse ali é perdido — decisão
--                              explícita do pedido, não efeito colateral.
--   direitos_e_conexos      → REMOVIDA. Vira valor calculado a partir da
--                              mídia de TV e do simulcast (nunca mais
--                              digitado); o número que estava gravado deixa
--                              de ser lido em qualquer lugar do app a partir
--                              desta migração.
--   custo_producao_regional → REMOVIDA. A produção regional passa a ser por
--                              praça — mora agora em
--                              preco_regional.custo_producao_tv, uma coluna
--                              nova (nula) — o valor único que existia por
--                              programa NÃO é copiado para as 5 praças
--                              automaticamente, porque um valor por-programa
--                              não diz quanto cabe a cada praça. Redistribuir
--                              é decisão de Pricing, não desta migração.
--
-- Em `preco_regional`:
--   valor                   → RENOMEADA para custo_midia_tv.        Dado preservado
--                              (ex.: SP continua com 49.000,00 no Encontro,
--                              53.000,00 no É de Casa — é o mesmo número,
--                              só com o nome que sempre lhe cabeu).
--   custo_producao_tv       → coluna NOVA, nasce nula.
--   percentual_simulcast    → coluna NOVA, nasce nula.
--   custo_midia_digital     → coluna NOVA, nasce nula.
--   custo_producao_digital  → coluna NOVA, nasce nula.
--
-- Nada é apagado sem estar listado acima. Se você já rodou este arquivo
-- antes, rodar de novo não repete o `drop`: a coluna já não existe, o
-- `if exists` pula silenciosamente.

-- ---------------------------------------------------------------------------
-- 1. `programas`
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'programas' and column_name = 'custo_midia'
  ) then
    alter table programas rename column custo_midia to custo_midia_tv;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'programas' and column_name = 'custo_producao'
  ) then
    alter table programas rename column custo_producao to custo_producao_tv;
  end if;
end $$;

alter table programas add column if not exists custo_midia_digital numeric(14, 2);
alter table programas add column if not exists custo_producao_digital numeric(14, 2);

alter table programas drop column if exists custo_multishow;
alter table programas drop column if exists direitos_e_conexos;
alter table programas drop column if exists custo_producao_regional;

-- ---------------------------------------------------------------------------
-- 2. `preco_regional`
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'preco_regional' and column_name = 'valor'
  ) then
    alter table preco_regional rename column valor to custo_midia_tv;
  end if;
end $$;

-- Cosmético, não funcional: o `check (valor >= 0)` original nasceu com o
-- nome automático `preco_regional_valor_check`. Renomeia junto para não
-- deixar um constraint chamado "valor" numa coluna que se chama
-- "custo_midia_tv" — quem ler `\d preco_regional` no psql não deveria
-- estranhar o nome.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'preco_regional_valor_check'
  ) and not exists (
    select 1 from pg_constraint where conname = 'preco_regional_custo_midia_tv_check'
  ) then
    alter table preco_regional
      rename constraint preco_regional_valor_check to preco_regional_custo_midia_tv_check;
  end if;
end $$;

alter table preco_regional add column if not exists custo_producao_tv numeric(14, 2);
alter table preco_regional add column if not exists percentual_simulcast numeric(5, 2);
alter table preco_regional add column if not exists custo_midia_digital numeric(14, 2);
alter table preco_regional add column if not exists custo_producao_digital numeric(14, 2);

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto não deve dar erro nenhum (confirma que as colunas
-- novas existem e as antigas sumiram):
--
--   select custo_midia_tv, custo_producao_tv, custo_midia_digital,
--          custo_producao_digital, percentual_simulcast
--   from programas limit 1;
--
--   select custo_midia_tv, custo_producao_tv, percentual_simulcast,
--          custo_midia_digital, custo_producao_digital
--   from preco_regional limit 1;
--
-- E isto deve devolver o mesmo número de antes (o rename preserva o dado):
--
--   select nome, mnemonico, custo_midia_tv, custo_producao_tv
--   from programas where mnemonico in ('CASA', 'FATI');
