// Busca a API do Globo Take e substitui o snapshot em acoes_vendidas.
// Roda na máquina do administrador, onde o SSO corporativo funciona.
// Uso: npm run importar
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { deveImportar, projetar, formatosNovos } from '../src/lib/dominio/ingestao.ts'
import { montarMapa } from '../src/lib/dominio/formatos.ts'

const API = 'https://globotake.g.globo/api/v1/programsActionsPowerBi'
const TAMANHO_DO_LOTE = 500

function lerEnv() {
  let texto
  try {
    texto = readFileSync('.env.local', 'utf8')
  } catch {
    console.error(
      'Não encontrei o arquivo .env.local na raiz do projeto.\n' +
        'Copie .env.local.example para .env.local e preencha com as chaves do Supabase ' +
        '(a SUPABASE_SERVICE_ROLE_KEY fica em Project Settings > API > service_role).',
    )
    process.exit(1)
  }
  const env = {}
  for (const linha of texto.split('\n')) {
    const par = linha.match(/^([A-Z_]+)=(.*)$/)
    if (par) env[par[1]] = par[2].trim()
  }
  return env
}

function encerrarComErro(mensagem) {
  console.error(mensagem)
  process.exit(1)
}

const env = lerEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  encerrarComErro(
    'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n' +
      'Preencha as duas chaves (Project Settings > API) antes de importar.',
  )
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let resposta
try {
  resposta = await fetch(API)
} catch (erroDeRede) {
  encerrarComErro(
    'Não consegui alcançar ' +
      API +
      ' (' +
      erroDeRede.message +
      ').\n' +
      'Confira a conexão com a rede corporativa e tente de novo. Nada foi alterado no banco.',
  )
}

const corpo = await resposta.text()

// A API responde HTTP 200 com a página de login quando não há sessão de SSO.
if (corpo.trimStart().startsWith('<')) {
  encerrarComErro(
    'A API devolveu HTML em vez de JSON: você não está autenticado no SSO corporativo.\n' +
      'Abra ' +
      API +
      ' no navegador, faça login, e rode este comando de novo.\nNada foi alterado no banco.',
  )
}

let brutos
try {
  brutos = JSON.parse(corpo)
} catch {
  encerrarComErro(
    'A API respondeu, mas o corpo não é JSON válido. Nada foi alterado no banco.\n' +
      'Início da resposta: ' +
      corpo.slice(0, 200),
  )
}

const registros = Array.isArray(brutos) ? brutos : (brutos.data ?? brutos.results ?? [])
const hoje = new Date().toISOString().slice(0, 10)

// Filtro e projeção usam a mesma lógica de domínio do aplicativo
// (src/lib/dominio/ingestao.ts) — nada disso é reimplementado aqui, para que
// o script e o app nunca divirjam sobre o que conta como ação futura.
const aceitos = registros.filter((registro) => deveImportar(registro, hoje)).map(projetar)

// Trava de segurança: uma resposta vazia ou um filtro que zera tudo (bug na
// API, na rede, ou aqui mesmo) não pode se transformar em "apagar a base
// inteira". Isso faria o app anunciar toda a grade como disponível — o pior
// erro possível neste produto. Preferimos parar e avisar a arriscar isso.
if (registros.length > 0 && aceitos.length === 0) {
  encerrarComErro(
    'A API devolveu ' +
      registros.length +
      ' registro(s), mas nenhum passou no filtro de importação ' +
      '(data futura e válida). Isso é inesperado — parei antes de tocar no banco. ' +
      'Confira a resposta da API antes de rodar de novo.',
  )
}
if (registros.length === 0) {
  encerrarComErro('A API devolveu zero registros. Parei antes de tocar no banco.')
}

const { data: formatosCadastrados, error: erroFormatos } = await supabase
  .from('formatos')
  .select('formato, categoria')
if (erroFormatos) {
  encerrarComErro(
    'Não consegui ler a tabela de formatos para checar formatos novos: ' + erroFormatos.message,
  )
}
const mapa = montarMapa(formatosCadastrados ?? [])
const novos = formatosNovos(aceitos, mapa)

// A partir daqui os dados já estão validados e completos em memória (`aceitos`).
// Só agora o script toca no banco — e faz isso por diferença (upsert do que
// veio, depois apaga só o que saiu), nunca por "apagar tudo e inserir de
// novo": se a inserção falhar no meio do caminho, o snapshot anterior
// continua de pé em vez de a base ficar vazia.
const { data: existentes, error: erroExistentes } = await supabase
  .from('acoes_vendidas')
  .select('numero_da_entrega')
if (erroExistentes) {
  encerrarComErro('Não consegui ler o snapshot atual antes de importar: ' + erroExistentes.message)
}

for (let i = 0; i < aceitos.length; i += TAMANHO_DO_LOTE) {
  const lote = aceitos.slice(i, i + TAMANHO_DO_LOTE)
  const { error } = await supabase.from('acoes_vendidas').upsert(lote)
  if (error) {
    encerrarComErro(
      '\nFALHA AO GRAVAR o lote ' +
        (i / TAMANHO_DO_LOTE + 1) +
        ': ' +
        error.message +
        '\nO snapshot anterior NÃO foi apagado — a base continua com os dados de antes desta ' +
        'tentativa. Corrija o problema e rode a importação de novo.',
    )
  }
}

const idsNovos = new Set(aceitos.map((acao) => acao.numero_da_entrega))
const idsParaRemover = (existentes ?? [])
  .map((linha) => linha.numero_da_entrega)
  .filter((id) => !idsNovos.has(id))

for (let i = 0; i < idsParaRemover.length; i += TAMANHO_DO_LOTE) {
  const lote = idsParaRemover.slice(i, i + TAMANHO_DO_LOTE)
  const { error } = await supabase.from('acoes_vendidas').delete().in('numero_da_entrega', lote)
  if (error) {
    encerrarComErro(
      '\nFALHA AO REMOVER entregas que saíram da origem: ' +
        error.message +
        '\nOs dados novos já foram gravados; ficaram ' +
        idsParaRemover.length +
        ' entrega(s) antiga(s) sem remover — rode a importação de novo para limpar.',
    )
  }
}

console.log(`recebidos: ${registros.length}`)
console.log(`importados: ${aceitos.length}`)
console.log(`descartados (passado ou sem data): ${registros.length - aceitos.length}`)
console.log(`removidos (saíram da origem): ${idsParaRemover.length}`)
if (novos.length > 0) {
  console.log('\nFORMATOS NOVOS, ainda sem categoria cadastrada:')
  for (const formato of novos) console.log(`  - ${formato}`)
  console.log('Enquanto não forem classificados, contam como AÇÃO DE CONTEÚDO.')
}
