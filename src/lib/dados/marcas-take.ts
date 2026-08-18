import { criarClienteServidor } from '../supabase/cliente-servidor'

export type AnuncianteTakePendente = {
  id: string
  nome: string
  marcas: string[]
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
