import { criarClienteServidor } from '../supabase/cliente-servidor'

/**
 * Programas a que um consultor está vinculado — a lista que
 * `podeEditarPrograma` (Task 2) usa para decidir se ele edita um programa
 * específico. Proprietário não precisa de vínculo: já enxerga tudo.
 */
export async function listarProgramasVinculados(usuarioId: string): Promise<string[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('consultor_programa')
    .select('programa_id')
    .eq('usuario_id', usuarioId)

  if (error) {
    console.error('Falha ao listar vínculos de consultor:', error.message)
    return []
  }

  return (data ?? []).map((linha) => linha.programa_id as string)
}
