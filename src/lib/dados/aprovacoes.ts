import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

export type StatusAprovacao = 'nao_requerida' | 'pendente' | 'aprovada' | 'rejeitada'

export type PropostaParaAprovacao = {
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
  itens: { data: string; quantidade: number; pracas: string[] }[]
  valor_total_comercial: number
  aprovacao_status: StatusAprovacao
  aprovacao_solicitada_em: string | null
  aprovacao_decidida_em: string | null
  aprovacao_justificativa: string | null
  aprovacao_email_solicitacao_status: string
  aprovacao_email_devolutiva_status: string
  criado_em: string
  pdf_url: string | null
}

type Linha = Omit<PropostaParaAprovacao, 'pdf_url' | 'itens'> & {
  pdf_path: string | null
  consulta_id: string
}

type ItemConsulta = { data: string; quantidade: number; pracas: string[] | null }

export async function listarPropostasParaAprovacao(): Promise<PropostaParaAprovacao[]> {
  const sessao = await obterSessao()
  if (!sessao) return []
  const podeVer = temPerfil(sessao.perfis, 'consultor_programa') || temPerfil(sessao.perfis, 'proprietario')
  if (!podeVer) return []

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('propostas')
    .select('id, usuario_id, executivo_nome, marca_nome, cliente_nome, programa_id, programa_nome, produto, objetivo, modalidade, valor_total_comercial, aprovacao_status, aprovacao_solicitada_em, aprovacao_decidida_em, aprovacao_justificativa, aprovacao_email_solicitacao_status, aprovacao_email_devolutiva_status, criado_em, pdf_path, consulta_id')
    .in('aprovacao_status', ['pendente', 'aprovada', 'rejeitada'])
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Falha ao listar aprovações:', error.message)
    return []
  }

  const linhas = (data ?? []) as unknown as Linha[]
  const consultaIds = [...new Set(linhas.map((linha) => linha.consulta_id).filter(Boolean))]
  const itensPorConsulta = new Map<string, ItemConsulta[]>()

  if (consultaIds.length > 0) {
    const { data: itens, error: erroItens } = await supabase
      .from('consulta_itens')
      .select('consulta_id, data, quantidade, pracas')
      .in('consulta_id', consultaIds)

    if (!erroItens) {
      for (const item of (itens ?? []) as unknown as (ItemConsulta & { consulta_id: string })[]) {
        const lista = itensPorConsulta.get(item.consulta_id) ?? []
        lista.push(item)
        itensPorConsulta.set(item.consulta_id, lista)
      }
    }
  }

  return Promise.all(linhas.map(async (linha) => {
    let pdfUrl: string | null = null
    if (linha.pdf_path) {
      const { data: assinatura } = await supabase.storage.from('propostas').createSignedUrl(linha.pdf_path, 60 * 60)
      pdfUrl = assinatura?.signedUrl ?? null
    }
    const itens = (itensPorConsulta.get(linha.consulta_id) ?? []).map((item) => ({
      data: item.data,
      quantidade: item.quantidade,
      pracas: item.pracas ?? [],
    })).sort((a, b) => a.data.localeCompare(b.data))
    const { pdf_path: _pdfPath, consulta_id: _consultaId, ...resto } = linha
    return { ...resto, itens, pdf_url: pdfUrl }
  }))
}
