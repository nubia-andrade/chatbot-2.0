import { criarClienteServidor } from '../supabase/cliente-servidor'

export type SlideDoModeloDeProposta = {
  id: string
  programa_id: string
  imagem_url: string
  ordem: number
  criado_em: string
  atualizado_em: string
}

export async function listarSlidesDoModelo(programaId: string): Promise<SlideDoModeloDeProposta[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('programa_modelo_slides')
    .select('id, programa_id, imagem_url, ordem, criado_em, atualizado_em')
    .eq('programa_id', programaId)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })

  if (error) {
    console.error('Falha ao listar slides do modelo de proposta:', error.message)
    return []
  }

  return (data ?? []) as SlideDoModeloDeProposta[]
}
