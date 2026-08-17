-- CHATBOT 2.0 — Entrega 3: consultas gravadas.
--
-- Rode no SQL Editor do Supabase DEPOIS de toda a sequência da Entrega 2.
-- Pode rodar quantas vezes quiser: tudo usa `if not exists` / `drop policy if
-- exists`.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql
--   6. supabase/schema-datas-especiais.sql
--   7. supabase/schema-datas-especiais-dias.sql
--   8. supabase/schema-clientes-regional.sql
--   9. supabase/schema-entrega-3.sql   <- este

-- ---------------------------------------------------------------------------
-- Uma consulta é o RETRATO do que foi validado num instante, não um ponteiro
-- para o estado atual. Preço muda, programa é renomeado, cliente é
-- reclassificado — a consulta de agosto precisa continuar dizendo em novembro
-- o que dizia em agosto. Por isso `cliente_nome` convive com `cliente_id`, do
-- mesmo jeito que `acoes_regionais` já faz.
-- ---------------------------------------------------------------------------
create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,

  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  cliente_setor text,
  cliente_industria text,

  programa_id uuid references programas (id),
  programa_nome text not null,

  modalidade text not null check (modalidade in ('nacional', 'regional')),
  valor_total numeric(14, 2) not null default 0,

  -- O que NÃO pôde ser verificado: hoje, ações cujo anunciante não casou com
  -- a carteira. jsonb porque a lista vai crescer e ninguém consulta por ela —
  -- só a lê junto da consulta.
  avisos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now()
);

create index if not exists consultas_usuario_idx on consultas (usuario_id, criado_em desc);

create table if not exists consulta_itens (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas (id) on delete cascade,
  data date not null,
  quantidade integer not null check (quantidade >= 1),
  -- Vazio no nacional; até `max_pracas_por_acao` códigos no regional.
  pracas text[] not null default '{}',
  valor_unitario numeric(14, 2),
  valor_total numeric(14, 2) not null default 0,
  periodo_especial_nome text,
  periodo_especial_percentual numeric(5, 2),
  unique (consulta_id, data)
);

create index if not exists consulta_itens_consulta_idx on consulta_itens (consulta_id);

-- ---------------------------------------------------------------------------
-- RLS — o executivo vê as PRÓPRIAS consultas; o proprietário vê todas.
-- Ninguém edita consulta gravada: um retrato que se altera não é retrato.
-- ---------------------------------------------------------------------------
alter table consultas enable row level security;
alter table consulta_itens enable row level security;

drop policy if exists "consulta propria" on consultas;
create policy "consulta propria" on consultas
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "grava consulta propria" on consultas;
create policy "grava consulta propria" on consultas
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "item de consulta propria" on consulta_itens;
create policy "item de consulta propria" on consulta_itens
  for select to authenticated using (
    exists (
      select 1 from consultas c
      where c.id = consulta_id and (c.usuario_id = auth.uid() or e_proprietario())
    )
  );

drop policy if exists "grava item de consulta propria" on consulta_itens;
create policy "grava item de consulta propria" on consulta_itens
  for insert to authenticated with check (
    exists (select 1 from consultas c where c.id = consulta_id and c.usuario_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- `gravar_consulta` — os dois inserts (`consultas` + `consulta_itens`) como
-- UMA transação.
--
-- O código do app (Task 8) gravava com dois `.insert()` do PostgREST em
-- sequência. Não são uma transação: se o segundo falhasse depois do primeiro
-- ter sido aceito, sobrava uma `consultas` órfã — sem item, com
-- `valor_total` de uma consulta que não existe mais, e sem jeito de apagar
-- (o schema não concede `delete`: uma consulta gravada é um retrato, e um
-- retrato que se apaga não é retrato). Uma função chamada via `rpc()` roda
-- inteira dentro de uma única transação de banco — os dois inserts vingam
-- juntos ou nenhum vinga, e a chamada HTTP some sem deixar rastro. A
-- ATOMICIDADE vem do corpo em plpgsql ser uma unidade só, não do modo de
-- segurança abaixo.
--
-- `security invoker` (explícito, embora seja o padrão do Postgres — melhor
-- escrito do que deixado implícito) roda a função com o privilégio de QUEM
-- CHAMA. As policies de insert já existentes ("grava consulta propria",
-- "grava item de consulta propria", acima) continuam valendo normalmente
-- para os dois inserts — é a opção de MENOR privilégio: a identidade
-- (`usuario_id = auth.uid()`) segue garantida onde ela deve morar, pela
-- policy, e a função não precisa contornar RLS nenhum para ser atômica.
-- A checagem `p_usuario_id = auth.uid()` dentro do corpo NÃO é o que impede
-- gravar em nome de outro usuário — a policy já impede isso sozinha, com ou
-- sem esta linha. Ela existe como defesa em profundidade: falha fechada,
-- devolve uma mensagem legível ANTES de bater na policy, em vez de deixar o
-- erro aparecer como uma violação de RLS crua (código `42501`) para quem
-- chamar a função errado.
--
-- `set search_path = public` continua pinado mesmo com `security invoker`:
-- um `search_path` que o próprio chamador controle (ex.: um schema anterior
-- na busca, com uma tabela `consultas` homônima) poderia trocar em silêncio
-- o que os nomes não qualificados dentro do corpo da função resolvem —
-- isso não depende do modo de segurança, é sobre resolução de nome dentro
-- da função em si.
--
-- Os `grant`/`revoke` de `execute` no fim do bloco continuam necessários:
-- chamar uma função via `rpc()` exige o privilégio `EXECUTE`
-- independentemente do modo de segurança — isso nunca teve relação com RLS,
-- é uma permissão à parte, e sem ela nenhuma sessão autenticada conseguiria
-- nem tentar.
-- ---------------------------------------------------------------------------
create or replace function gravar_consulta(
  p_usuario_id uuid,
  p_cliente_id uuid,
  p_cliente_nome text,
  p_cliente_setor text,
  p_cliente_industria text,
  p_programa_id uuid,
  p_programa_nome text,
  p_modalidade text,
  p_valor_total numeric,
  p_avisos jsonb,
  -- Um array jsonb de objetos, um por data:
  -- { "data": "2026-08-28", "quantidade": 1, "pracas": ["SP","RJ"],
  --   "valor_unitario": 63600, "valor_total": 63600,
  --   "periodo_especial_nome": null, "periodo_especial_percentual": null }
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_consulta_id uuid;
begin
  if p_usuario_id is distinct from auth.uid() then
    raise exception 'usuario_id não corresponde ao usuário autenticado';
  end if;

  -- A função é chamável direto por qualquer sessão autenticada via
  -- PostgREST, não só pelo app — sem esta guarda, `rpc('gravar_consulta',
  -- { …, p_itens: [] })` gravaria a linha pai com zero itens: a MESMA
  -- consulta órfã e impossível de limpar que esta função existe para
  -- evitar, só que por chamada direta em vez de falha parcial no meio dos
  -- dois inserts. `gravarConsulta` (`src/lib/acoes/consultas.ts`) nunca
  -- chama com `p_itens` vazio — `validarConsulta` já recusa consulta sem
  -- item antes disso —, mas a função não pode depender de quem a chama se
  -- comportar.
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'A consulta precisa de ao menos um item.';
  end if;

  insert into consultas (
    usuario_id, cliente_id, cliente_nome, cliente_setor, cliente_industria,
    programa_id, programa_nome, modalidade, valor_total, avisos
  )
  values (
    p_usuario_id, p_cliente_id, p_cliente_nome, p_cliente_setor, p_cliente_industria,
    p_programa_id, p_programa_nome, p_modalidade, p_valor_total, coalesce(p_avisos, '[]'::jsonb)
  )
  returning id into v_consulta_id;

  insert into consulta_itens (
    consulta_id, data, quantidade, pracas, valor_unitario, valor_total,
    periodo_especial_nome, periodo_especial_percentual
  )
  select
    v_consulta_id,
    (item ->> 'data')::date,
    (item ->> 'quantidade')::integer,
    coalesce(
      (select array_agg(praca) from jsonb_array_elements_text(item -> 'pracas') as praca),
      '{}'::text[]
    ),
    (item ->> 'valor_unitario')::numeric,
    coalesce((item ->> 'valor_total')::numeric, 0),
    item ->> 'periodo_especial_nome',
    (item ->> 'periodo_especial_percentual')::numeric
  from jsonb_array_elements(p_itens) as item;

  return v_consulta_id;
end;
$$;

revoke all on function gravar_consulta(
  uuid, uuid, text, text, text, uuid, text, text, numeric, jsonb, jsonb
) from public;
grant execute on function gravar_consulta(
  uuid, uuid, text, text, text, uuid, text, text, numeric, jsonb, jsonb
) to authenticated;
