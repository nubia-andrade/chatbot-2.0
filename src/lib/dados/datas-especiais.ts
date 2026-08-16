import { criarClienteServidor } from '../supabase/cliente-servidor'

export type PeriodoEspecial = {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  percentual_acrescimo: number
  texto_investimento: string | null
}

/**
 * Quantos períodos especiais um programa tem — alimenta o contador da aba
 * "Datas especiais" em `AbasDoPrograma` ("Datas especiais · 2").
 */
export async function contarDatasEspeciais(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('datas_especiais')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar datas especiais:', error.message)
    return 0
  }

  return count ?? 0
}

/**
 * Todos os períodos especiais de um programa, mais recentes primeiro pela
 * data de início. Sem paginação: um programa não acumula centenas de
 * períodos especiais — bem abaixo das 1000 linhas do PostgREST.
 */
export async function listarDatasEspeciais(programaId: string): Promise<PeriodoEspecial[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('datas_especiais')
    .select('id, nome, data_inicio, data_fim, percentual_acrescimo, texto_investimento')
    .eq('programa_id', programaId)
    .order('data_inicio', { ascending: false })

  if (error) {
    console.error('Falha ao listar datas especiais:', error.message)
    return []
  }

  return data ?? []
}
