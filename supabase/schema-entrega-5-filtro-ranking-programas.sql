-- CHATBOT 2.0 — Entrega 5: filtro de performance por programa e ranking.
-- Rode no SQL Editor depois de schema-entrega-5-acompanhamento-performance.sql.
-- Idempotente.

-- Guarda o nome de quem gerou a proposta no próprio documento histórico.
-- Isso permite ao Consultor enxergar o ranking sem abrir acesso à tabela
-- administrativa de usuários e preserva o nome usado no momento da emissão.
alter table propostas
  add column if not exists executivo_nome text;

-- Preenche propostas já existentes usando o cadastro atual do usuário.
update propostas p
set executivo_nome = u.nome
from usuario u
where u.usuario_id = p.usuario_id
  and nullif(trim(coalesce(p.executivo_nome, '')), '') is null;

comment on column propostas.executivo_nome is
  'Snapshot do nome do executivo que gerou a proposta; usado em histórico e performance.';

-- Novas propostas recebem o snapshot automaticamente, sem depender de o
-- front-end conhecer a estrutura da tabela usuario.
create or replace function preencher_executivo_nome_proposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.executivo_nome, '')), '') is null then
    select u.nome
      into new.executivo_nome
    from usuario u
    where u.usuario_id = new.usuario_id;
  end if;

  return new;
end;
$$;

drop trigger if exists propostas_preencher_executivo_nome on propostas;
create trigger propostas_preencher_executivo_nome
before insert or update of usuario_id on propostas
for each row execute function preencher_executivo_nome_proposta();

-- Atualiza o cache de schema usado pela API do Supabase/PostgREST.
notify pgrst, 'reload schema';

-- Conferência esperada: uma linha para cada proposta existente.
select
  p.id,
  p.executivo_nome,
  p.programa_nome,
  p.criado_em
from propostas p
order by p.criado_em desc
limit 20;
