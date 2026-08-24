-- Globo Slots — Inclui "Oportunidades" na matriz de seções por perfil.
--
-- Antes desta migration, /oportunidades ficava sempre visível para qualquer
-- perfil autenticado (não passava pela matriz de perfil_secao). Esta migration
-- só passa a existência da coluna para o banco; o padrão inserido abaixo é
-- "permitido = true" para os quatro perfis, ou seja, não muda o acesso de
-- ninguém até que a Proprietária desmarque algo na tela de Perfis e acessos.
--
-- Rode no SQL Editor do Supabase depois do schema-entrega-5-fluxo-aprovacao.sql.
-- Idempotente, como as demais migrations desta matriz.

alter table perfil_secao drop constraint if exists perfil_secao_secao_check;
alter table perfil_secao add constraint perfil_secao_secao_check
  check (secao in ('inicio', 'oportunidades', 'consulta', 'propostas', 'aprovacoes', 'configuracoes'));

insert into perfil_secao (perfil, secao, permitido) values
  ('executivo', 'oportunidades', true),
  ('executivo_regional', 'oportunidades', true),
  ('consultor_programa', 'oportunidades', true),
  ('proprietario', 'oportunidades', true)
on conflict (perfil, secao) do nothing;

create or replace function salvar_secoes_do_perfil(p_perfil text, p_secoes text[])
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

  if p_perfil not in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario') then raise exception 'Perfil inválido.'; end if;

  if p_perfil = 'proprietario' then
    p_secoes := array['inicio', 'oportunidades', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[];
  end if;

  foreach v_secao in array coalesce(p_secoes, '{}'::text[]) loop
    if v_secao not in ('inicio', 'oportunidades', 'consulta', 'propostas', 'aprovacoes', 'configuracoes') then raise exception 'Seção inválida: %', v_secao; end if;
  end loop;

  if not ('inicio' = any(coalesce(p_secoes, '{}'::text[]))) then
    p_secoes := array_append(coalesce(p_secoes, '{}'::text[]), 'inicio');
  end if;

  insert into perfil_secao (perfil, secao, permitido, atualizado_por, atualizado_em)
  select p_perfil, s.secao, s.secao = any(p_secoes), auth.uid(), now()
  from unnest(array['inicio', 'oportunidades', 'consulta', 'propostas', 'aprovacoes', 'configuracoes']::text[]) as s(secao)
  on conflict (perfil, secao) do update
    set permitido = excluded.permitido,
        atualizado_por = excluded.atualizado_por,
        atualizado_em = excluded.atualizado_em;
end;
$$;

revoke all on function salvar_secoes_do_perfil(text, text[]) from public;
grant execute on function salvar_secoes_do_perfil(text, text[]) to authenticated;

-- Conferência final: deve retornar 4 linhas, todas com permitido = true.
select perfil, secao, permitido
from perfil_secao
where secao = 'oportunidades'
order by perfil;
