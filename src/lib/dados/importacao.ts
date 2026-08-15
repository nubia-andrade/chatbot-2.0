import { criarClienteServidor } from '../supabase/cliente-servidor'
import { formatosNovos } from '../dominio/ingestao'
import { montarMapa } from '../dominio/formatos'
import { lerPaginado } from './paginacao'

export type ResumoDaImportacao = {
  importadoEm: string | null
  total: number
  porPrograma: { programa: string; acoes: number }[]
  formatosNovos: string[]
}

const RESUMO_VAZIO: ResumoDaImportacao = {
  importadoEm: null,
  total: 0,
  porPrograma: [],
  formatosNovos: [],
}

/**
 * Estado do snapshot de `acoes_vendidas`, para o painel de
 * Configurações > Importação: quando foi a última importação (o dado mais
 * importante da tela — um snapshot velho não pode ser confundido com
 * disponibilidade atual), quantas ações vieram, a distribuição por
 * programa, e os formatos que a origem já usa mas ainda não foram
 * classificados em `formatos`.
 *
 * Sem essa última lista, um formato novo na API entraria mudo, contaria
 * como AÇÃO DE CONTEÚDO por R2 (`src/lib/dominio/formatos.ts`) e
 * distorceria a ocupação sem ninguém perceber — por isso reaproveita
 * `formatosNovos`, a mesma função que o importador usa, em vez de comparar
 * as duas tabelas de novo aqui.
 */
export async function resumoDaImportacao(): Promise<ResumoDaImportacao> {
  const supabase = await criarClienteServidor()

  // As três leituras: o total (contagem exata, sem trazer linha alguma), as
  // linhas em si (paginadas — `acoes_vendidas` passa de 1000 com folga na
  // base real) e a tabela de formatos (também paginada; hoje são 73 linhas,
  // mas o número cresce à medida que a origem cria formatos).
  const [contagem, leituraDeAcoes, leituraDeFormatos] = await Promise.all([
    supabase.from('acoes_vendidas').select('*', { count: 'exact', head: true }),
    lerPaginado<{ programa: string; formato: string | null; importado_em: string }>((de, ate) =>
      supabase.from('acoes_vendidas').select('programa, formato, importado_em').range(de, ate),
    ),
    lerPaginado<{ formato: string; categoria: string }>((de, ate) =>
      supabase.from('formatos').select('formato, categoria').range(de, ate),
    ),
  ])

  if (leituraDeAcoes.erro) {
    console.error('Falha ao ler acoes_vendidas:', leituraDeAcoes.erro)
    return RESUMO_VAZIO
  }
  if (contagem.error) {
    console.error('Falha ao contar acoes_vendidas:', contagem.error.message)
  }
  if (leituraDeFormatos.erro) {
    console.error('Falha ao ler formatos:', leituraDeFormatos.erro)
  }

  const linhas = leituraDeAcoes.linhas
  const formatosCadastrados = leituraDeFormatos.linhas

  let importadoEm: string | null = null
  const contagemPorPrograma = new Map<string, number>()
  for (const linha of linhas) {
    if (importadoEm === null || linha.importado_em > importadoEm) {
      importadoEm = linha.importado_em
    }
    contagemPorPrograma.set(linha.programa, (contagemPorPrograma.get(linha.programa) ?? 0) + 1)
  }

  const porPrograma = [...contagemPorPrograma.entries()]
    .map(([programa, acoes]) => ({ programa, acoes }))
    .sort((a, b) => a.programa.localeCompare(b.programa, 'pt-BR'))

  const mapa = montarMapa(formatosCadastrados)
  const acoesParaChecarFormato = linhas.map((linha) => ({ formato: linha.formato ?? '' }))

  return {
    importadoEm,
    // A contagem exata é a fonte do total; as linhas paginadas servem de
    // reserva se a contagem falhar (as duas devem bater sempre).
    total: contagem.count ?? linhas.length,
    porPrograma,
    formatosNovos: formatosNovos(acoesParaChecarFormato, mapa),
  }
}
