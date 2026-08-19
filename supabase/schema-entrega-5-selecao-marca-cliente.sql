-- CHATBOT 2.0 — seleção determinística de marcas por anunciante.
-- Execute no SQL Editor do Supabase depois dos schemas de governança de marcas.

create or replace function marcas_do_cliente(p_cliente_id uuid)
returns table (
  marca_id uuid,
  marca_nome text,
  cliente_id uuid,
  cliente_nome text,
  cnpj text,
  setor text,
  industria text,
  apto_regional boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email_logado text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_nome_logado text;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  select normalizar_nome_take(coalesce(u.nome, ''))
    into v_nome_logado
  from usuario u
  where u.usuario_id = auth.uid();

  if not exists (
    select 1
    from clientes c
    where c.id = p_cliente_id
      and (
        e_proprietario()
        or tem_perfil('consultor_programa')
        or lower(trim(coalesce(c.email, ''))) = v_email_logado
        or (
          coalesce(v_nome_logado, '') <> ''
          and normalizar_nome_take(coalesce(c.executivo, '')) = v_nome_logado
        )
      )
  ) then
    raise exception 'Escolha um anunciante válido da sua carteira.';
  end if;

  return query
  with marcas_relacionadas as (
    -- Vínculos manuais têm precedência de governança e já representam
    -- explicitamente Marca → Cliente.
    select mcm.marca_id
    from marca_cliente_manual mcm
    where mcm.cliente_id = p_cliente_id

    union

    -- No Take, o cliente efetivo do par pode vir do override da marca ou do
    -- cliente padrão do anunciante do Take.
    select atm.marca_id
    from anunciante_take_marcas atm
    join anunciantes_take at on at.id = atm.anunciante_take_id
    where coalesce(atm.cliente_id_override, at.cliente_id) = p_cliente_id
  )
  select
    m.id::uuid,
    m.nome::text,
    c.id::uuid,
    c.nome::text,
    c.cnpj::text,
    c.setor::text,
    c.industria::text,
    coalesce(c.apto_regional, false)::boolean
  from marcas_relacionadas mr
  join marcas m on m.id = mr.marca_id
  join clientes c on c.id = p_cliente_id
  order by m.nome;
end;
$$;

revoke all on function marcas_do_cliente(uuid) from public;
grant execute on function marcas_do_cliente(uuid) to authenticated;

-- Conferência manual opcional depois da migration:
-- select * from marcas_do_cliente('<UUID_DE_UM_CLIENTE_DA_SUA_CARTEIRA>');
