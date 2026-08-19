'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'
import type { StatusNegociacao } from '../dados/propostas'
import type { Cliente } from '../dados/busca-clientes'
import type { ItemDaConsulta } from '../dominio/consulta'
import { gerarProposta, type EntradaGerarProposta, type ResultadoGerarProposta } from './propostas'

const SCHEMA_ACOMPANHAMENTO = 'supabase/schema-entrega-5-acompanhamento-performance.sql'

export type EntradaAtualizarNegociacao = {
  propostaId: string
  status: Exclude<StatusNegociacao, 'substituida'>
  valorFinalNegociado?: number | null
  dataFechamento?: string | null
  observacao?: string | null
  motivoPerda?: string | null
}

export async function atualizarNegociacao(entrada: EntradaAtualizarNegociacao): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('atualizar_negociacao_proposta', {
    p_proposta_id: entrada.propostaId,
    p_status: entrada.status,
    p_valor_final: entrada.valorFinalNegociado ?? null,
    p_data_fechamento: entrada.dataFechamento || null,
    p_observacao: entrada.observacao || null,
    p_motivo_perda: entrada.motivoPerda || null,
  })

  if (error) {
    const texto = error.message.toLowerCase()
    if (texto.includes('atualizar_negociacao_proposta') || texto.includes('could not find')) return { erro: `Execute ${SCHEMA_ACOMPANHAMENTO} no Supabase para habilitar o acompanhamento comercial.` }
    return { erro: error.message || 'Não foi possível atualizar a negociação.' }
  }

  revalidatePath('/propostas')
  revalidatePath('/inicio')
  return { erro: null }
}

export type DadosParaNovaVersao = {
  marcaId: string | null
  marcaNome: string | null
  cliente: Cliente
  programaId: string
  programaNome: string
  produto: string
  objetivo: string
  modalidade: 'nacional' | 'regional'
  itens: ItemDaConsulta[]
  incluirDigital: boolean
  incluirRedesSociais: boolean
  propostaAnteriorId: string
}

export async function prepararNovaVersao(propostaId: string): Promise<{ dados: DadosParaNovaVersao | null; erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { dados: null, erro: 'Sua sessão expirou. Entre de novo.' }

  const supabase = await criarClienteServidor()
  const { data: proposta, error: erroProposta } = await supabase
    .from('propostas')
    .select('id, usuario_id, consulta_id, marca_id, marca_nome, cliente_id, cliente_nome, programa_id, programa_nome, produto, objetivo, modalidade, inclui_digital, inclui_redes_sociais, grupo_versao_id, versao, negociacao_status')
    .eq('id', propostaId)
    .maybeSingle()

  if (erroProposta) {
    const texto = erroProposta.message.toLowerCase()
    if (texto.includes('grupo_versao_id') || texto.includes('negociacao_status') || texto.includes('could not find')) return { dados: null, erro: `Execute ${SCHEMA_ACOMPANHAMENTO} no Supabase para habilitar novas versões.` }
    return { dados: null, erro: 'Não foi possível carregar a proposta.' }
  }
  if (!proposta) return { dados: null, erro: 'Proposta não encontrada.' }

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  if (proposta.usuario_id !== sessao.usuarioId && !proprietario) return { dados: null, erro: 'Somente o executivo que gerou a proposta ou o Proprietário pode criar uma nova versão.' }

  const { data: maisNova } = await supabase.from('propostas').select('id, versao').eq('grupo_versao_id', proposta.grupo_versao_id).gt('versao', proposta.versao).order('versao', { ascending: false }).limit(1).maybeSingle()
  if (maisNova) return { dados: null, erro: `Esta proposta já possui uma versão mais recente (v${maisNova.versao}). Crie a próxima versão a partir dela.` }

  if (!proposta.cliente_id || !proposta.programa_id || !proposta.consulta_id) return { dados: null, erro: 'A proposta não possui todos os vínculos necessários para criar uma nova versão.' }

  const [{ data: cliente, error: erroCliente }, { data: itens, error: erroItens }] = await Promise.all([
    supabase.from('clientes').select('id, nome, cnpj, setor, industria, apto_regional').eq('id', proposta.cliente_id).maybeSingle(),
    supabase.from('consulta_itens').select('data, quantidade, pracas').eq('consulta_id', proposta.consulta_id).order('data', { ascending: true }),
  ])

  if (erroCliente || !cliente) return { dados: null, erro: 'Não foi possível carregar o anunciante da proposta.' }
  if (erroItens) return { dados: null, erro: 'Não foi possível carregar as datas da proposta.' }

  return {
    erro: null,
    dados: {
      marcaId: proposta.marca_id,
      marcaNome: proposta.marca_nome,
      cliente: { id: cliente.id, nome: cliente.nome, cnpj: cliente.cnpj, setor: cliente.setor, industria: cliente.industria, apto_regional: Boolean(cliente.apto_regional) },
      programaId: proposta.programa_id,
      programaNome: proposta.programa_nome,
      produto: proposta.produto ?? '',
      objetivo: proposta.objetivo ?? '',
      modalidade: proposta.modalidade as 'nacional' | 'regional',
      itens: (itens ?? []).map((item) => ({ data: item.data, quantidade: Number(item.quantidade), pracas: item.pracas ?? [] })) as ItemDaConsulta[],
      incluirDigital: Boolean(proposta.inclui_digital),
      incluirRedesSociais: Boolean(proposta.inclui_redes_sociais),
      propostaAnteriorId: proposta.id,
    },
  }
}

export async function gerarPropostaAcompanhada(entrada: EntradaGerarProposta & { propostaAnteriorId?: string | null }): Promise<ResultadoGerarProposta> {
  const propostaAnteriorId = entrada.propostaAnteriorId ?? null
  const { propostaAnteriorId: _ignorar, ...entradaBase } = entrada
  if (!propostaAnteriorId) return gerarProposta(entradaBase)

  const preparacao = await prepararNovaVersao(propostaAnteriorId)
  if (!preparacao.dados) return falha(preparacao.erro ?? 'Não foi possível preparar a nova versão.')

  if (preparacao.dados.cliente.id !== entrada.clienteId || preparacao.dados.programaId !== entrada.programaId) {
    return falha('Uma nova versão deve manter o mesmo anunciante e programa. Para outro anunciante ou programa, inicie uma nova consulta.')
  }

  const resultado = await gerarProposta(entradaBase)
  if (!resultado.pdfGerado || !resultado.propostaId) return resultado

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('vincular_nova_versao', { p_proposta_anterior_id: propostaAnteriorId, p_nova_proposta_id: resultado.propostaId })
  if (error) {
    const texto = error.message.toLowerCase()
    const mensagem = texto.includes('vincular_nova_versao') || texto.includes('could not find') ? `O PDF foi gerado, mas o banco ainda não possui o versionamento. Execute ${SCHEMA_ACOMPANHAMENTO}.` : `O PDF foi gerado, mas não foi possível vinculá-lo como nova versão: ${error.message}`
    return { ...resultado, erro: mensagem }
  }

  revalidatePath('/propostas')
  revalidatePath('/inicio')
  return resultado
}

function falha(erro: string): ResultadoGerarProposta {
  return {
    propostaId: null,
    consultaId: null,
    pdfGerado: false,
    pdfUrl: null,
    emailAtivo: false,
    emailEnviado: false,
    emailConfigurado: false,
    destinatarios: [],
    aprovacaoStatus: 'nao_requerida',
    aprovacaoErro: null,
    erro,
    emailErro: null,
  }
}
