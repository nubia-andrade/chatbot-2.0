import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

export type StatusEmailDaProposta = 'desativado' | 'nao_configurado' | 'pendente' | 'enviando' | 'enviado' | 'falha'
export type StatusNegociacao = 'em_negociacao' | 'fechada' | 'perdida' | 'cancelada' | 'substituida'

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
  criado_em: string
  enviado_em: string | null
  pdf_url: string | null
}

type Linha = Omit<PropostaDaLista, 'pdf_url'> & { pdf_path: string | null }
type LinhaSemAcompanhamento = Omit<Linha, 'negociacao_status' | 'valor_final_negociado' | 'data_fechamento' | 'observacao_negociacao' | 'motivo_perda' | 'grupo_versao_id' | 'versao' | 'proposta_anterior_id'>
type LinhaAntiga = Omit<LinhaSemAcompanhamento, 'email_status' | 'email_erro' | 'email_enviado_em'>

const CAMPOS_BASE = 'id, usuario_id, marca_nome, cliente_nome, programa_nome, modalidade, inclui_digital, inclui_redes_sociais, valor_total_comercial, valor_total_geral, status, erro, criado_em, enviado_em, pdf_path'
const CAMPOS_EMAIL = 'email_status, email_erro, email_enviado_em'
const CAMPOS_ACOMPANHAMENTO = 'negociacao_status, valor_final_negociado, data_fechamento, observacao_negociacao, motivo_perda, grupo_versao_id, versao, proposta_anterior_id'

function statusEmailLegado(linha: LinhaAntiga): StatusEmailDaProposta {
  if (linha.status === 'enviada') return 'enviado'
  if (linha.status === 'enviando') return 'pendente'
  if (linha.status === 'falha' && linha.pdf_path) return 'falha'
  return 'desativado'
}

function acompanharLegado<T extends LinhaSemAcompanhamento>(linha: T): Linha {
  return {
    ...linha,
    negociacao_status: 'em_negociacao',
    valor_final_negociado: null,
    data_fechamento: null,
    observacao_negociacao: null,
    motivo_perda: null,
    grupo_versao_id: linha.id,
    versao: 1,
    proposta_anterior_id: null,
  }
}

function erroDeCampo(mensagem: string, campos: string[]): boolean {
  const texto = mensagem.toLowerCase()
  return texto.includes('could not find') || campos.some((campo) => texto.includes(campo))
}

export async function listarPropostasVisiveis(): Promise<PropostaDaLista[]> {
  const sessao = await obterSessao()
  if (!sessao) return []

  const supabase = await criarClienteServidor()
  const podeAcompanharPrograma = temPerfil(sessao.perfis, 'consultor_programa') || temPerfil(sessao.perfis, 'proprietario')

  const aplicarEscopo = <T extends { eq: (coluna: string, valor: string) => T }>(builder: T): T => {
    if (!podeAcompanharPrograma) return builder.eq('usuario_id', sessao.usuarioId)
    return builder
  }

  const consultaCompleta = await aplicarEscopo(
    supabase
      .from('propostas')
      .select(`${CAMPOS_BASE}, ${CAMPOS_EMAIL}, ${CAMPOS_ACOMPANHAMENTO}`)
      .order('criado_em', { ascending: false })
      .limit(100),
  )

  let linhas: Linha[] = []

  if (!consultaCompleta.error) {
    linhas = (consultaCompleta.data ?? []) as unknown as Linha[]
  } else if (erroDeCampo(consultaCompleta.error.message, ['negociacao_status', 'grupo_versao_id', 'versao'])) {
    const consultaSemAcompanhamento = await aplicarEscopo(
      supabase
        .from('propostas')
        .select(`${CAMPOS_BASE}, ${CAMPOS_EMAIL}`)
        .order('criado_em', { ascending: false })
        .limit(100),
    )

    if (!consultaSemAcompanhamento.error) {
      linhas = ((consultaSemAcompanhamento.data ?? []) as unknown as LinhaSemAcompanhamento[]).map(acompanharLegado)
    } else if (erroDeCampo(consultaSemAcompanhamento.error.message, ['email_status', 'email_erro'])) {
      const consultaAntiga = await aplicarEscopo(
        supabase
          .from('propostas')
          .select(CAMPOS_BASE)
          .order('criado_em', { ascending: false })
          .limit(100),
      )

      if (consultaAntiga.error) {
        console.error('Falha ao listar propostas:', consultaAntiga.error.message)
        return []
      }

      linhas = ((consultaAntiga.data ?? []) as unknown as LinhaAntiga[]).map((linha) => acompanharLegado({
        ...linha,
        email_status: statusEmailLegado(linha),
        email_erro: linha.status === 'falha' && linha.pdf_path ? linha.erro : null,
        email_enviado_em: linha.enviado_em,
      }))
    } else {
      console.error('Falha ao listar propostas:', consultaSemAcompanhamento.error.message)
      return []
    }
  } else {
    console.error('Falha ao listar propostas:', consultaCompleta.error.message)
    return []
  }

  return Promise.all(linhas.map(async (linha) => {
    let pdfUrl: string | null = null
    if (linha.pdf_path) {
      const { data: assinatura } = await supabase.storage
        .from('propostas')
        .createSignedUrl(linha.pdf_path, 60 * 60)
      pdfUrl = assinatura?.signedUrl ?? null
    }

    const { pdf_path: _pdfPath, ...resto } = linha
    return { ...resto, pdf_url: pdfUrl }
  }))
}
