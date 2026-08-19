'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAdministrarGovernancaGlobal } from '../dominio/perfis'
import { normalizarCnpj, separarCnpjsColados } from '../dominio/elegibilidade-regional'
import { lerPaginado } from '../dados/paginacao'
import { listarClientesElegiveis, type ClienteElegivel } from '../dados/clientes-regionais'

const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
const ERRO_SEM_PERMISSAO = 'Somente Proprietário pode alterar a elegibilidade regional global.'
const CAMINHO_DA_TELA = '/configuracoes/clientes-regionais'

function autorizado(perfis: Parameters<typeof podeAdministrarGovernancaGlobal>[0]) {
  return podeAdministrarGovernancaGlobal(perfis)
}

export async function adicionarClienteElegivel(clienteId: string): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!autorizado(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO }
  if (!clienteId) return { erro: 'Escolha um cliente da carteira.' }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase.from('clientes').update({ apto_regional: true }, { count: 'exact' }).eq('id', clienteId)
  if (error) return { erro: 'Não foi possível gravar a elegibilidade. Tente novamente.' }
  if (!count) return { erro: 'O banco não deixou gravar. Confira sua permissão.' }
  revalidatePath(CAMINHO_DA_TELA)
  return { erro: null }
}

export async function removerClienteElegivel(clienteId: string): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!autorizado(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO }
  if (!clienteId) return { erro: 'Cliente inválido.' }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase.from('clientes').update({ apto_regional: false }, { count: 'exact' }).eq('id', clienteId)
  if (error) return { erro: 'Não foi possível remover a elegibilidade. Tente novamente.' }
  if (!count) return { erro: 'O banco não deixou gravar. Confira sua permissão.' }
  revalidatePath(CAMINHO_DA_TELA)
  return { erro: null }
}

export async function buscarPaginaDeElegiveis(
  pagina: number,
  busca: string,
): Promise<{ clientes: ClienteElegivel[]; total: number; erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { clientes: [], total: 0, erro: ERRO_SESSAO_EXPIRADA }
  if (!autorizado(sessao.perfis)) return { clientes: [], total: 0, erro: ERRO_SEM_PERMISSAO }
  return listarClientesElegiveis(pagina, busca)
}

export type CandidatoEncontrado = {
  id: string
  nome: string
  cnpj: string | null
  jaElegivel: boolean
}

export type ResultadoDaBusca = {
  encontrados: CandidatoEncontrado[]
  naoEncontrados: string[]
  erro: string | null
}

export async function pesquisarClientesPorCnpj(textoColado: string): Promise<ResultadoDaBusca> {
  const sessao = await obterSessao()
  if (!sessao) return { encontrados: [], naoEncontrados: [], erro: ERRO_SESSAO_EXPIRADA }
  if (!autorizado(sessao.perfis)) return { encontrados: [], naoEncontrados: [], erro: ERRO_SEM_PERMISSAO }

  const cnpjsColados = separarCnpjsColados(textoColado)
  if (cnpjsColados.length === 0) return { encontrados: [], naoEncontrados: [], erro: 'Cole ao menos um CNPJ, um por linha.' }

  const supabase = await criarClienteServidor()
  const { linhas, erro } = await lerPaginado<{
    id: string
    nome: string
    cnpj: string | null
    apto_regional: boolean
  }>((de, ate) => supabase.from('clientes').select('id, nome, cnpj, apto_regional').range(de, ate))

  if (erro) return { encontrados: [], naoEncontrados: [], erro: 'Não foi possível consultar a carteira. Tente novamente.' }

  const porCnpjNormalizado = new Map(
    linhas.filter((cliente) => normalizarCnpj(cliente.cnpj) !== '').map((cliente) => [normalizarCnpj(cliente.cnpj), cliente]),
  )

  const encontrados: CandidatoEncontrado[] = []
  const naoEncontrados: string[] = []
  const jaVistos = new Set<string>()

  for (const textoOriginal of cnpjsColados) {
    const chave = normalizarCnpj(textoOriginal)
    const cliente = chave !== '' ? porCnpjNormalizado.get(chave) : undefined
    if (!cliente) {
      naoEncontrados.push(textoOriginal)
      continue
    }
    if (jaVistos.has(cliente.id)) continue
    jaVistos.add(cliente.id)
    encontrados.push({ id: cliente.id, nome: cliente.nome, cnpj: cliente.cnpj, jaElegivel: cliente.apto_regional })
  }

  return { encontrados, naoEncontrados, erro: null }
}

export async function adicionarClientesElegiveisEmMassa(
  clienteIds: string[],
): Promise<{ erro: string | null; quantidade: number }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA, quantidade: 0 }
  if (!autorizado(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO, quantidade: 0 }

  const idsUnicos = [...new Set(clienteIds.filter((id) => id))]
  if (idsUnicos.length === 0) return { erro: 'Nenhum cliente para adicionar.', quantidade: 0 }

  const supabase = await criarClienteServidor()
  const { error, count } = await supabase.from('clientes').update({ apto_regional: true }, { count: 'exact' }).in('id', idsUnicos)
  if (error) return { erro: 'Não foi possível gravar a elegibilidade em massa. Tente novamente.', quantidade: 0 }
  if (!count) return { erro: 'O banco não deixou gravar. Confira sua permissão.', quantidade: 0 }

  revalidatePath(CAMINHO_DA_TELA)
  return { erro: null, quantidade: count }
}
