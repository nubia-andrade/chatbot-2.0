-- CHATBOT 2.0 — Permissões de seções por perfil + reforço de RLS de propostas.
--
-- Rode no SQL Editor do Supabase depois dos schemas da Entrega 4.
-- Idempotente: os valores padrão só são inseridos quando ainda não existem;
-- alterações feitas depois pela tela de Perfis e acessos são preservadas.

-- ---------------------------------------------------------------------------
-- 1. MATRIZ DE SEÇÕES POR PERFIL
-- ---------------------------------------------------------------------------
create table if not exists perfil_secao (
  perfil text not null,
  secao text not null,
  permitido boolean not null default true,
  atualizado_por uuid references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (perfil, secao),
  constraint perfil_secao_perfil_check
    check (perfil in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario')),
  constraint perfil_secao_secao_check
    check (secao in ('inicio', 'consulta', 'propostas', 'historico', 'configuracoes'))
);

alter table perfil_secao enable row level security;

drop policy if exists "perfil secao leitura autenticada" on perfil_secao;
create policy "perfil secao leitura autenticada" on perfil_secao
  for select to authenticated using (true);

drop policy if exists "perfil secao escrita proprietario" on perfil_secao;
create policy "perfil secao escrita proprietario" on perfil_secao
  for all to authenticated
  using (e_proprietario())
  with check (e_proprietario());

-- Padrões iniciais. ON CONFLICT DO NOTHING é proposital: rerodar este arquivo
-- nunca desfaz uma decisão feita posteriormente pela Proprietária na interface.
insert into perfil_secao (perfil, secao, permitido) values
  ('executivo', 'inicio', true),
  ('executivo', 'consulta', true),
  ('executivo', 'propostas', true),
  ('executivo', 'historico', false),
  ('executivo', 'configuracoes', false),

  ('executivo_regional', 'inicio', true),
  ('executivo_regional', 'consulta', true),
  ('executivo_regional', 'propostas', true),
  ('executivo_regional', 'historico', false),
  ('executivo_regional', 'configuracoes', false),

  ('consultor_programa', 'inicio', true),
  ('consultor_programa', 'consulta', false),
  ('consultor_programa', 'propostas', true),
  ('consultor_programa', 'historico', true),
  ('consultor_programa', 'configuracoes', true),

  ('proprietario', 'inicio', true),
  ('proprietario', 'consulta', true),
  ('proprietario', 'propostas', true),
  ('proprietario', 'historico', true),
  ('proprietario', 'configuracoes', true)
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

  -- Segurança estrutural: Proprietário nunca pode perder acesso ao sistema.
  if p_perfil = 'proprietario' then
    p_secoes := array['inicio', 'consulta', 'propostas', 'historico', 'configuracoes']::text[];
  end if;

  foreach v_secao in array coalesce(p_secoes, '{}'::text[]) loop
    if v_secao not in ('inicio', 'consulta', 'propostas', 'historico', 'configuracoes') then
      raise exception 'Seção inválida: %', v_secao;
    end if;
  end loop;

  -- Início permanece obrigatório para evitar perfis sem rota segura de entrada.
  if not ('inicio' = any(coalesce(p_secoes, '{}'::text[]))) then
    p_secoes := array_append(coalesce(p_secoes, '{}'::text[]), 'inicio');
  end if;

  insert into perfil_secao (perfil, secao, permitido, atualizado_por, atualizado_em)
  select
    p_perfil,
    s.secao,
    s.secao = any(p_secoes),
    auth.uid(),
    now()
  from unnest(array['inicio', 'consulta', 'propostas', 'historico', 'configuracoes']::text[]) as s(secao)
  on conflict (perfil, secao) do update
    set permitido = excluded.permitido,
        atualizado_por = excluded.atualizado_por,
        atualizado_em = excluded.atualizado_em;
end;
$$;

revoke all on function salvar_secoes_do_perfil(text, text[]) from public;
grant execute on function salvar_secoes_do_perfil(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. REFORÇO DA VISIBILIDADE DE PROPOSTAS
--
-- Executivo puro: somente propostas que ele próprio gerou.
-- Consultor: próprias propostas + propostas dos programas a que está vinculado.
-- Proprietário: todas.
-- Usuários com múltiplos perfis acumulam as permissões dos papéis atribuídos.
-- ---------------------------------------------------------------------------
drop policy if exists "proposta visivel" on propostas;
create policy "proposta visivel" on propostas
  for select to authenticated using (
    usuario_id = auth.uid()
    or e_proprietario()
    or (
      tem_perfil('consultor_programa')
      and programa_id is not null
      and exists (
        select 1
        from consultor_programa cp
        where cp.usuario_id = auth.uid()
          and cp.programa_id = propostas.programa_id
      )
    )
  );

-- O PDF segue exatamente a mesma regra da proposta.
drop policy if exists "pdf proposta: leitura autorizada" on storage.objects;
create policy "pdf proposta: leitura autorizada" on storage.objects
  for select to authenticated using (
    bucket_id = 'propostas'
    and exists (
      select 1
      from propostas p
      where (p.id::text || '.pdf') = split_part(name, '/', 2)
        and (
          p.usuario_id = auth.uid()
          or e_proprietario()
          or (
            tem_perfil('consultor_programa')
            and p.programa_id is not null
            and exists (
              select 1
              from consultor_programa cp
              where cp.usuario_id = auth.uid()
                and cp.programa_id = p.programa_id
            )
          )
        )
    )
  );
