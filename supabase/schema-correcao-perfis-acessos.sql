-- CHATBOT 2.0 — Correção pontual: Perfis e acessos
--
-- Corrige a RPC `listar_usuarios_acessos()` quando o PostgreSQL retorna
-- `auth.users.email` como varchar enquanto a função declara `email text`.
-- Em funções RETURNS TABLE, o tipo precisa corresponder exatamente.
--
-- Seguro para rodar depois de `schema-entrega-4-propostas-acessos.sql` e
-- depois de `schema-entrega-4-fechamento-propostas.sql`. Não altera a lógica
-- nova de destinatários/e-mail de propostas.

create or replace function listar_usuarios_acessos()
returns table (
  usuario_id uuid,
  email text,
  nome text,
  cargo text,
  perfis text[],
  programas uuid[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not e_proprietario() then
    raise exception 'Apenas o proprietário pode administrar perfis e acessos.';
  end if;

  return query
  select
    au.id::uuid,
    coalesce(au.email, '')::text,
    coalesce(u.nome, au.email, '')::text,
    u.cargo::text,
    coalesce(
      (select array_agg(pu.perfil::text order by pu.perfil)
       from public.perfil_usuario pu
       where pu.usuario_id = au.id),
      '{}'::text[]
    )::text[],
    coalesce(
      (select array_agg(cp.programa_id::uuid order by cp.programa_id)
       from public.consultor_programa cp
       where cp.usuario_id = au.id),
      '{}'::uuid[]
    )::uuid[]
  from auth.users au
  left join public.usuario u on u.usuario_id = au.id
  order by coalesce(u.nome, au.email, '');
end;
$$;

revoke all on function listar_usuarios_acessos() from public;
grant execute on function listar_usuarios_acessos() to authenticated;

-- Conferência após executar:
-- select * from listar_usuarios_acessos();
