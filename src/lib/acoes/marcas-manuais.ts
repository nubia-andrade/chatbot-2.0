'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAdministrarProgramas } from '../dominio/perfis'

const CAMINHO = '/configuracoes/marcas'
const ARQUIVO_SCHEMA = 'supabase/schema-entrega-4-fechamento-propostas.sql'

function revalidar() {
  revalidatePath(CAMINHO)
  revalidatePath('/consulta')
}

function mensagemDeSchema(mensagem: string | undefined): string | null {
  const texto = mensagem?.toLowerCase() ?? ''
  if (texto.includes('vincular_marca_manual') || texto.includes('marca_cliente_manual')) {
    return `O banco ainda não possui o cadastro manual de marcas. Execute ${ARQUIVO_SCHEMA} no Supabase e tente novamente.`
  }
  return null
}

export async function vincularMarcaManual(
  nomeMarca: string,
  clienteId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) return { erro: 'Você não tem permissão para vincular marcas.' }

  const nome = nomeMarca.trim()
  if (!nome) return { erro: 'Informe o nome da marca.' }
  if (!clienteId) return { erro: 'Escolha o anunciante oficial da carteira.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('vincular_marca_manual', {
    p_nome_marca: nome,
    p_cliente_id: clienteId,
  })

  if (error) {
    const schema = mensagemDeSchema(error.message)
    if (schema) return { erro: schema }
    console.error('Falha ao vincular marca manual:', error.message)
    return { erro: error.message || 'Não foi possível vincular a marca.' }
  }

  revalidar()
  return { erro: null }
}

export async function removerVinculoMarcaManual(
  marcaId: string,
  clienteId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!podeAdministrarProgramas(sessao.perfis)) return { erro: 'Você não tem permissão para remover vínculos de marcas.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('remover_vinculo_marca_manual', {
    p_marca_id: marcaId,
    p_cliente_id: clienteId,
  })

  if (error) {
    const schema = mensagemDeSchema(error.message)
    if (schema) return { erro: schema }
    console.error('Falha ao remover vínculo manual de marca:', error.message)
    return { erro: 'Não foi possível remover o vínculo.' }
  }

  revalidar()
  return { erro: null }
}
