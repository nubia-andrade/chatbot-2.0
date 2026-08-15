import { criarClienteServidor } from '../supabase/cliente-servidor'
import { formatosNovos, type AcaoImportada } from '../dominio/ingestao'
import { montarMapa } from '../dominio/formatos'

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

  const [{ data: acoes, error: erroAcoes }, { data: formatosCadastrados, error: erroFormatos }] =
    await Promise.all([
      supabase.from('acoes_vendidas').select('programa, formato, importado_em'),
      supabase.from('formatos').select('formato, categoria'),
    ])

  if (erroAcoes) {
    console.error('Falha ao ler acoes_vendidas:', erroAcoes.message)
    return RESUMO_VAZIO
  }
  if (erroFormatos) {
    console.error('Falha ao ler formatos:', erroFormatos.message)
  }

  const linhas = acoes ?? []

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

  const mapa = montarMapa(formatosCadastrados ?? [])
  const acoesParaChecarFormato: AcaoImportada[] = linhas.map((linha) => ({
    numero_da_entrega: '',
    programa: linha.programa,
    data_de_exibicao: '',
    anunciante: '',
    marca: '',
    formato: linha.formato ?? '',
    tipo_da_entrega: '',
    status_aprovacao: '',
  }))

  return {
    importadoEm,
    total: linhas.length,
    porPrograma,
    formatosNovos: formatosNovos(acoesParaChecarFormato, mapa),
  }
}
