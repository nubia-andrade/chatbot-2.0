-- CHATBOT 2.0 — Correção do cadastro de marca pela Nova Consulta.
-- Corrige o erro PostgreSQL: column reference "marca_id" is ambiguous.
--
-- Causa: cadastrar_marca_da_carteira() retorna uma coluna chamada marca_id e
-- também usava ON CONFLICT (marca_id, cliente_id). Em PL/pgSQL, marca_id passa
-- a existir como variável de saída da função, tornando a referência ambígua.
--
-- Esta correção preserva a assinatura da função e referencia a PK da tabela
-- explicitamente no ON CONFLICT.

create or replace function cadastrar_marca_da_carteira(
  p_nome_marca text,
  p_cliente_id uuid
)
returns table (
  marca_id uuid,
  marca_nome text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_nome text := trim(coalesce(p_nome_marca, ''));
  v_normalizado text;
  v_marca_id uuid;
  v_cliente_existente uuid;
  v_email_logado text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_nome_logado text;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.';
  end if;

  if v_nome = '' then
    raise exception 'Informe somente o nome da marca.';
  end if;

  if length(v_nome) > 120 then
    raise exception 'O nome da marca deve ter no máximo 120 caracteres.';
  end if;

  select normalizar_nome_take(coalesce(u.nome, ''))
    into v_nome_logado
  from usuario u
  where u.usuario_id = auth.uid();

  if p_cliente_id is null or not exists (
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

  v_normalizado := normalizar_nome_take(v_nome);

  select m.id into v_marca_id
  from marcas m
  where m.nome_normalizado = v_normalizado
  limit 1;

  if v_marca_id is not null then
    select mcm.cliente_id into v_cliente_existente
    from marca_cliente_manual mcm
    where mcm.marca_id = v_marca_id
    limit 1;

    if v_cliente_existente is not null and v_cliente_existente is distinct from p_cliente_id then
      raise exception 'Esta marca já está vinculada a outro anunciante. Solicite a revisão em Marcas e anunciantes.';
    end if;
  end if;

  insert into marcas (nome, nome_normalizado, primeiro_visto_em, ultimo_visto_em)
  values (v_nome, v_normalizado, now(), now())
  on conflict (nome_normalizado) do update
    set ultimo_visto_em = greatest(marcas.ultimo_visto_em, excluded.ultimo_visto_em)
  returning id into v_marca_id;

  insert into marca_cliente_manual (
    marca_id,
    cliente_id,
    criado_por,
    criado_em,
    origem,
    revisao_status,
    revisado_por,
    revisado_em
  )
  values (
    v_marca_id,
    p_cliente_id,
    auth.uid(),
    now(),
    'consulta',
    'pendente',
    null,
    null
  )
  on conflict on constraint marca_cliente_manual_pkey do nothing;

  return query
  select m.id, m.nome
  from marcas m
  where m.id = v_marca_id;
end;
$$;

revoke all on function cadastrar_marca_da_carteira(text, uuid) from public;
grant execute on function cadastrar_marca_da_carteira(text, uuid) to authenticated;
