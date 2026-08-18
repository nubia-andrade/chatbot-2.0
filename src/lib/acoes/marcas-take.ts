'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAdministrarProgramas } from '../dominio/perfis'
import { buscarRelacionamentosMarcas, type RelacionamentoMarcaTake } from '../dados/marcas-take'

const CAMINHO = '/configuracoes/marcas'
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para alterar relacionamentos de marcas e anunciantes.'

function revalidarRelacionamentos() {
  revalidatePath(CAMINHO)
  revalidatePath('/consulta')
}

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
  if (!podeAdministrarProgramas(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO }
  if (!anuncianteTakeId || !clienteId) return { erro: 'Escolha um cliente da carteira.' }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase
    .from('anunciantes_take')
    .update({ cliente_id: clienteId, status: 'confirmado' }, { count: 'exact' })
    .eq('id', anuncianteTakeId)

  if (error) return { erro: 'Não foi possível salvar o relacionamento. Tente novamente.' }
  if (!count) return { erro: 'O banco não deixou gravar. Confira sua permissão.' }

  revalidarRelacionamentos()
  return { erro: null }
}

/** Busca administrativa usada pela seção de manutenção. */
export async function pesquisarRelacionamentosMarcas(
  termo: string,
): Promise<{ relacionamentos: RelacionamentoMarcaTake[]; erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { relacionamentos: [], erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) {
    return { relacionamentos: [], erro: ERRO_SEM_PERMISSAO }
  }

  return { relacionamentos: await buscarRelacionamentosMarcas(termo, 100), erro: null }
}

/**
 * Corrige só ESTA relação Marca + anunciante do Take. Não altera o cliente
 * padrão do alias e, portanto, não desloca outras marcas do mesmo anunciante.
 */
export async function corrigirRelacionamentoMarca(
  anuncianteTakeId: string,
  marcaId: string,
  clienteId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO }
  if (!anuncianteTakeId || !marcaId || !clienteId) {
    return { erro: 'Escolha o anunciante correto da carteira.' }
  }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase
    .from('anunciante_take_marcas')
    .update(
      {
        cliente_id_override: clienteId,
        corrigido_em: new Date().toISOString(),
        corrigido_por: sessao.usuarioId,
      },
      { count: 'exact' },
    )
    .eq('anunciante_take_id', anuncianteTakeId)
    .eq('marca_id', marcaId)

  if (error) return { erro: 'Não foi possível salvar a correção. Tente novamente.' }
  if (!count) return { erro: 'O relacionamento informado não foi encontrado.' }

  revalidarRelacionamentos()
  return { erro: null }
}

/** Remove a exceção e volta a usar o cliente padrão do alias do Globo Take. */
export async function removerCorrecaoRelacionamentoMarca(
  anuncianteTakeId: string,
  marcaId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase
    .from('anunciante_take_marcas')
    .update(
      { cliente_id_override: null, corrigido_em: null, corrigido_por: null },
      { count: 'exact' },
    )
    .eq('anunciante_take_id', anuncianteTakeId)
    .eq('marca_id', marcaId)

  if (error) return { erro: 'Não foi possível remover a correção. Tente novamente.' }
  if (!count) return { erro: 'O relacionamento informado não foi encontrado.' }

  revalidarRelacionamentos()
  return { erro: null }
}
