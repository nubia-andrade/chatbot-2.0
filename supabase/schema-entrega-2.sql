-- CHATBOT 2.0 — Entrega 2. Rode uma vez no SQL Editor, depois do schema.sql.
-- Pode rodar de novo sem duplicar nada.

-- ---------------------------------------------------------------------------
-- Perfis passam a ser acumuláveis: uma linha por par usuário/perfil.
-- Nome e cargo saem para `usuario`, para não se repetirem a cada perfil.
-- ---------------------------------------------------------------------------
create table if not exists usuario (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cargo text,
  criado_em timestamptz not null default now()
);

insert into usuario (usuario_id, nome, cargo)
select usuario_id, nome, cargo from perfil_usuario
on conflict (usuario_id) do nothing;

alter table perfil_usuario drop constraint if exists perfil_usuario_pkey;
alter table perfil_usuario drop column if exists nome;
alter table perfil_usuario drop column if exists cargo;
alter table perfil_usuario
  drop constraint if exists perfil_usuario_perfil_check;

-- Perfis antigos viram os novos equivalentes. Precisa rodar depois de
-- remover o check antigo (que rejeitaria os valores novos) e antes de
-- adicionar o check novo (que rejeitaria os valores antigos ainda presentes).
update perfil_usuario set perfil = 'consultor_programa' where perfil = 'admin_programa';
update perfil_usuario set perfil = 'proprietario' where perfil = 'admin_geral';

alter table perfil_usuario add constraint perfil_usuario_perfil_check
  check (perfil in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario'));

alter table perfil_usuario
  add constraint perfil_usuario_pkey primary key (usuario_id, perfil);

-- ---------------------------------------------------------------------------
-- Consultor responde por programas específicos, não por todos.
-- ---------------------------------------------------------------------------
create table if not exists consultor_programa (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  programa_id uuid not null references programas (id) on delete cascade,
  primary key (usuario_id, programa_id)
);

-- ---------------------------------------------------------------------------
-- Regional
-- ---------------------------------------------------------------------------
alter table programas add column if not exists aceita_regional boolean not null default false;
alter table programas add column if not exists dia_da_semana_regional smallint;
alter table programas add column if not exists prazo_minimo_regional_dias integer;
alter table programas add column if not exists max_pracas_por_acao integer not null default 3;
alter table programas add column if not exists direitos_e_conexos numeric(14, 2);
alter table programas add column if not exists custo_producao_regional numeric(14, 2);
alter table programas add column if not exists atualizado_em timestamptz not null default now();

alter table programas drop constraint if exists programas_dia_regional_check;
alter table programas add constraint programas_dia_regional_check
  check (dia_da_semana_regional is null or (dia_da_semana_regional between 0 and 6));

create table if not exists pracas (
  codigo text primary key,
  nome text not null,
  ordem smallint not null
);

insert into pracas (codigo, nome, ordem) values
  ('SP', 'São Paulo', 1),
  ('RJ', 'Rio de Janeiro', 2),
  ('BH', 'Belo Horizonte', 3),
  ('DF', 'Brasília', 4),
  ('PE1', 'Recife', 5)
on conflict (codigo) do update set nome = excluded.nome, ordem = excluded.ordem;

create table if not exists preco_regional (
  programa_id uuid not null references programas (id) on delete cascade,
  praca_codigo text not null references pracas (codigo),
  valor numeric(14, 2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (programa_id, praca_codigo)
);

-- Uma linha por praça vendida: "SP está livre nesta sexta?" vira consulta direta.
create table if not exists acoes_regionais (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  data_de_exibicao date not null,
  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  praca_codigo text not null references pracas (codigo),
  origem text not null default 'manual' check (origem in ('manual', 'sugerido_api')),
  numero_da_entrega text,
  criado_em timestamptz not null default now(),
  unique (programa_id, data_de_exibicao, praca_codigo)
);

create index if not exists acoes_regionais_data_idx
  on acoes_regionais (programa_id, data_de_exibicao);

-- ---------------------------------------------------------------------------
-- Bloqueios e restrições
-- ---------------------------------------------------------------------------
create table if not exists datas_bloqueadas (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  data date not null,
  motivo text not null,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  unique (programa_id, data)
);

create table if not exists restricoes_anunciante (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  anunciante text,
  setor text,
  industria text,
  motivo text not null,
  criado_em timestamptz not null default now(),
  check (anunciante is not null or setor is not null or industria is not null)
);

create index if not exists restricoes_programa_idx on restricoes_anunciante (programa_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table usuario enable row level security;
alter table consultor_programa enable row level security;
alter table pracas enable row level security;
alter table preco_regional enable row level security;
alter table acoes_regionais enable row level security;
alter table datas_bloqueadas enable row level security;
alter table restricoes_anunciante enable row level security;

create or replace function tem_perfil(nome_do_perfil text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from perfil_usuario
    where usuario_id = auth.uid() and perfil = nome_do_perfil
  );
$$;

create or replace function e_proprietario()
returns boolean language sql security definer set search_path = public as $$
  select tem_perfil('proprietario');
$$;

-- Consultor só escreve no programa ao qual está vinculado. Proprietário, em todos.
create or replace function e_consultor_de(id_do_programa uuid)
returns boolean language sql security definer set search_path = public as $$
  select e_proprietario() or exists (
    select 1 from consultor_programa
    where usuario_id = auth.uid() and programa_id = id_do_programa
  );
$$;

-- `e_administrador` continua existindo para não quebrar a Entrega 1.
create or replace function e_administrador()
returns boolean language sql security definer set search_path = public as $$
  select tem_perfil('proprietario') or tem_perfil('consultor_programa');
$$;

drop policy if exists "usuario proprio" on usuario;
create policy "usuario proprio" on usuario
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "vinculo proprio" on consultor_programa;
create policy "vinculo proprio" on consultor_programa
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "vinculo escrita proprietario" on consultor_programa;
create policy "vinculo escrita proprietario" on consultor_programa
  for all to authenticated using (e_proprietario()) with check (e_proprietario());

drop policy if exists "leitura autenticada" on pracas;
create policy "leitura autenticada" on pracas
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programas;
create policy "escrita administrador" on programas
  for update to authenticated using (e_consultor_de(id)) with check (e_consultor_de(id));

drop policy if exists "insercao administrador" on programas;
create policy "insercao administrador" on programas
  for insert to authenticated with check (e_administrador());

drop policy if exists "remocao proprietario" on programas;
create policy "remocao proprietario" on programas
  for delete to authenticated using (e_proprietario());

-- ---------------------------------------------------------------------------
-- Policies das quatro tabelas dependentes de programa
-- ---------------------------------------------------------------------------
drop policy if exists "leitura autenticada" on preco_regional;
create policy "leitura autenticada" on preco_regional
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on preco_regional;
create policy "escrita consultor" on preco_regional
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));

drop policy if exists "leitura autenticada" on acoes_regionais;
create policy "leitura autenticada" on acoes_regionais
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on acoes_regionais;
create policy "escrita consultor" on acoes_regionais
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));

drop policy if exists "leitura autenticada" on datas_bloqueadas;
create policy "leitura autenticada" on datas_bloqueadas
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on datas_bloqueadas;
create policy "escrita consultor" on datas_bloqueadas
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));

drop policy if exists "leitura autenticada" on restricoes_anunciante;
create policy "leitura autenticada" on restricoes_anunciante
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on restricoes_anunciante;
create policy "escrita consultor" on restricoes_anunciante
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));
