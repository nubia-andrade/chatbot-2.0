'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'

export type MarcaDaCarteira = {
  /** Nulos quando o executivo escolhe diretamente um cliente sem marca conhecida no Take. */
  marca_id: string | null
  marca_nome: string | null
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
 * Busca o alvo comercial da consulta por CLIENTE/ANUNCIANTE ou MARCA.
 *
 * O RPC `buscar_marcas` também aplica a carteira do executivo logado. Para
 * proprietário/consultor, a função libera a carteira completa. Termo vazio é
 * válido: permite abrir o campo e enxergar imediatamente clientes da carteira.
 *
 * Clientes que ainda não possuem marca aprendida no Globo Take continuam
 * selecionáveis, com `marca_id` e `marca_nome` nulos.
 */
export async function buscarMarcas(
  termo: string,
  limite: number = LIMITE_PADRAO,
): Promise<MarcaDaCarteira[]> {
  const supabase = criarClienteNavegador()
  const { data, error } = await supabase.rpc('buscar_marcas', {
    termo_busca: termo.trim(),
    limite_busca: limite,
  })

  if (error) {
    console.error('Falha ao buscar clientes e marcas:', error.message)
    return []
  }

  return ((data ?? []) as LinhaDaBuscaDeMarca[]).map((linha) => ({
    ...linha,
    apto_regional: Boolean(linha.apto_regional),
  }))
}
