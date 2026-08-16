import { criarClienteServidor } from '../supabase/cliente-servidor'

export type DataBloqueada = {
  id: string
  data: string
  motivo: string
}

/**
 * Quantas datas bloqueadas um programa tem — alimenta o contador da aba
 * "Datas bloqueadas" em `AbasDoPrograma` ("Datas bloqueadas · 3").
 */
export async function contarDatasBloqueadas(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('datas_bloqueadas')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar datas bloqueadas:', error.message)
    return 0
  }

  return count ?? 0
}

/** Todas as datas bloqueadas de um programa, mais recentes primeiro. */
export async function listarDatasBloqueadas(programaId: string): Promise<DataBloqueada[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('datas_bloqueadas')
    .select('id, data, motivo')
    .eq('programa_id', programaId)
    .order('data', { ascending: false })

  if (error) {
    console.error('Falha ao listar datas bloqueadas:', error.message)
    return []
  }

  return data ?? []
}
