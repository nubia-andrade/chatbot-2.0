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

/** Busca textual por cliente/anunciante ou marca dentro da carteira permitida. */
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

  return ((data ?? []) as LinhaDaBuscaDeMarca[]).map(normalizarLinha)
}

/**
 * Depois que o CLIENTE é escolhido, a etapa seguinte não deve depender do
 * texto do nome do anunciante. Esta leitura retorna todas as marcas ligadas
 * ao cliente por Take ou por governança manual, mesmo que os nomes sejam
 * completamente diferentes entre si.
 */
export async function listarMarcasDoCliente(clienteId: string): Promise<MarcaDaCarteira[]> {
  const supabase = criarClienteNavegador()
  const { data, error } = await supabase.rpc('marcas_do_cliente', {
    p_cliente_id: clienteId,
  })

  if (error) {
    console.error('Falha ao listar marcas do cliente:', error.message)
    return []
  }

  return ((data ?? []) as LinhaDaBuscaDeMarca[]).map(normalizarLinha)
}

function normalizarLinha(linha: LinhaDaBuscaDeMarca): MarcaDaCarteira {
  return {
    ...linha,
    apto_regional: Boolean(linha.apto_regional),
  }
}
