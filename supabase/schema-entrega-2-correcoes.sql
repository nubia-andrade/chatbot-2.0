-- CHATBOT 2.0 — correções da revisão final da Entrega 2.
-- Rode no SQL Editor do Supabase DEPOIS de schema.sql e schema-entrega-2.sql.
-- Pode rodar quantas vezes quiser: tudo aqui é `create or replace` ou
-- `drop policy if exists` seguido de `create policy`.
--
-- Este arquivo é o ÚLTIMO da sequência e tem a palavra final sobre
-- autorização. Os dois anteriores já foram aplicados no banco de produção e
-- por isso não são editados — corrigi-los no lugar faria a versão do
-- repositório divergir do que a usuária realmente rodou.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql   <- este
--
-- ATENÇÃO: reaplicar o schema.sql sozinho, depois deste arquivo, reverte a
-- autorização — ele recria `e_administrador()` com a definição antiga e as
-- policies amplas junto. Se precisar reaplicar qualquer arquivo anterior,
-- rode este de novo em seguida.

-- ---------------------------------------------------------------------------
-- 1. Uma definição só para "quem administra programas"
-- ---------------------------------------------------------------------------
-- `e_administrador()` tinha DUAS definições divergentes no repositório:
--
--   schema.sql:91           perfil in ('admin_programa', 'admin_geral')
--   schema-entrega-2.sql:160  tem_perfil('proprietario') or tem_perfil('consultor_programa')
--
-- Os perfis antigos nem existem mais depois da migração da Entrega 2 (o
-- `check` de `perfil_usuario` só aceita os quatro novos), então a definição
-- do schema.sql passa a devolver SEMPRE falso — e reaplicar aquele arquivo
-- trancaria todo mundo para fora, em silêncio, sem erro nenhum no console.
--
-- A regra passa a morar em UMA função com nome que diz o que ela decide.
-- `e_administrador()` continua existindo porque policies antigas ainda a
-- citam, mas vira um apelido fino: quem define o comportamento é
-- `e_consultor_ou_proprietario()`, e não há mais duas verdades possíveis.
create or replace function e_consultor_ou_proprietario()
returns boolean language sql security definer set search_path = public as $$
  select tem_perfil('proprietario') or tem_perfil('consultor_programa');
$$;

create or replace function e_administrador()
returns boolean language sql security definer set search_path = public as $$
  select e_consultor_ou_proprietario();
$$;

-- ---------------------------------------------------------------------------
-- 2. Apelidos de programa: vínculo, não "qualquer administrador"
-- ---------------------------------------------------------------------------
-- A policy de `programa_apelidos` (schema.sql:120-122) exigia só
-- `e_administrador()`, enquanto as quatro tabelas dependentes de programa já
-- exigem `e_consultor_de(programa_id)`. Um consultor conseguia reescrever os
-- apelidos de um programa alheio.
--
-- Isso não é cosmético: é o apelido que diz qual entrega da API pertence a
-- qual programa (`encontrarProgramaId`, src/lib/dominio/programas.ts). Quatro
-- dos 23 programas chegam da API sem mnemônico e dependem inteiramente do
-- apelido. Trocar o apelido de um programa alheio é reescrever a ocupação
-- dele — e, com ela, a disponibilidade que o sistema vai oferecer.
drop policy if exists "escrita administrador" on programa_apelidos;
drop policy if exists "escrita consultor" on programa_apelidos;
create policy "escrita consultor" on programa_apelidos
  for all to authenticated
  using (e_consultor_de(programa_id))
  with check (e_consultor_de(programa_id));

-- A leitura segue aberta a qualquer autenticado: o índice de apelidos alimenta
-- o cálculo de ocupação, que todo executivo consulta.
drop policy if exists "leitura autenticada" on programa_apelidos;
create policy "leitura autenticada" on programa_apelidos
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Imagens de programa no Storage
-- ---------------------------------------------------------------------------
-- Mesmo problema das policies anteriores: `e_administrador()` deixava
-- qualquer consultor SUBSTITUIR ou APAGAR a imagem de qualquer programa.
--
-- Aqui não dá para exigir `e_consultor_de(programa_id)` literalmente:
-- `storage.objects` não tem coluna de programa, e o caminho do arquivo é um
-- UUID sorteado (src/lib/acoes/imagens.ts) justamente porque a imagem é
-- enviada ANTES de o programa existir — no cadastro de um programa novo não
-- há id para amarrar. Amarrar o objeto ao programa exigiria inverter esse
-- fluxo (criar o programa primeiro, subir a imagem depois), o que é mudança
-- de produto, não de policy.
--
-- O equivalente possível, e que fecha o buraco real: quem envia é dono do que
-- enviou. Alterar e apagar ficam restritos ao próprio autor do upload — ou ao
-- proprietário, que responde por tudo. Um consultor não alcança mais o
-- arquivo de outro.
drop policy if exists "imagens de programa: leitura publica" on storage.objects;
create policy "imagens de programa: leitura publica" on storage.objects
  for select using (bucket_id = 'programas');

drop policy if exists "imagens de programa: escrita administrador" on storage.objects;
drop policy if exists "imagens de programa: envio consultor" on storage.objects;
create policy "imagens de programa: envio consultor" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'programas' and e_consultor_ou_proprietario());

drop policy if exists "imagens de programa: substituicao administrador" on storage.objects;
drop policy if exists "imagens de programa: substituicao do autor" on storage.objects;
create policy "imagens de programa: substituicao do autor" on storage.objects
  for update to authenticated
  using (bucket_id = 'programas' and (owner = auth.uid() or e_proprietario()))
  with check (bucket_id = 'programas' and (owner = auth.uid() or e_proprietario()));

drop policy if exists "imagens de programa: remocao administrador" on storage.objects;
drop policy if exists "imagens de programa: remocao do autor" on storage.objects;
create policy "imagens de programa: remocao do autor" on storage.objects
  for delete to authenticated
  using (bucket_id = 'programas' and (owner = auth.uid() or e_proprietario()));

-- ---------------------------------------------------------------------------
-- 4. Criação de programa
-- ---------------------------------------------------------------------------
-- Só troca o nome da função pela versão sem ambiguidade. O critério é o
-- mesmo: consultor e proprietário criam programa (o vínculo por programa não
-- pode ser exigido no INSERT — o programa ainda não existe para ter vínculo).
drop policy if exists "insercao administrador" on programas;
create policy "insercao administrador" on programas
  for insert to authenticated with check (e_consultor_ou_proprietario());
