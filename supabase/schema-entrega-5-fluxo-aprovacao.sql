-- CHATBOT 2.0 — Entrega 5: fluxo de aprovação de propostas.
-- Rode UMA VEZ no SQL Editor do Supabase após os schemas anteriores da Entrega 5.
-- Idempotente para estrutura e funções.

-- ---------------------------------------------------------------------------
-- 1. ESTADO DE APROVAÇÃO NA PROPOSTA
-- ---------------------------------------------------------------------------
alter table propostas add column if not exists aprovacao_status text not null default 'nao_requerida';
alter table propostas add column if not exists aprovacao_solicitada_em timestamptz;
alter table propostas add column if not exists aprovacao_decidida_em timestamptz;
alter table propostas add column if not exists aprovacao_por uuid references auth.users (id) on delete set null;
alter table propostas add column if not exists aprovacao_justificativa text;

do $$ begin
  alter table propostas add constraint propostas_aprovacao_status_check
    check (aprovacao_status in ('nao_requerida', 'pendente', 'aprovada', 'rejeitada'));
exception when duplicate_object then null;
end $$;

create index if not exists propostas_aprovacao_idx
  on propostas (aprovacao_status, programa_id, criado_em desc);

-- Propostas anteriores à funcionalidade não exigem aprovação retrospectiva.
update propostas set aprovacao_status = 'nao_requerida' where aprovacao_status is null;

-- ---------------------------------------------------------------------------
-- 2. AUDITORIA DAS DECISÕES
-- ---------------------------------------------------------------------------
create table if not exists proposta_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references propostas (id) on delete cascade,
  acao text not null check (acao in ('solicitada', 'aprovada', 'rejeitada')),
  usuario_id uuid references auth.users (id) on delete set null,
  justificativa text,
  criado_em timestamptz not null default now()
);

create index if not exists proposta_aprovacoes_proposta_idx
  on proposta_aprovacoes (proposta_id, criado_em desc);

alter table proposta_aprovacoes enable row level security;

drop policy if exists "aprovacao proposta leitura autorizada" on proposta_aprovacoes;
create policy "aprovacao proposta leitura autorizada" on proposta_aprovacoes
  for select to authenticated using (
    exists (
      select 1 from propostas p
      where p.id = proposta_id
        and (
          p.usuario_id = auth.uid()
          or e_proprietario()
          or (p.programa_id is not null and e_consultor_de(p.programa_id))
        )
    )
  );

-- Escrita acontece somente pelas funções SECURITY DEFINER abaixo.

-- ---------------------------------------------------------------------------
-- 3. QUEM RECEBE A SOLICITAÇÃO DE APROVAÇÃO
-- Somente consultores efetivamente vinculados ao programa e com esse perfil.
-- ---------------------------------------------------------------------------
create or replace function consultores_da_aprovacao(p_proposta_id uuid)
returns table (
  usuario_id uuid,
  email text,
  nome text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_proposta propostas%rowtype;
begin
  select * into v_proposta from propostas where id = p_proposta_id;
  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;

  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if v_proposta.usuario_id <> auth.uid()
     and not e_proprietario()
     and not e_consultor_de(v_proposta.programa_id) then
    raise exception 'Você não pode consultar os aprovadores desta proposta.';
  end if;

  return query
  select
    au.id::uuid,
    au.email::text,
    coalesce(u.nome, au.email, '')::text
  from consultor_programa cp
  join perfil_usuario pu
    on pu.usuario_id = cp.usuario_id
   and pu.perfil = 'consultor_programa'
  join auth.users au on au.id = cp.usuario_id
  left join usuario u on u.usuario_id = cp.usuario_id
  where cp.programa_id = v_proposta.programa_id
    and au.email is not null
  order by coalesce(u.nome, au.email, '');
end;
$$;

revoke all on function consultores_da_aprovacao(uuid) from public;
grant execute on function consultores_da_aprovacao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. DECISÃO ATÔMICA
-- A primeira decisão encerra a pendência. Rejeição exige justificativa.
-- ---------------------------------------------------------------------------
create or replace function decidir_aprovacao_proposta(
  p_proposta_id uuid,
  p_decisao text,
  p_justificativa text default null
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_proposta propostas%rowtype;
  v_novo_status text;
  v_justificativa text := nullif(trim(coalesce(p_justificativa, '')), '');
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if p_decisao not in ('aprovar', 'rejeitar') then raise exception 'Decisão inválida.'; end if;
  if p_decisao = 'rejeitar' and v_justificativa is null then
    raise exception 'Informe a justificativa da rejeição.';
  end if;

  select * into v_proposta
  from propostas
  where id = p_proposta_id
  for update;

  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;
  if v_proposta.aprovacao_status <> 'pendente' then
    raise exception 'Esta proposta já não está pendente de aprovação.';
  end if;
  if not e_proprietario() and not e_consultor_de(v_proposta.programa_id) then
    raise exception 'Você não pode aprovar propostas deste programa.';
  end if;

  v_novo_status := case when p_decisao = 'aprovar' then 'aprovada' else 'rejeitada' end;

  update propostas
  set aprovacao_status = v_novo_status,
      aprovacao_decidida_em = now(),
      aprovacao_por = auth.uid(),
      aprovacao_justificativa = case when v_novo_status = 'rejeitada' then v_justificativa else null end,
      -- Só uma proposta aprovada entra no acompanhamento comercial.
      negociacao_status = case when v_novo_status = 'aprovada' then 'em_negociacao' else negociacao_status end
  where id = p_proposta_id;

  insert into proposta_aprovacoes (proposta_id, acao, usuario_id, justificativa)
  values (p_proposta_id, v_novo_status, auth.uid(), v_justificativa);

  return v_novo_status;
end;
$$;

revoke all on function decidir_aprovacao_proposta(uuid, text, text) from public;
grant execute on function decidir_aprovacao_proposta(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. PDF PRIVADO ATÉ APROVAÇÃO
-- Autor só lê quando não requer aprovação ou quando foi aprovado.
-- Consultor vinculado/Proprietário lê para decidir.
-- ---------------------------------------------------------------------------
drop policy if exists "pdf proposta: leitura autorizada" on storage.objects;
create policy "pdf proposta: leitura autorizada" on storage.objects
  for select to authenticated using (
    bucket_id = 'propostas'
    and exists (
      select 1
      from propostas p
      where (p.id::text || '.pdf') = split_part(name, '/', 2)
        and (
          (
            p.usuario_id = auth.uid()
            and p.aprovacao_status in ('nao_requerida', 'aprovada')
          )
          or e_proprietario()
          or (
            p.programa_id is not null
            and e_consultor_de(p.programa_id)
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. NOVA SEÇÃO: APROVAÇÕES
-- ---------------------------------------------------------------------------
alter table perfil_secao drop constraint if exists perfil_secao_secao_check;
alter table perfil_secao add constraint perfil_secao_secao_check
  check (secao in ('inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes'));

insert into perfil_secao (perfil, secao, permitido) values
  ('executivo', 'aprovacoes', false),
  ('executivo_regional', 'aprovacoes', false),
  ('consultor_programa', 'aprovacoes', true),
  ('proprietario', 'aprovacoes', true)
on conflict (perfil, secao) do nothing;

create or replace function salvar_secoes_do_perfil(
  p_perfil text,
  p_secoes text[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_secao text;
begin
  if not e_proprietario() then
    raise exception 'Apenas o proprietário pode alterar permissões de seções.';
  end if;

  if p_perfil not in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario') then
    raise exception 'Perfil inválido.';
  end if;

  if p_perfil = 'proprietario' then
    p_secoes := array['inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[];
  end if;

  foreach v_secao in array coalesce(p_secoes, '{}'::text[]) loop
    if v_secao not in ('inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes') then
      raise exception 'Seção inválida: %', v_secao;
    end if;
  end loop;

  if not ('inicio' = any(coalesce(p_secoes, '{}'::text[]))) then
    p_secoes := array_append(coalesce(p_secoes, '{}'::text[]), 'inicio');
  end if;

  insert into perfil_secao (perfil, secao, permitido, atualizado_por, atualizado_em)
  select p_perfil, s.secao, s.secao = any(p_secoes), auth.uid(), now()
  from unnest(array['inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[]) as s(secao)
  on conflict (perfil, secao) do update
    set permitido = excluded.permitido,
        atualizado_por = excluded.atualizado_por,
        atualizado_em = excluded.atualizado_em;
end;
$$;

revoke all on function salvar_secoes_do_perfil(text, text[]) from public;
grant execute on function salvar_secoes_do_perfil(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. CONFERÊNCIA
-- ---------------------------------------------------------------------------
select perfil, secao, permitido
from perfil_secao
where secao = 'aprovacoes'
order by perfil;
