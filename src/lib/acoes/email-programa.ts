'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeEditarPrograma } from '../dominio/perfis'

const ARQUIVO_SCHEMA = 'supabase/schema-entrega-4-fechamento-propostas.sql'

export async function salvarConfiguracaoEmailPrograma(params: {
  programaId: string
  ativo: boolean
  responsaveis: string[]
}): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, params.programaId)) {
    return { erro: 'Você não pode configurar o e-mail deste programa.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('salvar_email_programa', {
    p_programa_id: params.programaId,
    p_ativo: params.ativo,
    p_responsaveis: [...new Set(params.responsaveis)],
  })

  if (error) {
    const texto = error.message.toLowerCase()
    if (texto.includes('salvar_email_programa') || texto.includes('programa_email_config') || texto.includes('could not find')) {
      return { erro: `O banco ainda não possui a configuração de e-mail. Execute ${ARQUIVO_SCHEMA} no Supabase e tente novamente.` }
    }
    console.error('Falha ao salvar configuração de e-mail:', error.message)
    return { erro: error.message || 'Não foi possível salvar a configuração de e-mail.' }
  }

  revalidatePath(`/configuracoes/programas/${params.programaId}/email`)
  return { erro: null }
}
