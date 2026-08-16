import { criarClienteServidor } from '../supabase/cliente-servidor'

export type Restricao = {
  id: string
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

/**
 * Quantas restrições de anunciante um programa tem — alimenta o contador da
 * aba "Restrições" em `AbasDoPrograma`.
 */
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

/** Todas as restrições de anunciante de um programa. */
export async function listarRestricoes(programaId: string): Promise<Restricao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .select('id, anunciante, setor, industria, motivo')
    .eq('programa_id', programaId)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Falha ao listar restrições:', error.message)
    return []
  }

  return data ?? []
}
