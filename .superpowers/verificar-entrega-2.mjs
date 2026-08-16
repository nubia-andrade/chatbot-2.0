// Confere se supabase/schema-entrega-2.sql já foi aplicado no banco real.
// Rode depois de colar o schema-entrega-2.sql no SQL Editor do Supabase.
//
// Confirma:
//   - as 7 tabelas novas existem (usuario, consultor_programa, pracas,
//     preco_regional, datas_bloqueadas, restricoes_anunciante, acoes_regionais)
//   - `pracas` tem as 5 linhas com os códigos exatos (SP, RJ, BH, DF, PE1)
//   - `perfil_usuario` aceita mais de uma linha por usuário (chave composta
//     usuario_id + perfil, não mais só usuario_id)
//   - as colunas novas de `programas` existem
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const linha of readFileSync('.env.local', 'utf8').split('\n')) {
  const par = linha.match(/^([A-Z_]+)=(.*)$/)
  if (par) env[par[1]] = par[2].trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let falhas = 0

function marcar(ok, mensagem) {
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${mensagem}`)
  if (!ok) falhas++
}

console.log('1) Tabelas novas existem?')
const tabelasNovas = [
  'usuario',
  'consultor_programa',
  'pracas',
  'preco_regional',
  'datas_bloqueadas',
  'restricoes_anunciante',
  'acoes_regionais',
]
for (const tabela of tabelasNovas) {
  // Não usar { head: true, count: 'exact' } sozinho: quando a tabela não
  // existe, o PostgREST às vezes devolve 204 sem erro e count null em vez de
  // 404 — a checagem passaria mesmo com a migração não aplicada. Um select
  // de linha real força o erro PGRST205 quando a tabela falta.
  const { data, error } = await supabase.from(tabela).select('*').limit(1)
  const { count } = error ? {} : await supabase.from(tabela).select('*', { count: 'exact', head: true })
  marcar(!error, `${tabela.padEnd(22)} ${error ? error.message : `ok, ${count ?? data.length} linha(s) (amostra)`}`)
}

console.log('\n2) `pracas` tem as 5 linhas com os códigos exatos?')
{
  const { data, error } = await supabase.from('pracas').select('codigo, nome, ordem').order('ordem')
  if (error) {
    marcar(false, `não deu para ler pracas: ${error.message}`)
  } else {
    const esperados = ['SP', 'RJ', 'BH', 'DF', 'PE1']
    const codigos = (data ?? []).map((linha) => linha.codigo)
    marcar(
      esperados.every((codigo) => codigos.includes(codigo)) && codigos.length === 5,
      `esperado [${esperados.join(', ')}], encontrado [${codigos.join(', ')}]`
    )
  }
}

console.log('\n3a) `nome`/`cargo` saíram de `perfil_usuario` (migraram para `usuario`)?')
{
  // Um select sem erro aqui significa que as colunas antigas ainda existem
  // em perfil_usuario, ou seja, a migração não rodou.
  const { error } = await supabase.from('perfil_usuario').select('nome, cargo').limit(1)
  marcar(!!error, error ? `colunas já removidas (${error.message})` : 'nome/cargo ainda existem em perfil_usuario')
}

console.log('\n3b) `perfil_usuario` aceita mais de uma linha por usuário (chave composta usuario_id+perfil)?')
{
  const { data: existentes, error: erroLeitura } = await supabase
    .from('perfil_usuario')
    .select('usuario_id, perfil')
    .limit(1)
  if (erroLeitura) {
    marcar(false, `não deu para ler perfil_usuario: ${erroLeitura.message}`)
  } else if (!existentes || existentes.length === 0) {
    marcar(false, 'perfil_usuario está vazia — não há usuário real para testar a chave composta')
  } else {
    const usuarioId = existentes[0].usuario_id
    const perfilTeste = existentes[0].perfil === 'executivo' ? 'proprietario' : 'executivo'
    const { error: erroInsercao } = await supabase
      .from('perfil_usuario')
      .insert({ usuario_id: usuarioId, perfil: perfilTeste })
    if (erroInsercao) {
      marcar(
        false,
        `inserir um segundo perfil para o mesmo usuário falhou (${erroInsercao.message}) — a chave ainda é só usuario_id`
      )
    } else {
      marcar(true, 'segunda linha para o mesmo usuário aceita — chave composta ativa')
      // Limpa a linha de teste para não deixar rastro no banco.
      await supabase.from('perfil_usuario').delete().eq('usuario_id', usuarioId).eq('perfil', perfilTeste)
    }
  }
}

console.log('\n4) Colunas novas de `programas` existem?')
{
  const { data, error } = await supabase
    .from('programas')
    .select(
      'aceita_regional, dia_da_semana_regional, prazo_minimo_regional_dias, max_pracas_por_acao, atualizado_em'
    )
    .limit(1)
  marcar(!error, error ? error.message : 'colunas novas presentes')
}

console.log('\n5) Custos (Entrega 3): colunas novas presentes e as antigas removidas?')
{
  const { error: erroNovasProgramas } = await supabase
    .from('programas')
    .select('custo_midia_tv, custo_producao_tv, custo_midia_digital, custo_producao_digital')
    .limit(1)
  marcar(!erroNovasProgramas, erroNovasProgramas ? erroNovasProgramas.message : 'programas: colunas de custo novas presentes')

  const { error: erroAntigasProgramas } = await supabase
    .from('programas')
    .select('custo_midia, custo_producao, custo_multishow, direitos_e_conexos, custo_producao_regional')
    .limit(1)
  marcar(
    !!erroAntigasProgramas,
    erroAntigasProgramas ? `colunas antigas já removidas (${erroAntigasProgramas.message})` : 'colunas antigas ainda existem em programas'
  )

  const { error: erroNovasPreco } = await supabase
    .from('preco_regional')
    .select('custo_midia_tv, custo_producao_tv, percentual_simulcast, custo_midia_digital, custo_producao_digital')
    .limit(1)
  marcar(!erroNovasPreco, erroNovasPreco ? erroNovasPreco.message : 'preco_regional: colunas de custo novas presentes')

  const { error: erroAntigaPreco } = await supabase.from('preco_regional').select('valor').limit(1)
  marcar(
    !!erroAntigaPreco,
    erroAntigaPreco ? `coluna antiga já removida (${erroAntigaPreco.message})` : 'preco_regional.valor ainda existe'
  )
}

console.log(`\n${falhas === 0 ? 'Tudo certo: migração aplicada.' : `${falhas} verificação(ões) falhou(aram) — aplique supabase/schema-entrega-2.sql no SQL Editor do Supabase e rode de novo.`}`)
process.exit(falhas === 0 ? 0 : 1)
