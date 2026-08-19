-- CHATBOT 2.0 — Entrega 5: acompanhamento comercial, versionamento e performance.
-- Rode no SQL Editor depois dos schemas da Entrega 4.
-- Idempotente para colunas, índices, constraints, policies e funções.

-- ---------------------------------------------------------------------------
-- 1. ACOMPANHAMENTO DA NEGOCIAÇÃO
-- ---------------------------------------------------------------------------
alter table propostas
  add column if not exists negociacao_status text not null default 'em_negociacao',
  add column if not exists valor_final_negociado numeric(14, 2),
  add column if not exists data_fechamento date,
  add column if not exists observacao_negociacao text,
  add column if not exists motivo_perda text,
  add column if not exists negociacao_atualizado_por uuid references auth.users (id) on delete set null,
  add column if not exists negociacao_atualizado_em timestamptz;

alter table propostas drop constraint if exists propostas_negociacao_status_check;
alter table propostas add constraint propostas_negociacao_status_check
  check (negociacao_status in ('em_negociacao', 'fechada', 'perdida', 'cancelada', 'substituida'));

alter table propostas drop constraint if exists propostas_valor_final_negociado_check;
alter table propostas add constraint propostas_valor_final_negociado_check
  check (valor_final_negociado is null or valor_final_negociado >= 0);

create index if not exists propostas_negociacao_idx
  on propostas (negociacao_status, criado_em desc);

-- ---------------------------------------------------------------------------
-- 2. VERSIONAMENTO
-- Cada proposta emitida é imutável. Alterações geram uma nova proposta ligada
-- à mesma família por grupo_versao_id. A primeira é v1. Depois que uma nova
-- versão é emitida com sucesso, a anterior fica como "substituída": continua
-- auditável, mas sai dos KPIs de negociações ativas.
-- ---------------------------------------------------------------------------
alter table propostas
  add column if not exists grupo_versao_id uuid,
  add column if not exists versao integer not null default 1,
  add column if not exists proposta_anterior_id uuid references propostas (id) on delete set null;

update propostas
set grupo_versao_id = coalesce(grupo_versao_id, id)
where grupo_versao_id is null;

alter table propostas alter column grupo_versao_id set default gen_random_uuid();
alter table propostas alter column grupo_versao_id set not null;

alter table propostas drop constraint if exists propostas_versao_check;
alter table propostas add constraint propostas_versao_check check (versao >= 1);

create unique index if not exists propostas_grupo_versao_unico_idx
  on propostas (grupo_versao_id, versao);
create index if not exists propostas_anterior_idx on propostas (proposta_anterior_id);

-- ---------------------------------------------------------------------------
-- 3. PERMISSÃO DE ACOMPANHAMENTO
-- Executivo autor da proposta e Proprietário podem atualizar a negociação.
-- Consultor visualiza pelo RLS de SELECT, mas não altera status comercial.
-- ---------------------------------------------------------------------------
drop policy if exists "proposta propria atualizar" on propostas;
drop policy if exists "proposta acompanhamento atualizar" on propostas;
create policy "proposta acompanhamento atualizar" on propostas
  for update to authenticated
  using (usuario_id = auth.uid() or e_proprietario())
  with check (usuario_id = auth.uid() or e_proprietario());

-- RPC centraliza validações do status para que a UI não seja a única barreira.
-- "substituida" é um estado técnico do versionamento e não pode ser escolhido
-- manualmente pelo executivo.
create or replace function atualizar_negociacao_proposta(
  p_proposta_id uuid,
  p_status text,
  p_valor_final numeric default null,
  p_data_fechamento date default null,
  p_observacao text default null,
  p_motivo_perda text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_autor uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  select usuario_id into v_autor
  from propostas
  where id = p_proposta_id;

  if v_autor is null then
    raise exception 'Proposta não encontrada.';
  end if;

  if v_autor is distinct from auth.uid() and not e_proprietario() then
    raise exception 'Você não pode alterar a negociação desta proposta.';
  end if;

  if p_status not in ('em_negociacao', 'fechada', 'perdida', 'cancelada') then
    raise exception 'Status de negociação inválido.';
  end if;

  if exists (
    select 1 from propostas
    where id = p_proposta_id and negociacao_status = 'substituida'
  ) then
    raise exception 'Uma versão substituída não pode ter a negociação alterada.';
  end if;

  if p_status = 'fechada' then
    if p_valor_final is null or p_valor_final < 0 then
      raise exception 'Informe o valor final negociado.';
    end if;
    if p_data_fechamento is null then
      raise exception 'Informe a data do fechamento.';
    end if;
  end if;

  update propostas
  set negociacao_status = p_status,
      valor_final_negociado = case when p_status = 'fechada' then p_valor_final else null end,
      data_fechamento = case when p_status = 'fechada' then p_data_fechamento else null end,
      observacao_negociacao = nullif(trim(coalesce(p_observacao, '')), ''),
      motivo_perda = case when p_status = 'perdida' then nullif(trim(coalesce(p_motivo_perda, '')), '') else null end,
      negociacao_atualizado_por = auth.uid(),
      negociacao_atualizado_em = now()
  where id = p_proposta_id;
end;
$$;

revoke all on function atualizar_negociacao_proposta(uuid, text, numeric, date, text, text) from public;
grant execute on function atualizar_negociacao_proposta(uuid, text, numeric, date, text, text) to authenticated;

-- Retorna o próximo número de versão dentro da mesma família. A proposta
-- anterior precisa ser visível ao usuário pela policy de SELECT.
create or replace function proxima_versao_da_proposta(p_proposta_anterior_id uuid)
returns table (grupo_versao_id uuid, versao integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_grupo uuid;
begin
  select p.grupo_versao_id
    into v_grupo
  from propostas p
  where p.id = p_proposta_anterior_id;

  if v_grupo is null then
    return;
  end if;

  return query
  select v_grupo, coalesce(max(p.versao), 0) + 1
  from propostas p
  where p.grupo_versao_id = v_grupo;
end;
$$;

grant execute on function proxima_versao_da_proposta(uuid) to authenticated;

-- Vincula a proposta recém-gerada à família anterior SOMENTE depois de o PDF
-- existir. A atualização das duas propostas ocorre na mesma transação.
create or replace function vincular_nova_versao(
  p_proposta_anterior_id uuid,
  p_nova_proposta_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_anterior propostas%rowtype;
  v_nova propostas%rowtype;
  v_proxima integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  select * into v_anterior from propostas where id = p_proposta_anterior_id for update;
  select * into v_nova from propostas where id = p_nova_proposta_id for update;

  if v_anterior.id is null or v_nova.id is null then
    raise exception 'Proposta anterior ou nova proposta não encontrada.';
  end if;

  if v_nova.usuario_id is distinct from auth.uid() and not e_proprietario() then
    raise exception 'Você não pode vincular esta nova versão.';
  end if;

  if v_anterior.usuario_id is distinct from auth.uid() and not e_proprietario() then
    raise exception 'Você não pode criar versão desta proposta.';
  end if;

  if v_anterior.cliente_id is distinct from v_nova.cliente_id
     or v_anterior.programa_id is distinct from v_nova.programa_id then
    raise exception 'Nova versão deve manter o mesmo anunciante e programa.';
  end if;

  if v_nova.pdf_path is null or v_nova.status <> 'gerada' then
    raise exception 'A nova versão precisa ter PDF gerado antes de substituir a anterior.';
  end if;

  if exists (
    select 1 from propostas p
    where p.grupo_versao_id = v_anterior.grupo_versao_id
      and p.versao > v_anterior.versao
      and p.id <> p_nova_proposta_id
  ) then
    raise exception 'Já existe uma versão mais recente desta proposta.';
  end if;

  select coalesce(max(p.versao), 0) + 1
    into v_proxima
  from propostas p
  where p.grupo_versao_id = v_anterior.grupo_versao_id;

  update propostas
  set grupo_versao_id = v_anterior.grupo_versao_id,
      versao = v_proxima,
      proposta_anterior_id = v_anterior.id,
      negociacao_status = 'em_negociacao',
      negociacao_atualizado_por = auth.uid(),
      negociacao_atualizado_em = now()
  where id = v_nova.id;

  update propostas
  set negociacao_status = 'substituida',
      negociacao_atualizado_por = auth.uid(),
      negociacao_atualizado_em = now()
  where id = v_anterior.id;

  return v_proxima;
end;
$$;

revoke all on function vincular_nova_versao(uuid, uuid) from public;
grant execute on function vincular_nova_versao(uuid, uuid) to authenticated;
