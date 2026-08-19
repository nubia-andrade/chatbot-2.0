import { criarClienteServidor } from '../supabase/cliente-servidor'
import { lerPaginado } from './paginacao'

export type Restricao = {
  id: string
  anunciante: string | null
  setor: string | null
  industria: string | null
  segmentacao_se: string | null
  motivo: string
}

/** Quantas restrições um programa tem — alimenta o contador da aba. */
export async function contarRestricoes(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('restricoes_anunciante')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar restrições:', error.message)
    return 0
  }

  return count ?? 0
}

/** Todas as restrições cadastradas de um programa. */
export async function listarRestricoes(programaId: string): Promise<Restricao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .select('id, anunciante, setor, industria, segmentacao_se, motivo')
    .eq('programa_id', programaId)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Falha ao listar restrições:', error.message)
    return []
  }

  return data ?? []
}

export type ValoresDeRestricao = {
  setores: string[]
  industrias: string[]
  segmentacoesSe: string[]
}

/**
 * Valores reais da Carteira usados pelos selects de restrição. Nenhuma lista
 * fixa: Setor, Indústria e Segmentação SE vêm diretamente de `clientes`.
 */
export async function listarValoresDeRestricao(): Promise<ValoresDeRestricao> {
  const supabase = await criarClienteServidor()

  const { linhas, erro } = await lerPaginado<{
    setor: string | null
    industria: string | null
    segmentacao_se: string | null
  }>(
    (de, ate) => supabase.from('clientes').select('setor, industria, segmentacao_se').range(de, ate),
  )

  if (erro) {
    console.error('Falha ao listar classificações da carteira:', erro)
    return { setores: [], industrias: [], segmentacoesSe: [] }
  }

  const paraLista = (valores: (string | null)[]) =>
    [...new Set(valores.filter((valor): valor is string => Boolean(valor && valor.trim() !== '')))]
      .map((valor) => valor.trim())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return {
    setores: paraLista(linhas.map((linha) => linha.setor)),
    industrias: paraLista(linhas.map((linha) => linha.industria)),
    segmentacoesSe: paraLista(linhas.map((linha) => linha.segmentacao_se)),
  }
}

/** Compatibilidade temporária para imports antigos da página. */
export const listarValoresDeCategoria = listarValoresDeRestricao
