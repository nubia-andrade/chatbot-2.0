-- CHATBOT 2.0 — Entrega 5: fluxo de aprovação de propostas.
-- Rode UMA VEZ no SQL Editor do Supabase após os schemas anteriores da Entrega 5.
-- Idempotente para estrutura, policies e funções.

-- 1. ESTADO DE APROVAÇÃO ----------------------------------------------------
alter table propostas add column if not exists aprovacao_status text not null default 'nao_requerida';
alter table propostas add column if not exists aprovacao_solicitada_em timestamptz;
alter table propostas add column if not exists aprovacao_decidida_em timestamptz;
alter table propostas add column if not exists aprovacao_por uuid references auth.users (id) on delete set null;
alter table propostas add column if not exists aprovacao_justificativa text;
alter table propostas add column if not exists aprovacao_email_solicitacao_status text not null default 'nao_enviado';
alter table propostas add column if not exists aprovacao_email_solicitacao_erro text;
alter table propostas add column if not exists aprovacao_email_solicitacao_em timestamptz;
alter table propostas add column if not exists aprovacao_email_devolutiva_status text not null default 'nao_enviado';
alter table propostas add column if not exists aprovacao_email_devolutiva_erro text;
alter table propostas add column if not exists aprovacao_email_devolutiva_em timestamptz;

alter table propostas drop constraint if exists propostas_aprovacao_status_check;
alter table propostas add constraint propostas_aprovacao_status_check
  check (aprovacao_status in ('nao_requerida', 'pendente', 'aprovada', 'rejeitada'));
alter table propostas drop constraint if exists propostas_aprovacao_email_solicitacao_check;
alter table propostas add constraint propostas_aprovacao_email_solicitacao_check
  check (aprovacao_email_solicitacao_status in ('nao_enviado', 'nao_configurado', 'enviando', 'enviado', 'falha'));
alter table propostas drop constraint if exists propostas_aprovacao_email_devolutiva_check;
alter table propostas add constraint propostas_aprovacao_email_devolutiva_check
  check (aprovacao_email_devolutiva_status in ('nao_enviado', 'nao_configurado', 'enviando', 'enviado', 'falha'));

create index if not exists propostas_aprovacao_idx on propostas (aprovacao_status, programa_id, criado_em desc);
update propostas set aprovacao_status = 'nao_requerida' where aprovacao_status is null;

-- 2. AUDITORIA --------------------------------------------------------------
create table if not exists proposta_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references propostas (id) on delete cascade,
  acao text not null check (acao in ('solicitada', 'aprovada', 'rejeitada')),
  usuario_id uuid references auth.users (id) on delete set null,
  justificativa text,
  criado_em timestamptz not null default now()
);
create index if not exists proposta_aprovacoes_proposta_idx on proposta_aprovacoes (proposta_id, criado_em desc);
alter table proposta_aprovacoes enable row level security;

drop policy if exists "aprovacao proposta leitura autorizada" on proposta_aprovacoes;
create policy "aprovacao proposta leitura autorizada" on proposta_aprovacoes
  for select to authenticated using (
    exists (
      select 1 from propostas p
      where p.id = proposta_id
        and (p.usuario_id = auth.uid() or e_proprietario() or (p.programa_id is not null and e_consultor_de(p.programa_id)))
    )
  );

drop policy if exists "aprovacao proposta solicitar propria" on proposta_aprovacoes;
create policy "aprovacao proposta solicitar propria" on proposta_aprovacoes
  for insert to authenticated with check (
    acao = 'solicitada'
    and usuario_id = auth.uid()
    and exists (
      select 1 from propostas p
      where p.id = proposta_id and p.usuario_id = auth.uid() and p.aprovacao_status = 'pendente'
    )
  );

-- 3. CONSULTOR PODE LER A CONSULTA DO PROGRAMA ------------------------------
-- Necessário para analisar datas/praças, sem ampliar escrita.
drop policy if exists "consulta propria" on consultas;
create policy "consulta propria" on consultas
  for select to authenticated using (
    usuario_id = auth.uid()
    or e_proprietario()
    or (programa_id is not null and e_consultor_de(programa_id))
  );

drop policy if exists "item de consulta propria" on consulta_itens;
create policy "item de consulta propria" on consulta_itens
  for select to authenticated using (
    exists (
      select 1 from consultas c
      where c.id = consulta_id
        and (c.usuario_id = auth.uid() or e_proprietario() or (c.programa_id is not null and e_consultor_de(c.programa_id)))
    )
  );

-- 4. APROVADORES ------------------------------------------------------------
create or replace function consultores_da_aprovacao(p_proposta_id uuid)
returns table (usuario_id uuid, email text, nome text)
language plpgsql security definer set search_path = public, auth
as $$
declare v_proposta propostas%rowtype;
begin
  select * into v_proposta from propostas where id = p_proposta_id;
  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if v_proposta.usuario_id <> auth.uid() and not e_proprietario() and not e_consultor_de(v_proposta.programa_id) then
    raise exception 'Você não pode consultar os aprovadores desta proposta.';
  end if;

  return query
  select au.id::uuid, au.email::text, coalesce(u.nome, au.email, '')::text
  from consultor_programa cp
  join perfil_usuario pu on pu.usuario_id = cp.usuario_id and pu.perfil = 'consultor_programa'
  join auth.users au on au.id = cp.usuario_id
  left join usuario u on u.usuario_id = au.id
  where cp.programa_id = v_proposta.programa_id and au.email is not null
  order by coalesce(u.nome, au.email, '');
end;
$$;
revoke all on function consultores_da_aprovacao(uuid) from public;
grant execute on function consultores_da_aprovacao(uuid) to authenticated;

-- 5. DECISÃO ATÔMICA --------------------------------------------------------
create or replace function decidir_aprovacao_proposta(
  p_proposta_id uuid,
  p_decisao text,
  p_justificativa text default null
)
returns text
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_proposta propostas%rowtype;
  v_novo_status text;
  v_justificativa text := nullif(trim(coalesce(p_justificativa, '')), '');
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if p_decisao not in ('aprovar', 'rejeitar') then raise exception 'Decisão inválida.'; end if;
  if p_decisao = 'rejeitar' and v_justificativa is null then raise exception 'Informe a justificativa da rejeição.'; end if;

  select * into v_proposta from propostas where id = p_proposta_id for update;
  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;
  if v_proposta.aprovacao_status <> 'pendente' then raise exception 'Esta proposta já não está pendente de aprovação.'; end if;
  if not e_proprietario() and not e_consultor_de(v_proposta.programa_id) then raise exception 'Você não pode aprovar propostas deste programa.'; end if;

  v_novo_status := case when p_decisao = 'aprovar' then 'aprovada' else 'rejeitada' end;

  update propostas
  set aprovacao_status = v_novo_status,
      aprovacao_decidida_em = now(),
      aprovacao_por = auth.uid(),
      aprovacao_justificativa = case when v_novo_status = 'rejeitada' then v_justificativa else null end,
      negociacao_status = case when v_novo_status = 'aprovada' then 'em_negociacao' else negociacao_status end,
      negociacao_atualizado_por = case when v_novo_status = 'aprovada' then auth.uid() else negociacao_atualizado_por end,
      negociacao_atualizado_em = case when v_novo_status = 'aprovada' then now() else negociacao_atualizado_em end
  where id = p_proposta_id;

  -- Uma nova versão só substitui a anterior DEPOIS de ser aprovada.
  if v_novo_status = 'aprovada' and v_proposta.proposta_anterior_id is not null then
    update propostas
    set negociacao_status = 'substituida',
        negociacao_atualizado_por = auth.uid(),
        negociacao_atualizado_em = now()
    where id = v_proposta.proposta_anterior_id;
  end if;

  insert into proposta_aprovacoes (proposta_id, acao, usuario_id, justificativa)
  values (p_proposta_id, v_novo_status, auth.uid(), v_justificativa);
  return v_novo_status;
end;
$$;
revoke all on function decidir_aprovacao_proposta(uuid, text, text) from public;
grant execute on function decidir_aprovacao_proposta(uuid, text, text) to authenticated;

-- 6. E-MAILS DO WORKFLOW ----------------------------------------------------
create or replace function registrar_email_workflow_aprovacao(
  p_proposta_id uuid,
  p_fase text,
  p_status text,
  p_erro text default null
)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_proposta propostas%rowtype; v_agora timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if p_fase not in ('solicitacao', 'devolutiva', 'proposta_final') then raise exception 'Fase de e-mail inválida.'; end if;
  if p_status not in ('nao_enviado', 'nao_configurado', 'enviando', 'enviado', 'falha') then raise exception 'Status de e-mail inválido.'; end if;
  select * into v_proposta from propostas where id = p_proposta_id;
  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;

  if p_fase = 'solicitacao' then
    if v_proposta.usuario_id <> auth.uid() and not e_proprietario() then raise exception 'Você não pode registrar a solicitação desta proposta.'; end if;
    update propostas
    set aprovacao_email_solicitacao_status = p_status,
        aprovacao_email_solicitacao_erro = nullif(trim(coalesce(p_erro, '')), ''),
        aprovacao_email_solicitacao_em = case when p_status = 'enviado' then v_agora else aprovacao_email_solicitacao_em end
    where id = p_proposta_id;
    return;
  end if;

  if not e_proprietario() and not e_consultor_de(v_proposta.programa_id) then raise exception 'Você não pode registrar a devolutiva desta proposta.'; end if;
  update propostas
  set aprovacao_email_devolutiva_status = p_status,
      aprovacao_email_devolutiva_erro = nullif(trim(coalesce(p_erro, '')), ''),
      aprovacao_email_devolutiva_em = case when p_status = 'enviado' then v_agora else aprovacao_email_devolutiva_em end,
      email_status = case
        when p_fase = 'proposta_final' and p_status = 'nao_configurado' then 'nao_configurado'
        when p_fase = 'proposta_final' and p_status = 'enviando' then 'enviando'
        when p_fase = 'proposta_final' and p_status = 'enviado' then 'enviado'
        when p_fase = 'proposta_final' and p_status = 'falha' then 'falha'
        else email_status end,
      email_erro = case when p_fase = 'proposta_final' then nullif(trim(coalesce(p_erro, '')), '') else email_erro end,
      email_enviado_em = case when p_fase = 'proposta_final' and p_status = 'enviado' then v_agora else email_enviado_em end,
      enviado_em = case when p_fase = 'proposta_final' and p_status = 'enviado' then v_agora else enviado_em end
  where id = p_proposta_id;
end;
$$;
revoke all on function registrar_email_workflow_aprovacao(uuid, text, text, text) from public;
grant execute on function registrar_email_workflow_aprovacao(uuid, text, text, text) to authenticated;

-- 7. NEGOCIAÇÃO SÓ APÓS APROVAÇÃO -----------------------------------------
create or replace function atualizar_negociacao_proposta(
  p_proposta_id uuid,
  p_status text,
  p_valor_final numeric default null,
  p_data_fechamento date default null,
  p_observacao text default null,
  p_motivo_perda text default null
)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_proposta propostas%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  select * into v_proposta from propostas where id = p_proposta_id;
  if v_proposta.id is null then raise exception 'Proposta não encontrada.'; end if;
  if v_proposta.usuario_id is distinct from auth.uid() and not e_proprietario() then raise exception 'Você não pode alterar a negociação desta proposta.'; end if;
  if v_proposta.aprovacao_status not in ('nao_requerida', 'aprovada') then raise exception 'A negociação só pode ser atualizada depois da aprovação da proposta.'; end if;
  if p_status not in ('em_negociacao', 'fechada', 'perdida', 'cancelada') then raise exception 'Status de negociação inválido.'; end if;
  if v_proposta.negociacao_status = 'substituida' then raise exception 'Uma versão substituída não pode ter a negociação alterada.'; end if;
  if p_status = 'fechada' then
    if p_valor_final is null or p_valor_final < 0 then raise exception 'Informe o valor final negociado.'; end if;
    if p_data_fechamento is null then raise exception 'Informe a data do fechamento.'; end if;
  end if;
  update propostas
  set negociacao_status = p_status,
      valor_final_negociado = case when p_status = 'fechada' then p_valor_final else null end,
      data_fechamento = case when p_status = 'fechada' then p_data_fechamento else null end,
      observacao_negociacao = nullif(trim(coalesce(p_observacao, '')), ''),
      motivo_perda = case when p_status = 'perdida' then nullif(trim(coalesce(p_motivo_perda, '')), '') else null end,
      negociacao_atualizado_por = auth.uid(), negociacao_atualizado_em = now()
  where id = p_proposta_id;
end;
$$;
revoke all on function atualizar_negociacao_proposta(uuid, text, numeric, date, text, text) from public;
grant execute on function atualizar_negociacao_proposta(uuid, text, numeric, date, text, text) to authenticated;

-- 8. VERSIONAMENTO COMPATÍVEL COM APROVAÇÃO -------------------------------
create or replace function vincular_nova_versao(
  p_proposta_anterior_id uuid,
  p_nova_proposta_id uuid
)
returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare v_anterior propostas%rowtype; v_nova propostas%rowtype; v_proxima integer;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  select * into v_anterior from propostas where id = p_proposta_anterior_id for update;
  select * into v_nova from propostas where id = p_nova_proposta_id for update;
  if v_anterior.id is null or v_nova.id is null then raise exception 'Proposta anterior ou nova proposta não encontrada.'; end if;
  if v_nova.usuario_id is distinct from auth.uid() and not e_proprietario() then raise exception 'Você não pode vincular esta nova versão.'; end if;
  if v_anterior.usuario_id is distinct from auth.uid() and not e_proprietario() then raise exception 'Você não pode criar versão desta proposta.'; end if;
  if v_anterior.cliente_id is distinct from v_nova.cliente_id or v_anterior.programa_id is distinct from v_nova.programa_id then raise exception 'Nova versão deve manter o mesmo anunciante e programa.'; end if;
  if v_nova.pdf_path is null or v_nova.status <> 'gerada' then raise exception 'A nova versão precisa ter PDF gerado antes de ser vinculada.'; end if;
  if exists (select 1 from propostas p where p.grupo_versao_id = v_anterior.grupo_versao_id and p.versao > v_anterior.versao and p.id <> p_nova_proposta_id) then raise exception 'Já existe uma versão mais recente desta proposta.'; end if;

  select coalesce(max(p.versao), 0) + 1 into v_proxima from propostas p where p.grupo_versao_id = v_anterior.grupo_versao_id;
  update propostas
  set grupo_versao_id = v_anterior.grupo_versao_id,
      versao = v_proxima,
      proposta_anterior_id = v_anterior.id,
      negociacao_status = 'em_negociacao',
      negociacao_atualizado_por = auth.uid(),
      negociacao_atualizado_em = now()
  where id = v_nova.id;

  -- Sem aprovação, mantém o comportamento antigo. Com aprovação pendente,
  -- a anterior continua válida até a decisão positiva da nova versão.
  if v_nova.aprovacao_status in ('nao_requerida', 'aprovada') then
    update propostas
    set negociacao_status = 'substituida', negociacao_atualizado_por = auth.uid(), negociacao_atualizado_em = now()
    where id = v_anterior.id;
  end if;
  return v_proxima;
end;
$$;
revoke all on function vincular_nova_versao(uuid, uuid) from public;
grant execute on function vincular_nova_versao(uuid, uuid) to authenticated;

-- 9. PDF PRIVADO ATÉ APROVAÇÃO --------------------------------------------
drop policy if exists "pdf proposta: leitura autorizada" on storage.objects;
create policy "pdf proposta: leitura autorizada" on storage.objects
  for select to authenticated using (
    bucket_id = 'propostas'
    and exists (
      select 1 from propostas p
      where (p.id::text || '.pdf') = split_part(name, '/', 2)
        and (
          (p.usuario_id = auth.uid() and p.aprovacao_status in ('nao_requerida', 'aprovada'))
          or e_proprietario()
          or (p.programa_id is not null and e_consultor_de(p.programa_id))
        )
    )
  );

-- 10. SEÇÃO APROVAÇÕES ------------------------------------------------------
alter table perfil_secao drop constraint if exists perfil_secao_secao_check;
alter table perfil_secao add constraint perfil_secao_secao_check
  check (secao in ('inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes'));

insert into perfil_secao (perfil, secao, permitido) values
  ('executivo', 'aprovacoes', false),
  ('executivo_regional', 'aprovacoes', false),
  ('consultor_programa', 'aprovacoes', true),
  ('proprietario', 'aprovacoes', true)
on conflict (perfil, secao) do nothing;

create or replace function salvar_secoes_do_perfil(p_perfil text, p_secoes text[])
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_secao text;
begin
  if not e_proprietario() then raise exception 'Apenas o proprietário pode alterar permissões de seções.'; end if;
  if p_perfil not in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario') then raise exception 'Perfil inválido.'; end if;
  if p_perfil = 'proprietario' then p_secoes := array['inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[]; end if;
  foreach v_secao in array coalesce(p_secoes, '{}'::text[]) loop
    if v_secao not in ('inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes') then raise exception 'Seção inválida: %', v_secao; end if;
  end loop;
  if not ('inicio' = any(coalesce(p_secoes, '{}'::text[]))) then p_secoes := array_append(coalesce(p_secoes, '{}'::text[]), 'inicio'); end if;
  insert into perfil_secao (perfil, secao, permitido, atualizado_por, atualizado_em)
  select p_perfil, s.secao, s.secao = any(p_secoes), auth.uid(), now()
  from unnest(array['inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[]) as s(secao)
  on conflict (perfil, secao) do update set permitido = excluded.permitido, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
end;
$$;
revoke all on function salvar_secoes_do_perfil(text, text[]) from public;
grant execute on function salvar_secoes_do_perfil(text, text[]) to authenticated;

-- Conferência final
select perfil, secao, permitido from perfil_secao where secao = 'aprovacoes' order by perfil;
