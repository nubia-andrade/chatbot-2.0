import { criarClienteServidor } from '../supabase/cliente-servidor'

/**
 * Quantas ações regionais um programa já vendeu — alimenta o contador da aba
 * "Regional" em `AbasDoPrograma`.
 *
 * A listagem em si (com intervalo de datas, para a matriz e o formulário de
 * venda) é `listarAcoesRegionais` em `src/lib/dados/regional.ts` (Task 12) —
 * este arquivo ficou só com a contagem, mais barata para um cabeçalho que
 * não precisa das linhas.
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
