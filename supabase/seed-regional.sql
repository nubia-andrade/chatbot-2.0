-- CHATBOT 2.0 — configuração regional do Encontro e do É de Casa.
-- Rode no SQL Editor do Supabase depois de schema.sql e schema-entrega-2.sql.
-- Pode rodar quantas vezes quiser: só `update` e `insert … on conflict do update`.
--
-- POR QUE ESTE ARQUIVO EXISTE
-- Esta configuração foi aplicada no banco de produção em 15/08/2026 por um
-- script temporário, depois apagado. O resultado é que os valores existiam
-- só no banco: outro ambiente nascia mudo (aba Regional vazia, matriz sem
-- preço, sugestão de praça sem programa para casar) e ninguém conseguia
-- auditar de onde os números vieram. Aqui eles ficam versionados, com a
-- fonte declarada.
--
-- FONTE: docs/regras-acoes-regionais.md, extraído do documento "Regras para
-- inclusão de programas — Projeto Ações Regionais", fornecido pela área em
-- 15/08/2026.
--
-- ⚠️ VALORES PROVISÓRIOS — "CHECAR COM PRICING"
-- Todos os valores monetários abaixo (preço por praça, direitos e conexos e
-- custo de produção) estão marcados no documento da área como "checar com
-- Pricing". Trate-os como provisórios até a confirmação: eles alimentam o
-- total da ação que o consultor vê na aba Regional e, a partir da Entrega 4,
-- a proposta. A interface já exibe o aviso "Valores pendentes de confirmação
-- com Pricing" — se os números forem confirmados ou corrigidos, atualize
-- ESTE arquivo junto com docs/regras-acoes-regionais.md, para os dois não
-- divergirem.

-- ---------------------------------------------------------------------------
-- 1. Correção de mnemônico: EDC → CASA
-- ---------------------------------------------------------------------------
-- O cadastro do É de Casa nasceu com o mnemônico `EDC`, mas a API do Globo
-- Take manda `"CASA - E DE CASA"`. Como o vínculo entre entrega e programa é
-- feito pelo mnemônico (`extrairMnemonico`, src/lib/dominio/programas.ts),
-- com `EDC` nenhuma entrega desse programa era reconhecida: a ocupação
-- nacional ficava zerada e a sugestão de ação regional nunca encontrava nada
-- — silenciosamente, sem erro em lugar nenhum.
--
-- Idempotente: depois da primeira execução não existe mais nenhuma linha com
-- `EDC`, e o update não afeta nada.
update programas set mnemonico = 'CASA' where mnemonico = 'EDC';

-- ---------------------------------------------------------------------------
-- 2. Encontro (mnemônico FATI)
-- ---------------------------------------------------------------------------
-- Slots: 1 por semana, às sextas-feiras  → dia_da_semana_regional = 5
-- Prazo mínimo: 7 dias
-- Até 3 praças por ação
-- Direitos e conexos: 15% — R$ 20.000,00
-- Custo de produção: R$ 7.797,00
update programas set
  aceita_regional = true,
  dia_da_semana_regional = 5,
  prazo_minimo_regional_dias = 7,
  max_pracas_por_acao = 3,
  direitos_e_conexos = 20000.00,
  custo_producao_regional = 7797.00,
  atualizado_em = now()
where mnemonico = 'FATI';

insert into preco_regional (programa_id, praca_codigo, valor, atualizado_em)
select p.id, v.praca, v.valor, now()
from programas p
cross join (values
  ('SP',  49000.00),
  ('RJ',  25000.00),
  ('BH',   9000.00),
  ('DF',   6000.00),
  ('PE1',  7000.00)
) as v(praca, valor)
where p.mnemonico = 'FATI'
on conflict (programa_id, praca_codigo)
do update set valor = excluded.valor, atualizado_em = excluded.atualizado_em;

-- ---------------------------------------------------------------------------
-- 3. É de Casa (mnemônico CASA)
-- ---------------------------------------------------------------------------
-- Slots: 1 por semana, aos sábados  → dia_da_semana_regional = 6
-- Prazo mínimo: 10 dias
-- Até 3 praças por ação
-- Direitos e conexos: R$ 23.000,00
-- Custo de produção: R$ 7.910,00
update programas set
  aceita_regional = true,
  dia_da_semana_regional = 6,
  prazo_minimo_regional_dias = 10,
  max_pracas_por_acao = 3,
  direitos_e_conexos = 23000.00,
  custo_producao_regional = 7910.00,
  atualizado_em = now()
where mnemonico = 'CASA';

insert into preco_regional (programa_id, praca_codigo, valor, atualizado_em)
select p.id, v.praca, v.valor, now()
from programas p
cross join (values
  ('SP',  53000.00),
  ('RJ',  31000.00),
  ('BH',  13000.00),
  ('DF',  10000.00),
  ('PE1', 11000.00)
) as v(praca, valor)
where p.mnemonico = 'CASA'
on conflict (programa_id, praca_codigo)
do update set valor = excluded.valor, atualizado_em = excluded.atualizado_em;

-- ---------------------------------------------------------------------------
-- O que este arquivo DELIBERADAMENTE não mexe
-- ---------------------------------------------------------------------------
-- `bloqueio_mensal`. O documento da área diz "4 ações bloqueiam o mês" para
-- os dois programas, e a R16 da spec manda reaproveitar essa mesma coluna. Só
-- que ela já vem preenchida pelo cadastro nacional — hoje 12 no Encontro e 2
-- no É de Casa — e sobrescrevê-la aqui mudaria a disponibilidade NACIONAL dos
-- dois programas, que ninguém pediu para mexer.
--
-- Uma coluna não consegue guardar dois números diferentes: enquanto a área
-- não disser se o bloqueio mensal do regional é o mesmo do nacional ou um
-- limite próprio, o certo é não escolher por ela. Se for próprio, a solução é
-- uma coluna `bloqueio_mensal_regional` — mudança de schema, não de seed.
--
-- Conferir com a área junto das outras pendências listadas no fim de
-- docs/regras-acoes-regionais.md.

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto deve devolver 2 linhas (Encontro e É de Casa), cada
-- uma com 5 praças precificadas:
--
--   select p.nome, p.mnemonico, p.dia_da_semana_regional,
--          p.prazo_minimo_regional_dias, p.direitos_e_conexos,
--          p.custo_producao_regional, count(pr.praca_codigo) as pracas,
--          sum(pr.valor) as soma_das_pracas
--   from programas p
--   left join preco_regional pr on pr.programa_id = p.id
--   where p.aceita_regional
--   group by p.id
--   order by p.nome;
--
-- Somas esperadas: Encontro R$ 96.000,00 e É de Casa R$ 118.000,00.
