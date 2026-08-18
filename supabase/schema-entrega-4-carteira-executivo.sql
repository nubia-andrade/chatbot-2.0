-- CHATBOT 2.0 — Entrega 4: busca da carteira por executivo.
--
-- Objetivos:
--   * executivo encontra CLIENTES da própria carteira, não apenas marcas já
--     aprendidas pelo Globo Take;
--   * a busca aceita tanto nome do cliente/anunciante quanto nome da marca;
--   * ao focar o campo vazio, o executivo já enxerga clientes da sua carteira;
--   * proprietário e consultor de programa continuam podendo pesquisar a
--     carteira completa para administração/testes;
--   * clientes sem marca conhecida no Take continuam selecionáveis. Nesse
--     caso marca_id/marca_nome retornam nulos e a proposta usa o anunciante.
--
-- Rode depois de schema-marcas-take.sql e schema-entrega-2.sql.
-- Idempotente: create or replace + índice if not exists.

create index if not exists clientes_email_executivo_idx
  on clientes (lower(trim(email)));

create or replace function buscar_marcas(
  termo_busca text,
  limite_busca integer default 20
)
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
language sql
stable
security invoker
set search_path = public
as $$
  with contexto as (
    select
      trim(coalesce(termo_busca, '')) as termo,
      lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email_logado,
      normalizar_nome_take(coalesce((
        select u.nome
        from usuario u
        where u.usuario_id = auth.uid()
      ), '')) as nome_logado,
      e_proprietario() or tem_perfil('consultor_programa') as pode_ver_toda_carteira
  ),
  clientes_visiveis as (
    select c.*
    from clientes c
    cross join contexto ctx
    where ctx.pode_ver_toda_carteira
       or lower(trim(coalesce(c.email, ''))) = ctx.email_logado
       or (
         ctx.nome_logado <> ''
         and normalizar_nome_take(coalesce(c.executivo, '')) = ctx.nome_logado
       )
  ),
  resultados as (
    -- Cliente/anunciante da carteira. Garante que clientes ainda sem marca
    -- aprendida no Take possam iniciar uma consulta normalmente.
    select
      null::uuid as marca_id,
      null::text as marca_nome,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.cnpj,
      c.setor,
      c.industria,
      c.apto_regional,
      0 as prioridade
    from clientes_visiveis c
    cross join contexto ctx
    where ctx.termo = ''
       or c.nome ilike '%' || ctx.termo || '%'

    union all

    -- Marcas conhecidas do Take ligadas aos mesmos clientes visíveis. Quando
    -- o usuário busca pelo anunciante, mostramos também suas marcas conhecidas;
    -- quando busca diretamente pela marca, o casamento leva ao cliente oficial.
    select distinct
      m.id as marca_id,
      m.nome as marca_nome,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.cnpj,
      c.setor,
      c.industria,
      c.apto_regional,
      1 as prioridade
    from clientes_visiveis c
    join anunciantes_take at on at.cliente_id = c.id
    join anunciante_take_marcas atm on atm.anunciante_take_id = at.id
    join marcas m on m.id = atm.marca_id
    cross join contexto ctx
    where ctx.termo <> ''
      and (
        m.nome ilike '%' || ctx.termo || '%'
        or c.nome ilike '%' || ctx.termo || '%'
      )
  )
  select
    r.marca_id,
    r.marca_nome,
    r.cliente_id,
    r.cliente_nome,
    r.cnpj,
    r.setor,
    r.industria,
    r.apto_regional
  from resultados r
  order by
    r.prioridade,
    r.cliente_nome,
    r.marca_nome nulls first
  limit greatest(1, least(coalesce(limite_busca, 20), 50));
$$;

revoke execute on function buscar_marcas(text, integer) from public;
grant execute on function buscar_marcas(text, integer) to authenticated;

-- Conferência para um executivo logado:
--   select * from buscar_marcas('', 20);
-- Deve listar a própria carteira. O vínculo é feito primeiro por e-mail e,
-- como fallback, pelo nome do executivo salvo em `usuario` x `clientes.executivo`.
--
-- Busca por cliente:
--   select * from buscar_marcas('ADEMICON', 20);
-- Deve retornar o cliente e, se existirem, marcas conhecidas ligadas a ele.
--
-- Busca por marca:
--   select * from buscar_marcas('YPE', 20);
-- Deve retornar a marca e o anunciante oficial correspondente.
