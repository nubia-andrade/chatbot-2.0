-- CHATBOT 2.0 — produção regional é ÚNICA por PROGRAMA, não por praça, e o
-- bloqueio mensal do regional ganha coluna própria, separada do bloqueio
-- mensal nacional.
--
-- Duas decisões da área, tomadas depois de `schema-entrega-2-custos.sql`:
--
--   1. Um cliente que compra SP, RJ e BH paga a produção da ação UMA vez,
--      não três. A mídia continua por praça (varia entre SP e PE1); a
--      produção, não. Isso reverte a Entrega anterior: `preco_regional`
--      ganhou `custo_producao_tv`/`custo_producao_digital` por praça, e os
--      dois ficariam campos mortos na tela — saem daqui. Em `programas`
--      entra um campo ÚNICO de produção regional (não TV/digital separados
--      — se a área pedir produção digital própria depois, o campo se
--      desdobra então; não antecipado aqui).
--
--   2. "4 ações bloqueiam o mês" no regional (docs/regras-acoes-regionais.md)
--      é um número diferente do `bloqueio_mensal` nacional, que já vem
--      preenchido pela usuária (12 no Encontro, 2 no É de Casa). As duas
--      grandezas não cabem numa coluna só — `bloqueio_mensal_regional` nasce
--      separada. A REGRA em si (4 ações fecham o mês) não é implementada
--      por este arquivo — só entra a coluna, o campo no cadastro e a
--      validação; a regra depende do calendário regional (Entrega 3).
--
-- Rode no SQL Editor do Supabase DEPOIS de schema.sql, schema-entrega-2.sql,
-- schema-entrega-2-correcoes.sql e schema-entrega-2-custos.sql. Pode rodar
-- quantas vezes quiser: o `add column` usa `if not exists`, o `drop column`
-- usa `if exists`.
--
-- Este arquivo é o ÚLTIMO da sequência. Os quatro anteriores já foram
-- aplicados no banco de produção e por isso não são editados — corrigi-los
-- no lugar faria a versão do repositório divergir do que a usuária realmente
-- rodou.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql   <- este
--
-- Depois deste arquivo, rode de novo `supabase/seed-regional.sql` — ele foi
-- atualizado para gravar `custo_producao_regional` e `bloqueio_mensal_regional`
-- em `programas`, colunas que só existem depois desta migração.
--
-- ---------------------------------------------------------------------------
-- O QUE ACONTECE COM CADA DADO QUE JÁ EXISTE NO BANCO
-- ---------------------------------------------------------------------------
-- Em `programas`:
--   custo_producao_regional  → coluna NOVA, nasce nula em todo mundo. Este
--                               arquivo grava o Encontro (7.797,00) e o É de
--                               Casa (7.910,00) via `seed-regional.sql`, não
--                               aqui — este arquivo só mexe em schema.
--   bloqueio_mensal_regional → coluna NOVA, nasce nula em todo mundo. Mesma
--                               observação: os 4 de cada programa entram
--                               pelo seed, não por este arquivo.
--
-- Em `preco_regional`:
--   custo_producao_tv       → REMOVIDA. Nasceu nula em `schema-entrega-2-
--                              custos.sql` e SEGUIU nula: conferido no banco
--                              de produção antes de escrever este DROP (10
--                              linhas — as 5 praças de FATI e as 5 de CASA —,
--                              todas com `custo_producao_tv` e
--                              `custo_producao_digital` NULL). Nenhum dado é
--                              perdido por este `drop column`.
--   custo_producao_digital  → REMOVIDA. Mesma conferência acima: só NULL.
--                              Continua não existindo produção digital
--                              regional — se a área pedir, é campo novo,
--                              não a volta deste.
--
-- Se você preencheu qualquer um desses dois campos na tela entre a aplicação
-- de `schema-entrega-2-custos.sql` e agora, ESTE ARQUIVO APAGA O VALOR sem
-- avisar de novo — a conferência acima vale para o banco no momento em que
-- foi escrita, não no momento em que você rodar. Se isso te preocupa, rode
-- antes:
--
--   select p.mnemonico, pr.praca_codigo, pr.custo_producao_tv, pr.custo_producao_digital
--   from preco_regional pr
--   join programas p on p.id = pr.programa_id
--   where pr.custo_producao_tv is not null or pr.custo_producao_digital is not null;
--
-- Se essa consulta devolver alguma linha, PARE e decida com a área para onde
-- esse valor vai (ele não tem como virar `programas.custo_producao_regional`
-- sozinho — um número por praça não vira um número por programa sem alguém
-- decidir como agregar) antes de continuar.

-- ---------------------------------------------------------------------------
-- 1. `programas`
-- ---------------------------------------------------------------------------
alter table programas add column if not exists custo_producao_regional numeric(14, 2);

alter table programas add column if not exists bloqueio_mensal_regional integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programas_bloqueio_mensal_regional_check'
  ) then
    alter table programas
      add constraint programas_bloqueio_mensal_regional_check
      check (bloqueio_mensal_regional is null or bloqueio_mensal_regional >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. `preco_regional`
-- ---------------------------------------------------------------------------
alter table preco_regional drop column if exists custo_producao_tv;
alter table preco_regional drop column if exists custo_producao_digital;

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto não deve dar erro nenhum (confirma que as colunas
-- novas existem em `programas` e as duas de produção sumiram de
-- `preco_regional`):
--
--   select custo_producao_regional, bloqueio_mensal_regional from programas limit 1;
--   select custo_midia_tv, percentual_simulcast, custo_midia_digital from preco_regional limit 1;
--
-- E isto deve devolver "does not exist" (prova de que o `drop` realmente
-- tirou as colunas, e não só as deixou nulas):
--
--   select custo_producao_tv from preco_regional limit 1;
