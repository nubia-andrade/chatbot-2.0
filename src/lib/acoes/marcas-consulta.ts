'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'

const SCHEMA = 'supabase/schema-entrega-5-governanca-marcas-executivo.sql'

type LinhaCriada = {
  marca_id: string
  marca_nome: string
}

export type ResultadoCadastroMarcaConsulta = {
  marcaId: string | null
  marcaNome: string | null
  erro: string | null
}

export async function cadastrarMarcaNaConsulta(
  nomeMarca: string,
  clienteId: string,
): Promise<ResultadoCadastroMarcaConsulta> {
  const sessao = await obterSessao()
  if (!sessao) return { marcaId: null, marcaNome: null, erro: 'Sua sessão expirou. Entre de novo.' }

  const nome = nomeMarca.trim()
  if (!nome) return { marcaId: null, marcaNome: null, erro: 'Informe somente o nome da marca.' }
  if (nome.length > 120) return { marcaId: null, marcaNome: null, erro: 'O nome da marca deve ter no máximo 120 caracteres.' }
  if (!clienteId) return { marcaId: null, marcaNome: null, erro: 'Escolha o anunciante antes de cadastrar a marca.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('cadastrar_marca_da_carteira', {
    p_nome_marca: nome,
    p_cliente_id: clienteId,
  })

  if (error) {
    const texto = error.message.toLowerCase()
    if (texto.includes('cadastrar_marca_da_carteira') || texto.includes('could not find')) {
      return {
        marcaId: null,
        marcaNome: null,
        erro: `O banco ainda não possui o cadastro de marca pela consulta. Execute ${SCHEMA} no Supabase e tente novamente.`,
      }
    }
    return { marcaId: null, marcaNome: null, erro: error.message || 'Não foi possível cadastrar a marca.' }
  }

  const linha = Array.isArray(data) ? data[0] as LinhaCriada | undefined : data as LinhaCriada | null
  if (!linha?.marca_id || !linha.marca_nome) {
    return { marcaId: null, marcaNome: null, erro: 'A marca foi processada, mas o banco não retornou sua identificação.' }
  }

  revalidatePath('/consulta')
  revalidatePath('/configuracoes/marcas')

  return { marcaId: linha.marca_id, marcaNome: linha.marca_nome, erro: null }
}
