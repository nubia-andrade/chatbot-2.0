'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'

/** Um cliente da carteira, com as classificações usadas nas regras comerciais. */
export type Cliente = {
  id: string
  nome: string
  cnpj: string | null
  setor: string | null
  industria: string | null
  /** Campo próprio da Carteira. Opcional para compatibilidade com estados antigos da sessão. */
  segmentacao_se?: string | null
  apto_regional: boolean
}

const LIMITE_PADRAO = 20

function escaparCoringasLike(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Busca clientes da carteira por nome para o campo de seleção. */
export async function buscarClientes(
  termo: string,
  limite: number = LIMITE_PADRAO,
): Promise<Cliente[]> {
  const termoLimpo = termo.trim()
  if (termoLimpo === '') return []

  const supabase = criarClienteNavegador()

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, cnpj, setor, industria, segmentacao_se, apto_regional')
    .ilike('nome', `%${escaparCoringasLike(termoLimpo)}%`)
    .order('nome', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('Falha ao buscar clientes:', error.message)
    return []
  }

  return (data ?? []).map((cliente) => ({
    ...cliente,
    apto_regional: Boolean(cliente.apto_regional),
  })) as Cliente[]
}
