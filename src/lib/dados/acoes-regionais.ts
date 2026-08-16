import { criarClienteServidor } from '../supabase/cliente-servidor'

export type AcaoRegionalCadastrada = {
  id: string
  data_de_exibicao: string
  cliente_nome: string
  praca_codigo: string
  origem: 'manual' | 'sugerido_api'
}

/**
 * Quantas ações regionais um programa já vendeu — alimenta o contador da aba
 * "Regional" em `AbasDoPrograma`.
 */
export async function contarAcoesRegionais(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('acoes_regionais')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar ações regionais:', error.message)
    return 0
  }

  return count ?? 0
}

/** Todas as ações regionais já vendidas de um programa, mais recentes primeiro. */
export async function listarAcoesRegionais(programaId: string): Promise<AcaoRegionalCadastrada[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('acoes_regionais')
    .select('id, data_de_exibicao, cliente_nome, praca_codigo, origem')
    .eq('programa_id', programaId)
    .order('data_de_exibicao', { ascending: false })

  if (error) {
    console.error('Falha ao listar ações regionais:', error.message)
    return []
  }

  return data ?? []
}
