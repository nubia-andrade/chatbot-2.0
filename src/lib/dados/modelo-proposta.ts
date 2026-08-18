import { criarClienteServidor } from '../supabase/cliente-servidor'
import {
  ordenarSlidesDoModelo,
  type SlideDoModeloDeProposta,
} from '../dominio/modelo-proposta'

export type { SecaoDoModeloDeProposta, SlideDoModeloDeProposta } from '../dominio/modelo-proposta'

export async function listarSlidesDoModelo(programaId: string): Promise<SlideDoModeloDeProposta[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('programa_modelo_slides')
    .select('id, programa_id, imagem_url, secao, ordem, criado_em, atualizado_em')
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao listar slides do modelo de proposta:', error.message)
    return []
  }

  return ordenarSlidesDoModelo((data ?? []) as SlideDoModeloDeProposta[])
}
