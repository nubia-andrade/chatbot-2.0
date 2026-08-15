// Busca a API do Globo Take e substitui o snapshot em acoes_vendidas.
// Roda na máquina do administrador, onde o SSO corporativo funciona.
// Uso: npm run importar
import { createClient } from '@supabase/supabase-js'
import { deveImportar, projetar, formatosNovos } from '../src/lib/dominio/ingestao.ts'
import { montarMapa } from '../src/lib/dominio/formatos.ts'
import { lerPaginado } from '../src/lib/dados/paginacao.ts'
import { lerCredenciaisDeServico, encerrarComErro } from './ambiente.mjs'

const API = 'https://globotake.g.globo/api/v1/programsActionsPowerBi'
const TAMANHO_DO_LOTE = 500

const { url, chaveDeServico } = lerCredenciaisDeServico()
const supabase = createClient(url, chaveDeServico)

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
