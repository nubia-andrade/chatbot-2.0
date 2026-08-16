-- CHATBOT 2.0 — Datas especiais: períodos com PREÇO diferenciado por
-- programa (Black Friday, Natal…), diferentes de datas bloqueadas
-- (`datas_bloqueadas`, que impedem a venda). As duas tabelas coexistem: uma
-- data pode estar dentro de um período especial e, ao mesmo tempo,
-- bloqueada — nenhuma mexe na outra.
--
-- `texto_investimento` é guardado agora mas só é CONSUMIDO na Entrega 4,
-- quando a página de valor da proposta for gerada (ver
-- `docs/proposta-e-modelo.md`). Nada nesta migração ou no restante desta
-- entrega lê esse campo para colocar em proposta nenhuma.
--
-- Rode no SQL Editor do Supabase DEPOIS de todos os arquivos abaixo, na
-- ordem. Idempotente: `create table if not exists`, `add column if not
-- exists`, os `create policy` e `create or replace function` já eram assim
-- nos arquivos anteriores e seguem o mesmo padrão aqui.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql
--   6. supabase/schema-datas-especiais.sql                <- este
--
-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists datas_especiais (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  percentual_acrescimo numeric(6, 2) not null,
  -- Guardado agora, consumido só na Entrega 4 (slide de investimento da
  -- proposta) — pode ficar nulo até o consultor escrever o texto.
  texto_investimento text,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  constraint datas_especiais_datas_check check (data_fim >= data_inicio),
  constraint datas_especiais_percentual_check check (percentual_acrescimo >= 0)
);

create index if not exists datas_especiais_programa_idx
  on datas_especiais (programa_id, data_inicio);

-- A sobreposição entre períodos do MESMO programa (a regra "períodos não
-- podem se sobrepor") é responsabilidade de `validarPeriodoEspecial`
-- (`src/lib/dominio/datas-especiais.ts`), checada na escrita — não dá para
-- expressar "nenhum intervalo se sobrepõe a outro" num `check` de linha
-- única do Postgres sem a extensão `btree_gist`, que este projeto não usa
-- em nenhuma outra tabela. Mesma escolha já feita para as regras de negócio
-- desta entrega: banco garante forma (datas válidas, percentual
-- não-negativo), domínio garante a regra de conflito.

-- ---------------------------------------------------------------------------
-- 2. RLS — mesmo padrão de `datas_bloqueadas`, `restricoes_anunciante`,
--    `preco_regional` e `acoes_regionais`: leitura para quem está
--    autenticado, escrita restrita a `e_consultor_de(programa_id)` (que já
--    inclui `e_proprietario()`).
-- ---------------------------------------------------------------------------
alter table datas_especiais enable row level security;

drop policy if exists "leitura autenticada" on datas_especiais;
create policy "leitura autenticada" on datas_especiais
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on datas_especiais;
create policy "escrita consultor" on datas_especiais
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
-- Depois de rodar, isto não deve dar erro nenhum:
--
--   select id, programa_id, nome, data_inicio, data_fim, percentual_acrescimo,
--          texto_investimento, criado_por, criado_em
--   from datas_especiais limit 1;
--
-- E isto deve recusar (prova de que os `check` estão de pé):
--
--   insert into datas_especiais (programa_id, nome, data_inicio, data_fim, percentual_acrescimo)
--   values ((select id from programas limit 1), 'Teste', '2026-12-31', '2026-01-01', 10);
--   -- erro esperado: violates check constraint "datas_especiais_datas_check"
--
--   insert into datas_especiais (programa_id, nome, data_inicio, data_fim, percentual_acrescimo)
--   values ((select id from programas limit 1), 'Teste', '2026-01-01', '2026-01-31', -5);
--   -- erro esperado: violates check constraint "datas_especiais_percentual_check"
