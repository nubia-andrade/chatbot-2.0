-- CHATBOT 2.0 — configuração regional do Encontro e do É de Casa.
-- Rode no SQL Editor do Supabase depois de schema.sql, schema-entrega-2.sql,
-- schema-entrega-2-custos.sql (grava em preco_regional.custo_midia_tv) e
-- schema-entrega-2-producao-regional.sql (grava em
-- programas.custo_producao_regional e programas.bloqueio_mensal_regional).
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
-- Todos os valores monetários abaixo (preço de mídia TV por praça e custo de
-- produção regional) estão marcados no documento da área como "checar com
-- Pricing". Trate-os como provisórios até a confirmação: eles alimentam o
-- total da ação que o consultor vê na aba Regional
-- (`src/lib/dominio/custo-da-acao-regional.ts`) e, a partir da Entrega 4, a
-- proposta. A interface já exibe o aviso "Valores pendentes de confirmação
-- com Pricing" — se os números forem confirmados ou corrigidos, atualize
-- ESTE arquivo junto com docs/regras-acoes-regionais.md, para os dois não
-- divergirem.
--
-- O QUE ESTE ARQUIVO GRAVA DE PRODUÇÃO E BLOQUEIO MENSAL
-- Duas versões atrás, este seed não gravava produção regional nem bloqueio
-- mensal regional: a primeira porque `direitos_e_conexos` e
-- `custo_producao_regional` (por programa) tinham acabado de virar
-- `preco_regional.custo_producao_tv` (por praça, ver
-- `schema-entrega-2-custos.sql`) e um valor por-programa não dizia quanto
-- caberia a SP versus a PE1 — redistribuir seria decisão de Pricing, não
-- deste arquivo; a segunda porque não havia coluna para o bloqueio mensal
-- regional, só a nacional (já configurada pela usuária).
--
-- A área reverteu a primeira decisão: a produção regional é ÚNICA por
-- programa, não por praça — um cliente que compra 3 praças paga a produção
-- uma vez, não três. E resolveu a segunda: o regional tem seu próprio
-- bloqueio mensal, em `programas.bloqueio_mensal_regional`
-- (`schema-entrega-2-producao-regional.sql`). As duas razões que faziam
-- este arquivo ficar calado nesses dois campos deixaram de existir, por
-- isso os dois passam a ser gravados abaixo: R$ 7.797,00 de produção no
-- Encontro, R$ 7.910,00 no É de Casa, e bloqueio mensal regional 4 nos
-- dois — os três números do documento da área.

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
-- Direitos e conexos: calculado (15% da mídia de TV) — não gravado aqui.
-- Custo de produção regional: R$ 7.797,00, ÚNICO para a ação inteira —
--   não multiplica pelo número de praças compradas
--   (src/lib/dominio/custo-da-acao-regional.ts).
-- Bloqueio mensal regional: 4 ações — diferente do bloqueio_mensal nacional,
--   que continua com o valor que a usuária configurou (ver aviso no fim do
--   arquivo).
update programas set
  aceita_regional = true,
  dia_da_semana_regional = 5,
  prazo_minimo_regional_dias = 7,
  max_pracas_por_acao = 3,
  custo_producao_regional = 7797.00,
  bloqueio_mensal_regional = 4,
  atualizado_em = now()
where mnemonico = 'FATI';

insert into preco_regional (programa_id, praca_codigo, custo_midia_tv, atualizado_em)
select p.id, v.praca, v.custo_midia_tv, now()
from programas p
cross join (values
  ('SP',  49000.00),
  ('RJ',  25000.00),
  ('BH',   9000.00),
  ('DF',   6000.00),
  ('PE1',  7000.00)
) as v(praca, custo_midia_tv)
where p.mnemonico = 'FATI'
on conflict (programa_id, praca_codigo)
do update set custo_midia_tv = excluded.custo_midia_tv, atualizado_em = excluded.atualizado_em;

-- ---------------------------------------------------------------------------
-- 3. É de Casa (mnemônico CASA)
-- ---------------------------------------------------------------------------
-- Slots: 1 por semana, aos sábados  → dia_da_semana_regional = 6
-- Prazo mínimo: 10 dias
-- Até 3 praças por ação
-- Direitos e conexos: calculado (15% da mídia de TV) — não gravado aqui.
-- Custo de produção regional: R$ 7.910,00, ÚNICO para a ação inteira —
--   não multiplica pelo número de praças compradas
--   (src/lib/dominio/custo-da-acao-regional.ts).
-- Bloqueio mensal regional: 4 ações — diferente do bloqueio_mensal nacional,
--   que continua com o valor que a usuária configurou (ver aviso no fim do
--   arquivo).
update programas set
  aceita_regional = true,
  dia_da_semana_regional = 6,
  prazo_minimo_regional_dias = 10,
  max_pracas_por_acao = 3,
  custo_producao_regional = 7910.00,
  bloqueio_mensal_regional = 4,
  atualizado_em = now()
where mnemonico = 'CASA';

insert into preco_regional (programa_id, praca_codigo, custo_midia_tv, atualizado_em)
select p.id, v.praca, v.custo_midia_tv, now()
from programas p
cross join (values
  ('SP',  53000.00),
  ('RJ',  31000.00),
  ('BH',  13000.00),
  ('DF',  10000.00),
  ('PE1', 11000.00)
) as v(praca, custo_midia_tv)
where p.mnemonico = 'CASA'
on conflict (programa_id, praca_codigo)
do update set custo_midia_tv = excluded.custo_midia_tv, atualizado_em = excluded.atualizado_em;

-- ---------------------------------------------------------------------------
-- O que este arquivo DELIBERADAMENTE não mexe
-- ---------------------------------------------------------------------------
-- `bloqueio_mensal` (SEM o sufixo `_regional`) — a coluna do bloqueio mensal
-- NACIONAL, hoje 12 no Encontro e 2 no É de Casa, configurada pela usuária
-- pelo cadastro. O "4 ações bloqueiam o mês" do documento da área é o
-- bloqueio mensal REGIONAL, gravado acima em `bloqueio_mensal_regional` —
-- coluna própria (`schema-entrega-2-producao-regional.sql`) que existe
-- exatamente para as duas grandezas não brigarem por uma coluna só.
-- Sobrescrever `bloqueio_mensal` aqui mudaria a disponibilidade NACIONAL dos
-- dois programas, que ninguém pediu para mexer.
--
-- A REGRA "4 ações fecham o mês" em si não é aplicada por este arquivo nem
-- por nenhum outro ainda — ela depende do calendário regional (Entrega 3).
-- Este seed só grava o número; quem decide o que fazer com ele é o
-- calendário, quando existir.

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto deve devolver 2 linhas (Encontro e É de Casa), cada
-- uma com 5 praças precificadas:
--
--   select p.nome, p.mnemonico, p.dia_da_semana_regional,
--          p.prazo_minimo_regional_dias, count(pr.praca_codigo) as pracas,
--          sum(pr.custo_midia_tv) as soma_das_pracas
--   from programas p
--   left join preco_regional pr on pr.programa_id = p.id
--   where p.aceita_regional
--   group by p.id
--   order by p.nome;
--
-- Somas esperadas: Encontro R$ 96.000,00 e É de Casa R$ 118.000,00.
--
-- E isto deve devolver os dois programas com produção regional (única por
-- programa) e bloqueio mensal regional preenchidos:
--
--   select nome, mnemonico, custo_producao_regional, bloqueio_mensal_regional
--   from programas where mnemonico in ('FATI', 'CASA');
--
-- Esperado: FATI com 7.797,00 e 4; CASA com 7.910,00 e 4.
