import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

export type StatusEmailDaProposta = 'desativado' | 'nao_configurado' | 'pendente' | 'enviando' | 'enviado' | 'falha'
export type StatusNegociacao = 'em_negociacao' | 'fechada' | 'perdida' | 'cancelada' | 'substituida'
export type StatusAprovacaoDaProposta = 'nao_requerida' | 'pendente' | 'aprovada' | 'rejeitada'

export type PropostaDaLista = {
  id: string
  usuario_id: string
  marca_nome: string | null
  cliente_nome: string
  programa_nome: string
  modalidade: 'nacional' | 'regional'
  inclui_digital: boolean
  inclui_redes_sociais: boolean
  valor_total_comercial: number
  valor_total_geral: number
  status: 'gerando' | 'gerada' | 'enviando' | 'enviada' | 'falha'
  erro: string | null
  email_status: StatusEmailDaProposta
  email_erro: string | null
  email_enviado_em: string | null
  negociacao_status: StatusNegociacao
  valor_final_negociado: number | null
  data_fechamento: string | null
  observacao_negociacao: string | null
  motivo_perda: string | null
  grupo_versao_id: string
  versao: number
  proposta_anterior_id: string | null
  aprovacao_status: StatusAprovacaoDaProposta
  aprovacao_solicitada_em: string | null
  aprovacao_decidida_em: string | null
  aprovacao_justificativa: string | null
  aprovacao_email_solicitacao_status: string
  aprovacao_email_devolutiva_status: string
  criado_em: string
  enviado_em: string | null
  pdf_url: string | null
}

type Linha = Omit<PropostaDaLista, 'pdf_url'> & { pdf_path: string | null }
type LinhaSemAprovacao = Omit<Linha, 'aprovacao_status' | 'aprovacao_solicitada_em' | 'aprovacao_decidida_em' | 'aprovacao_justificativa' | 'aprovacao_email_solicitacao_status' | 'aprovacao_email_devolutiva_status'>
type LinhaSemAcompanhamento = Omit<LinhaSemAprovacao, 'negociacao_status' | 'valor_final_negociado' | 'data_fechamento' | 'observacao_negociacao' | 'motivo_perda' | 'grupo_versao_id' | 'versao' | 'proposta_anterior_id'>
type LinhaAntiga = Omit<LinhaSemAcompanhamento, 'email_status' | 'email_erro' | 'email_enviado_em'>

const CAMPOS_BASE = 'id, usuario_id, marca_nome, cliente_nome, programa_nome, modalidade, inclui_digital, inclui_redes_sociais, valor_total_comercial, valor_total_geral, status, erro, criado_em, enviado_em, pdf_path'
const CAMPOS_EMAIL = 'email_status, email_erro, email_enviado_em'
const CAMPOS_ACOMPANHAMENTO = 'negociacao_status, valor_final_negociado, data_fechamento, observacao_negociacao, motivo_perda, grupo_versao_id, versao, proposta_anterior_id'
const CAMPOS_APROVACAO = 'aprovacao_status, aprovacao_solicitada_em, aprovacao_decidida_em, aprovacao_justificativa, aprovacao_email_solicitacao_status, aprovacao_email_devolutiva_status'

function statusEmailLegado(linha: LinhaAntiga): StatusEmailDaProposta {
  if (linha.status === 'enviada') return 'enviado'
  if (linha.status === 'enviando') return 'pendente'
  if (linha.status === 'falha' && linha.pdf_path) return 'falha'
  return 'desativado'
}

function acompanharLegado(linha: LinhaSemAcompanhamento): LinhaSemAprovacao {
  return { ...linha, negociacao_status: 'em_negociacao', valor_final_negociado: null, data_fechamento: null, observacao_negociacao: null, motivo_perda: null, grupo_versao_id: linha.id, versao: 1, proposta_anterior_id: null }
}

function aprovarLegado(linha: LinhaSemAprovacao): Linha {
  return { ...linha, aprovacao_status: 'nao_requerida', aprovacao_solicitada_em: null, aprovacao_decidida_em: null, aprovacao_justificativa: null, aprovacao_email_solicitacao_status: 'nao_enviado', aprovacao_email_devolutiva_status: 'nao_enviado' }
}

function erroDeCampo(mensagem: string, campos: string[]): boolean {
  const texto = mensagem.toLowerCase()
  return texto.includes('could not find') || texto.includes('does not exist') || campos.some((campo) => texto.includes(campo))
}

export async function listarPropostasVisiveis(): Promise<PropostaDaLista[]> {
  const sessao = await obterSessao()
  if (!sessao) return []
  const supabase = await criarClienteServidor()
  const podeAcompanharPrograma = temPerfil(sessao.perfis, 'consultor_programa') || temPerfil(sessao.perfis, 'proprietario')

  const base = (campos: string) => {
    let builder = supabase.from('propostas').select(campos).order('criado_em', { ascending: false }).limit(500)
    if (!podeAcompanharPrograma) builder = builder.eq('usuario_id', sessao.usuarioId)
    return builder
  }

  const completa = await base(`${CAMPOS_BASE}, ${CAMPOS_EMAIL}, ${CAMPOS_ACOMPANHAMENTO}, ${CAMPOS_APROVACAO}`)
  let linhas: Linha[] = []

  if (!completa.error) {
    linhas = (completa.data ?? []) as unknown as Linha[]
  } else if (erroDeCampo(completa.error.message, ['aprovacao_status'])) {
    const semAprovacao = await base(`${CAMPOS_BASE}, ${CAMPOS_EMAIL}, ${CAMPOS_ACOMPANHAMENTO}`)
    if (!semAprovacao.error) {
      linhas = ((semAprovacao.data ?? []) as unknown as LinhaSemAprovacao[]).map(aprovarLegado)
    } else if (erroDeCampo(semAprovacao.error.message, ['negociacao_status', 'grupo_versao_id', 'versao'])) {
      const semAcompanhamento = await base(`${CAMPOS_BASE}, ${CAMPOS_EMAIL}`)
      if (!semAcompanhamento.error) {
        linhas = ((semAcompanhamento.data ?? []) as unknown as LinhaSemAcompanhamento[]).map(acompanharLegado).map(aprovarLegado)
      } else if (erroDeCampo(semAcompanhamento.error.message, ['email_status', 'email_erro'])) {
        const antiga = await base(CAMPOS_BASE)
        if (antiga.error) { console.error('Falha ao listar propostas:', antiga.error.message); return [] }
        linhas = ((antiga.data ?? []) as unknown as LinhaAntiga[]).map((linha) => aprovarLegado(acompanharLegado({ ...linha, email_status: statusEmailLegado(linha), email_erro: linha.status === 'falha' && linha.pdf_path ? linha.erro : null, email_enviado_em: linha.enviado_em })))
      } else { console.error('Falha ao listar propostas:', semAcompanhamento.error.message); return [] }
    } else { console.error('Falha ao listar propostas:', semAprovacao.error.message); return [] }
  } else {
    console.error('Falha ao listar propostas:', completa.error.message)
    return []
  }

  return Promise.all(linhas.map(async (linha) => {
    let pdfUrl: string | null = null
    const podeLerPdf = podeAcompanharPrograma || linha.aprovacao_status === 'nao_requerida' || linha.aprovacao_status === 'aprovada'
    if (linha.pdf_path && podeLerPdf) {
      const { data: assinatura } = await supabase.storage.from('propostas').createSignedUrl(linha.pdf_path, 60 * 60)
      pdfUrl = assinatura?.signedUrl ?? null
    }
    const { pdf_path: _pdfPath, ...resto } = linha
    return { ...resto, pdf_url: pdfUrl }
  }))
}
