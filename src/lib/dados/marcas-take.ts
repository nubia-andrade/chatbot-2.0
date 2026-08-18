import { criarClienteServidor } from '../supabase/cliente-servidor'

export type AnuncianteTakePendente = {
  id: string
  nome: string
  marcas: string[]
}

export type RelacionamentoMarcaTake = {
  anunciante_take_id: string
  anunciante_take_nome: string
  status_alias: 'pendente' | 'automatico' | 'confirmado'
  marca_id: string
  marca_nome: string
  cliente_padrao_id: string | null
  cliente_padrao_nome: string | null
  cliente_override_id: string | null
  cliente_override_nome: string | null
  cliente_efetivo_id: string | null
  cliente_efetivo_nome: string | null
  ultimo_visto_em: string
}

/**
 * Aliases do Globo Take que ainda não encontraram um único cliente da
 * carteira pelo nome normalizado. Só esses precisam de intervenção humana.
 */
export async function listarAnunciantesTakePendentes(): Promise<AnuncianteTakePendente[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('anunciantes_take')
    .select('id, nome, anunciante_take_marcas(marca:marcas(nome))')
    .is('cliente_id', null)
    .order('nome', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Falha ao listar anunciantes pendentes do Take:', error.message)
    return []
  }

  return (data ?? []).map((linha) => {
    const relacoes = (linha.anunciante_take_marcas ?? []) as unknown as Array<{
      marca: { nome: string } | null
    }>
    return {
      id: linha.id,
      nome: linha.nome,
      marcas: relacoes
        .map((relacao) => relacao.marca?.nome)
        .filter((nome): nome is string => Boolean(nome))
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }
  })
}

/**
 * Relações Marca → Anunciante do Take → Cliente da carteira para manutenção.
 * A função SQL usa o override da relação quando existe, sem alterar o alias
 * inteiro e sem afetar outras marcas do mesmo anunciante do Take.
 */
export async function buscarRelacionamentosMarcas(
  termo: string,
  limite: number = 100,
): Promise<RelacionamentoMarcaTake[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('buscar_relacionamentos_marcas', {
    termo_busca: termo.trim(),
    limite_busca: limite,
  })

  if (error) {
    console.error('Falha ao buscar relacionamentos de marcas:', error.message)
    return []
  }

  return (data ?? []) as RelacionamentoMarcaTake[]
}
