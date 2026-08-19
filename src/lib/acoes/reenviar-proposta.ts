'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { emailAutomaticoAtivo } from '../dados/email-programa'
import { emailMicrosoftConfigurado, enviarPropostaPorEmail } from '../propostas/email-microsoft'
import { assuntoDoEmailDaProposta, montarEmailDaProposta } from '../propostas/template-email'
import type { ItemParaResumoFinanceiro } from '../dominio/resumo-financeiro'

const VALIDADE_LINK_PDF_SEGUNDOS = 60 * 60 * 24 * 30
const SCHEMA = 'supabase/schema-entrega-4-fechamento-propostas.sql'

type DestinatarioRpc = {
  usuario_id: string
  email: string
  tipo: 'executivo' | 'responsavel_programa' | 'consultor_programa'
}

type LinhaProposta = {
  id: string
  usuario_id: string
  consulta_id: string
  pdf_path: string | null
  marca_nome: string | null
  cliente_nome: string
  programa_id: string
  programa_nome: string
  produto: string | null
  objetivo: string | null
  modalidade: 'nacional' | 'regional'
  valor_total_comercial: number
}

export async function reenviarPropostaPorEmail(propostaId: string): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!emailMicrosoftConfigurado()) return { erro: 'Microsoft 365 ainda não está configurado para envio.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('propostas')
    .select('id, usuario_id, consulta_id, pdf_path, marca_nome, cliente_nome, programa_id, programa_nome, produto, objetivo, modalidade, valor_total_comercial')
    .eq('id', propostaId)
    .maybeSingle()

  if (error || !data) return { erro: 'Proposta não encontrada ou sem permissão para reenvio.' }
  const proposta = data as unknown as LinhaProposta

  if (proposta.usuario_id !== sessao.usuarioId) {
    return { erro: 'Somente o executivo que gerou a proposta pode reenviar este e-mail.' }
  }
  if (!proposta.pdf_path) return { erro: 'Esta proposta ainda não possui PDF.' }

  const ativo = await emailAutomaticoAtivo(proposta.programa_id)
  if (!ativo) return { erro: 'O disparo de e-mail está desativado na configuração deste programa.' }

  const { data: assinatura, error: erroAssinatura } = await supabase.storage
    .from('propostas')
    .createSignedUrl(proposta.pdf_path, VALIDADE_LINK_PDF_SEGUNDOS)

  if (erroAssinatura || !assinatura?.signedUrl) return { erro: 'Não foi possível criar um novo link seguro para a proposta.' }

  const [{ data: itensData, error: erroItens }, { data: destinatariosData, error: erroDestinatarios }] = await Promise.all([
    supabase
      .from('consulta_itens')
      .select('data, quantidade, pracas')
      .eq('consulta_id', proposta.consulta_id)
      .order('data', { ascending: true }),
    supabase.rpc('destinatarios_da_proposta', {
      p_programa_id: proposta.programa_id,
      p_executivo_id: proposta.usuario_id,
    }),
  ])

  if (erroItens) return { erro: 'Não foi possível recuperar as datas da proposta.' }
  if (erroDestinatarios) {
    const texto = erroDestinatarios.message.toLowerCase()
    return { erro: texto.includes('destinatarios_da_proposta') || texto.includes('could not find')
      ? `Execute ${SCHEMA} no Supabase antes de reenviar.`
      : 'Não foi possível resolver os destinatários configurados.' }
  }

  const itens = ((itensData ?? []) as Array<{ data: string; quantidade: number; pracas: string[] | null }>).map((item) => ({
    data: item.data,
    quantidade: item.quantidade,
    pracas: item.pracas ?? [],
  })) satisfies ItemParaResumoFinanceiro[]

  const destinatarios = ((destinatariosData ?? []) as DestinatarioRpc[]).filter((item) => Boolean(item.email))
  const para = destinatarios.filter((item) => item.tipo === 'executivo')
  const cc = destinatarios.filter((item) => item.tipo === 'responsavel_programa')
  if (para.length === 0) return { erro: 'O executivo da proposta não possui e-mail cadastrado.' }

  const agora = new Date().toISOString()
  await supabase.from('propostas').update({ email_status: 'enviando', email_erro: null }).eq('id', proposta.id)

  try {
    await enviarPropostaPorEmail({
      para,
      cc,
      assunto: assuntoDoEmailDaProposta({
        executivoNome: sessao.nome,
        clienteNome: proposta.cliente_nome,
        marcaNome: proposta.marca_nome,
        produto: proposta.produto ?? 'Não informado',
        programaNome: proposta.programa_nome,
        modalidade: proposta.modalidade,
        objetivo: proposta.objetivo ?? 'Não informado',
        itens,
        totalComercial: Number(proposta.valor_total_comercial),
        linkPdf: assinatura.signedUrl,
      }),
      html: montarEmailDaProposta({
        executivoNome: sessao.nome,
        clienteNome: proposta.cliente_nome,
        marcaNome: proposta.marca_nome,
        produto: proposta.produto ?? 'Não informado',
        programaNome: proposta.programa_nome,
        modalidade: proposta.modalidade,
        objetivo: proposta.objetivo ?? 'Não informado',
        itens,
        totalComercial: Number(proposta.valor_total_comercial),
        linkPdf: assinatura.signedUrl,
      }),
    })

    await Promise.all([
      supabase.from('propostas').update({ email_status: 'enviado', email_erro: null, email_enviado_em: agora, enviado_em: agora }).eq('id', proposta.id),
      supabase.from('proposta_destinatarios').upsert(
        destinatarios.map((item) => ({
          proposta_id: proposta.id,
          usuario_id: item.usuario_id,
          email: item.email,
          tipo: item.tipo,
          status: 'enviado',
          erro: null,
          enviado_em: agora,
        })),
        { onConflict: 'proposta_id,email' },
      ),
    ])

    revalidatePath('/propostas')
    return { erro: null }
  } catch (erroEnvio) {
    const mensagem = erroEnvio instanceof Error ? erroEnvio.message : 'Falha ao reenviar a proposta.'
    await Promise.all([
      supabase.from('propostas').update({ email_status: 'falha', email_erro: mensagem }).eq('id', proposta.id),
      supabase.from('proposta_destinatarios').update({ status: 'falha', erro: mensagem }).eq('proposta_id', proposta.id),
    ])
    revalidatePath('/propostas')
    return { erro: mensagem }
  }
}
