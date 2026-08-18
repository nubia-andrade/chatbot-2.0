'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAdministrarProgramas } from '../dominio/perfis'

const CAMINHO = '/configuracoes/marcas'

/**
 * Confirma manualmente qual cliente da carteira corresponde a um nome de
 * anunciante vindo do Globo Take. Depois disso todas as marcas observadas
 * sob esse alias passam imediatamente a aparecer na busca da Nova Consulta.
 */
export async function confirmarAnuncianteTake(
  anuncianteTakeId: string,
  clienteId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) {
    return { erro: 'Você não tem permissão para relacionar anunciantes do Globo Take.' }
  }
  if (!anuncianteTakeId || !clienteId) return { erro: 'Escolha um cliente da carteira.' }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase
    .from('anunciantes_take')
    .update({ cliente_id: clienteId, status: 'confirmado' }, { count: 'exact' })
    .eq('id', anuncianteTakeId)

  if (error) return { erro: 'Não foi possível salvar o relacionamento. Tente novamente.' }
  if (!count) return { erro: 'O banco não deixou gravar. Confira sua permissão.' }

  revalidatePath(CAMINHO)
  revalidatePath('/consulta')
  return { erro: null }
}
