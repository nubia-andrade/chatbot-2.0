// Busca a API do Globo Take (ou lê um arquivo já salvo) e substitui o
// snapshot em acoes_vendidas.
//
// Modo normal: roda na máquina do administrador, onde o SSO corporativo
// funciona no NAVEGADOR. Uso: npm run importar
//
// Modo arquivo: quando o SSO não coopera com o Node (ver mensagem de erro
// abaixo para o motivo), a pessoa salva a resposta da API pelo navegador e
// aponta este script para o arquivo. Uso: npm run importar -- --arquivo caminho/para/resposta.json
//
// Da leitura em diante — filtro de data, projeção, trava de duplicatas,
// paginação, upsert com remoção-por-diferença — o fluxo é idêntico
// independente da origem dos dados; só `obterRegistros` muda de caminho.
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { deveImportar, projetar, formatosNovos } from '../src/lib/dominio/ingestao.ts'
import { montarMapa } from '../src/lib/dominio/formatos.ts'
import { lerPaginado } from '../src/lib/dados/paginacao.ts'
import { lerCredenciaisDeServico, encerrarComErro } from './ambiente.mjs'

const API = 'https://globotake.g.globo/api/v1/programsActionsPowerBi'
const TAMANHO_DO_LOTE = 500

const { url, chaveDeServico } = lerCredenciaisDeServico()
const supabase = createClient(url, chaveDeServico)

/**
 * Descobre o arquivo de origem na linha de comando. Aceita as duas formas:
 *
 *   npm run importar -- vendas.json              (recomendada)
 *   npm run importar -- --arquivo vendas.json
 *
 * A segunda existe por compatibilidade, mas é frágil: o npm trata `--arquivo`
 * como configuração dele mesmo e não repassa a flag ao script — só o caminho
 * chega aqui. Por isso qualquer argumento solto terminado em `.json` também
 * vale como caminho.
 */
function lerArgumentoArquivo(argv) {
  const indice = argv.indexOf('--arquivo')
  if (indice !== -1) {
    const caminho = argv[indice + 1]
    if (!caminho) {
      encerrarComErro('Faltou o caminho depois de --arquivo. Uso: npm run importar -- caminho/para/resposta.json')
    }
    return caminho
  }
  return argv.find((argumento) => !argumento.startsWith('-') && argumento.endsWith('.json')) ?? null
}

/** Aceita tanto um array puro quanto um envelope `{data: [...]}` ou `{results: [...]}`. */
function extrairRegistros(brutos) {
  return Array.isArray(brutos) ? brutos : (brutos.data ?? brutos.results ?? [])
}

/** Lê os registros de um arquivo JSON salvo do navegador. */
function obterRegistrosDeArquivo(caminho) {
  if (!existsSync(caminho)) {
    encerrarComErro(
      `Não encontrei o arquivo "${caminho}".\n` +
        'Confira o caminho, ou gere o arquivo salvando a resposta da API pelo navegador ' +
        '(veja o passo a passo no README, seção "Importar sem o comando de linha").',
    )
  }

  let corpo
  try {
    corpo = readFileSync(caminho, 'utf8')
  } catch (erroDeLeitura) {
    encerrarComErro(`Não consegui ler "${caminho}": ${erroDeLeitura.message}`)
  }

  let brutos
  try {
    brutos = JSON.parse(corpo)
  } catch (erroDeParse) {
    encerrarComErro(
      `O arquivo "${caminho}" não é um JSON válido: ${erroDeParse.message}\n` +
        'Confira se foi salvo com Ctrl+S a partir da página da API (que mostra só o JSON, sem HTML ao redor).',
    )
  }

  return extrairRegistros(brutos)
}

/** Busca os registros na API do Globo Take, usando a sessão de SSO da máquina. */
async function obterRegistrosDaApi() {
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

  // A API responde HTTP 200 com a página de login quando não há sessão de SSO
  // visível para ESTE comando. A sessão do SSO vive nos cookies do
  // NAVEGADOR; o Node não tem acesso a eles e nunca vai ter só porque você
  // fez login numa aba — fazer login de novo no navegador não resolve nada
  // aqui. O caminho que funciona é salvar a resposta da API pelo navegador
  // (onde a sessão existe) e importar a partir do arquivo:
  if (corpo.trimStart().startsWith('<')) {
    encerrarComErro(
      'A API devolveu HTML em vez de JSON: este comando (rodando no terminal, via Node) não\n' +
        'enxerga a sessão do SSO corporativo — ela fica guardada nos cookies do NAVEGADOR, e\n' +
        'o Node não tem acesso a eles. Fazer login de novo na aba do navegador não resolve,\n' +
        'porque o problema não é a sessão estar expirada: é que o terminal nunca a vê.\n\n' +
        'O caminho que funciona hoje:\n' +
        `  1. Abra ${API} no navegador, já logado.\n` +
        '  2. Salve a página com Ctrl+S, formato "Página da Web, somente HTML" ou similar,\n' +
        '     com extensão .json (o conteúdo já é só o JSON da resposta).\n' +
        '  3. Rode: npm run importar -- --arquivo caminho/para/o-arquivo-salvo.json\n\n' +
        'O passo a passo completo está no README, seção "Importar sem o comando de linha".\n' +
        'Nada foi alterado no banco.',
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

  return extrairRegistros(brutos)
}

const caminhoDoArquivo = lerArgumentoArquivo(process.argv.slice(2))
const registros = caminhoDoArquivo ? obterRegistrosDeArquivo(caminhoDoArquivo) : await obterRegistrosDaApi()
const hoje = new Date().toISOString().slice(0, 10)

// Um único carimbo para a leva inteira: o painel usa MAX(importado_em) para
// mostrar quando foi a última importação (src/lib/dados/importacao.ts), e
// isso só funciona se todo registro desta rodada levar o mesmo instante —
// gerar um `new Date()` por linha tornaria essa data quase arbitrária.
const agora = new Date().toISOString()

// Filtro e projeção usam a mesma lógica de domínio do aplicativo
// (src/lib/dominio/ingestao.ts) — nada disso é reimplementado aqui, para que
// o script e o app nunca divirjam sobre o que conta como ação futura.
//
// `projetar()` não carimba `importado_em` de propósito: essa coluna é sobre
// quando o script rodou, não sobre os dados da API, então é responsabilidade
// daqui, não da projeção de domínio (que é coberta por teste como projeção
// pura das colunas vindas da origem). É setado explicitamente porque o
// `default now()` do schema só se aplica a INSERT — num UPSERT sobre uma
// entrega que já existia (o caso comum: quase tudo aqui é exibição futura,
// logo já apareceu numa importação anterior), sem isso a coluna manteria o
// timestamp antigo e o painel mostraria um snapshot velho como se fosse
// recente.
const aceitos = registros
  .filter((registro) => deveImportar(registro, hoje))
  .map((registro) => ({ ...projetar(registro), importado_em: agora }))

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

// Trava de segurança: `numero_da_entrega` é a chave primária de
// `acoes_vendidas`, o que assume que a origem nunca manda a mesma entrega em
// duas linhas. A premissa se sustenta na amostra real (302 registros, 302
// números distintos), mas a base completa é maior e ninguém garante isso.
//
// Se a premissa cair, o upsert erraria de duas formas ruins: colapsaria as
// linhas repetidas numa só — ocupação ABAIXO da real, o pior erro possível
// neste produto, porque faria o app anunciar espaço que já foi vendido — ou o
// lote quebraria com "cannot affect row a second time", mensagem que não
// explica nada a quem roda a importação.
//
// Por isso a checagem é aqui, em memória, ANTES de qualquer escrita: erro
// visível e explicado é infinitamente melhor que ocupação silenciosamente
// errada.
const EXEMPLOS_DE_DUPLICATA = 5

const porNumeroDeEntrega = new Map()
for (const acao of aceitos) {
  const iguais = porNumeroDeEntrega.get(acao.numero_da_entrega)
  if (iguais) iguais.push(acao)
  else porNumeroDeEntrega.set(acao.numero_da_entrega, [acao])
}

const duplicadas = [...porNumeroDeEntrega.entries()].filter(([, iguais]) => iguais.length > 1)

if (duplicadas.length > 0) {
  const exemplos = duplicadas
    .slice(0, EXEMPLOS_DE_DUPLICATA)
    .map(([numero, iguais]) => {
      const linhas = iguais
        .map(
          (acao) =>
            `      data ${acao.data_de_exibicao || '(sem data)'} · formato ` +
            `${acao.formato || '(sem formato)'} · programa ${acao.programa || '(sem programa)'}`,
        )
        .join('\n')
      return `  entrega ${numero} — ${iguais.length} linhas:\n${linhas}`
    })
    .join('\n')

  encerrarComErro(
    '\nIMPORTAÇÃO CANCELADA: a API trouxe números de entrega repetidos.\n' +
      `${duplicadas.length} número(s) de entrega aparecem em mais de uma linha desta leva.\n\n` +
      'Exemplos:\n' +
      exemplos +
      (duplicadas.length > EXEMPLOS_DE_DUPLICATA
        ? `\n  … e mais ${duplicadas.length - EXEMPLOS_DE_DUPLICATA} número(s).\n`
        : '\n') +
      '\nHoje `numero_da_entrega` é a chave primária de `acoes_vendidas`, ou seja, o\n' +
      'banco só admite uma linha por entrega. Gravar assim colapsaria as linhas\n' +
      'repetidas numa só e a ocupação calculada ficaria ABAIXO da real — o app\n' +
      'anunciaria como livre espaço que já foi vendido.\n\n' +
      'A chave primária precisa ser revista antes de importar (provavelmente\n' +
      'passando a combinar entrega + data de exibição + formato, em\n' +
      '`supabase/schema.sql`). Nada foi alterado no banco.',
  )
}

const { linhas: formatosCadastrados, erro: erroFormatos } = await lerPaginado((de, ate) =>
  supabase.from('formatos').select('formato, categoria').range(de, ate),
)
if (erroFormatos) {
  encerrarComErro(
    'Não consegui ler a tabela de formatos para checar formatos novos: ' + erroFormatos,
  )
}
const mapa = montarMapa(formatosCadastrados)
const novos = formatosNovos(aceitos, mapa)

// A partir daqui os dados já estão validados e completos em memória (`aceitos`).
// Só agora o script toca no banco — e faz isso por diferença (upsert do que
// veio, depois apaga só o que saiu), nunca por "apagar tudo e inserir de
// novo": se a inserção falhar no meio do caminho, o snapshot anterior
// continua de pé em vez de a base ficar vazia.
//
// A leitura é PAGINADA de propósito. O PostgREST corta em 1000 linhas sem
// avisar; um `select('numero_da_entrega')` solto enxergaria só as primeiras
// mil entregas e toda venda cancelada além desse ponto jamais seria removida
// — ficaria ocupando slot para sempre, e o app diria "esgotado" onde há
// espaço livre.
const { linhas: existentes, erro: erroExistentes } = await lerPaginado((de, ate) =>
  supabase.from('acoes_vendidas').select('numero_da_entrega').range(de, ate),
)
if (erroExistentes) {
  encerrarComErro('Não consegui ler o snapshot atual antes de importar: ' + erroExistentes)
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
const idsParaRemover = existentes
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
