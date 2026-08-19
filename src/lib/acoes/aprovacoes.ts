'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAprovarPrograma } from '../dominio/perfis'
import { emailMicrosoftConfigurado, enviarEmailMicrosoft } from '../propostas/email-microsoft'
import {
  assuntoPropostaAprovada,
  assuntoPropostaRejeitada,
  montarEmailPropostaAprovada,
  montarEmailPropostaRejeitada,
  type DadosEmailAprovacao,
} from '../propostas/template-aprovacao'

const VALIDADE_LINK_PDF_SEGUNDOS = 60 * 60 * 24 * 30

type Decisao = 'aprovar' | 'rejeitar'
type Destinatario = { usuario_id: string; email: string; tipo: 'executivo' | 'responsavel_programa' }

type LinhaProposta = {
  id: string
  usuario_id: string
  executivo_nome: string | null
  marca_nome: string | null
  cliente_nome: string
  programa_id: string
  programa_nome: string
  produto: string
  objetivo: string
  modalidade: 'nacional' | 'regional'
  valor_total_comercial: number
  consulta_id: string
  pdf_path: string | null
  aprovacao_status: string
}

type ItemConsulta = { data: string; quantidade: number; pracas: string[] | null }

async function registrarEmail(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  propostaId: string,
  fase: 'devolutiva' | 'proposta_final',
  status: 'nao_configurado' | 'enviando' | 'enviado' | 'falha',
  erro: string | null = null,
) {
  const { error } = await supabase.rpc('registrar_email_workflow_aprovacao', {
    p_proposta_id: propostaId,
    p_fase: fase,
    p_status: status,
    p_erro: erro,
  })
  if (error) console.error('Falha ao registrar e-mail de aprovação:', error.message)
}

export async function decidirAprovacao(params: {
  propostaId: string
  decisao: Decisao
  justificativa?: string
}): Promise<{ erro: string | null; status: 'aprovada' | 'rejeitada' | null; emailErro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sessão expirada. Entre de novo.', status: null, emailErro: null }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('propostas')
    .select('id, usuario_id, executivo_nome, marca_nome, cliente_nome, programa_id, programa_nome, produto, objetivo, modalidade, valor_total_comercial, consulta_id, pdf_path, aprovacao_status')
    .eq('id', params.propostaId)
    .maybeSingle()

  if (error || !data) return { erro: 'Proposta não encontrada ou sem permissão de acesso.', status: null, emailErro: null }
  const proposta = data as LinhaProposta

  if (!podeAprovarPrograma(sessao.perfis, sessao.programasVinculados, proposta.programa_id)) {
    return { erro: 'Você não pode aprovar propostas deste programa.', status: null, emailErro: null }
  }
  if (proposta.aprovacao_status !== 'pendente') {
    return { erro: 'Esta proposta já não está pendente de aprovação.', status: null, emailErro: null }
  }
  const justificativa = params.justificativa?.trim() ?? ''
  if (params.decisao === 'rejeitar' && !justificativa) {
    return { erro: 'Informe a justificativa da rejeição.', status: null, emailErro: null }
  }

  const { data: novoStatus, error: erroDecisao } = await supabase.rpc('decidir_aprovacao_proposta', {
    p_proposta_id: proposta.id,
    p_decisao: params.decisao,
    p_justificativa: justificativa || null,
  })
  if (erroDecisao) return { erro: erroDecisao.message, status: null, emailErro: null }
  const status = novoStatus as 'aprovada' | 'rejeitada'

  const [{ data: itensData }, { data: destinatariosData, error: erroDestinatarios }] = await Promise.all([
    supabase.from('consulta_itens').select('data, quantidade, pracas').eq('consulta_id', proposta.consulta_id).order('data'),
    supabase.rpc('destinatarios_da_proposta', {
      p_programa_id: proposta.programa_id,
      p_executivo_id: proposta.usuario_id,
    }),
  ])

  const itens = ((itensData ?? []) as ItemConsulta[]).map((item) => ({
    data: item.data,
    quantidade: item.quantidade,
    pracas: item.pracas ?? [],
  }))
  const destinatarios = ((destinatariosData ?? []) as Destinatario[]).filter((item) => Boolean(item.email))
  const para = destinatarios.filter((item) => item.tipo === 'executivo')
  const cc = destinatarios.filter((item) => item.tipo === 'responsavel_programa')
  const fase = status === 'aprovada' ? 'proposta_final' as const : 'devolutiva' as const

  let pdfUrl: string | null = null
  if (status === 'aprovada' && proposta.pdf_path) {
    const { data: assinatura } = await supabase.storage
      .from('propostas')
      .createSignedUrl(proposta.pdf_path, VALIDADE_LINK_PDF_SEGUNDOS)
    pdfUrl = assinatura?.signedUrl ?? null
  }

  if (!emailMicrosoftConfigurado()) {
    const mensagem = 'A decisão foi salva, mas o Microsoft 365 ainda não está configurado para enviar a devolutiva.'
    await registrarEmail(supabase, proposta.id, fase, 'nao_configurado', mensagem)
    revalidar()
    return { erro: null, status, emailErro: mensagem }
  }
  if (erroDestinatarios || para.length === 0) {
    const mensagem = 'A decisão foi salva, mas não foi possível localizar o e-mail do executivo.'
    await registrarEmail(supabase, proposta.id, fase, 'falha', mensagem)
    revalidar()
    return { erro: null, status, emailErro: mensagem }
  }
  if (status === 'aprovada' && !pdfUrl) {
    const mensagem = 'A proposta foi aprovada, mas não foi possível criar o link seguro do PDF.'
    await registrarEmail(supabase, proposta.id, fase, 'falha', mensagem)
    revalidar()
    return { erro: null, status, emailErro: mensagem }
  }

  const dadosEmail: DadosEmailAprovacao = {
    executivoNome: proposta.executivo_nome ?? 'Executivo',
    clienteNome: proposta.cliente_nome,
    marcaNome: proposta.marca_nome,
    produto: proposta.produto,
    programaNome: proposta.programa_nome,
    modalidade: proposta.modalidade,
    objetivo: proposta.objetivo,
    itens,
    totalComercial: Number(proposta.valor_total_comercial),
    linkPdf: pdfUrl,
    justificativa: justificativa || null,
  }

  try {
    await registrarEmail(supabase, proposta.id, fase, 'enviando')
    await enviarEmailMicrosoft({
      para,
      cc,
      assunto: status === 'aprovada' ? assuntoPropostaAprovada(dadosEmail) : assuntoPropostaRejeitada(dadosEmail),
      html: status === 'aprovada' ? montarEmailPropostaAprovada(dadosEmail) : montarEmailPropostaRejeitada(dadosEmail),
    })
    await registrarEmail(supabase, proposta.id, fase, 'enviado')
    revalidar()
    return { erro: null, status, emailErro: null }
  } catch (erroEmail) {
    const mensagem = erroEmail instanceof Error ? erroEmail.message : 'Falha ao enviar a devolutiva da aprovação.'
    await registrarEmail(supabase, proposta.id, fase, 'falha', mensagem)
    revalidar()
    return { erro: null, status, emailErro: mensagem }
  }
}

function revalidar() {
  revalidatePath('/aprovacoes')
  revalidatePath('/propostas')
  revalidatePath('/inicio')
}
