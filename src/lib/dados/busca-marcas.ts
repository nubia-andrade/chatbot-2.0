'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'

export type MarcaDaCarteira = {
  marca_id: string
  marca_nome: string
  cliente_id: string
  cliente_nome: string
  cnpj: string | null
  setor: string | null
  industria: string | null
  apto_regional: boolean
}

type LinhaDaBuscaDeMarca = Omit<MarcaDaCarteira, 'apto_regional'> & {
  apto_regional: boolean | null
}

const LIMITE_PADRAO = 20

/**
 * Busca pela marca que o executivo conhece, mas devolve também o anunciante
 * oficial da carteira e a classificação usada pelas regras comerciais.
 *
 * `buscar_marcas` vive no Supabase porque a relação passa por três entidades:
 * marca -> alias do anunciante no Globo Take -> cliente da carteira. A função
 * só devolve aliases já resolvidos; pendências de casamento nunca aparecem
 * como opção de venda até serem associadas com segurança.
 */
export async function buscarMarcas(
  termo: string,
  limite: number = LIMITE_PADRAO,
): Promise<MarcaDaCarteira[]> {
  const termoLimpo = termo.trim()
  if (termoLimpo === '') return []

  const supabase = criarClienteNavegador()
  const { data, error } = await supabase.rpc('buscar_marcas', {
    termo_busca: termoLimpo,
    limite_busca: limite,
  })

  if (error) {
    console.error('Falha ao buscar marcas:', error.message)
    return []
  }

  return ((data ?? []) as LinhaDaBuscaDeMarca[]).map((linha) => ({
    ...linha,
    apto_regional: Boolean(linha.apto_regional),
  }))
}
