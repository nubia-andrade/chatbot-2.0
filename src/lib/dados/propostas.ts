import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

export type StatusEmailDaProposta = 'desativado' | 'nao_configurado' | 'pendente' | 'enviando' | 'enviado' | 'falha'

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
  criado_em: string
  enviado_em: string | null
  pdf_url: string | null
}

type Linha = Omit<PropostaDaLista, 'pdf_url'> & { pdf_path: string | null }
type LinhaAntiga = Omit<Linha, 'email_status' | 'email_erro' | 'email_enviado_em'>

const CAMPOS_BASE = 'id, usuario_id, marca_nome, cliente_nome, programa_nome, modalidade, inclui_digital, inclui_redes_sociais, valor_total_comercial, valor_total_geral, status, erro, criado_em, enviado_em, pdf_path'

function statusEmailLegado(linha: LinhaAntiga): StatusEmailDaProposta {
  if (linha.status === 'enviada') return 'enviado'
  if (linha.status === 'enviando') return 'pendente'
  if (linha.status === 'falha' && linha.pdf_path) return 'falha'
  return 'desativado'
}

export async function listarPropostasVisiveis(): Promise<PropostaDaLista[]> {
  const sessao = await obterSessao()
  if (!sessao) return []

  const supabase = await criarClienteServidor()
  const podeAcompanharPrograma = temPerfil(sessao.perfis, 'consultor_programa') || temPerfil(sessao.perfis, 'proprietario')

  let consultaNovaBuilder = supabase
    .from('propostas')
    .select(`${CAMPOS_BASE}, email_status, email_erro, email_enviado_em`)
    .order('criado_em', { ascending: false })
    .limit(100)

  // Defesa em profundidade: perfis comerciais pedem explicitamente só as
  // próprias propostas. O RLS do banco aplica a mesma restrição novamente.
  if (!podeAcompanharPrograma) {
    consultaNovaBuilder = consultaNovaBuilder.eq('usuario_id', sessao.usuarioId)
  }

  const consultaNova = await consultaNovaBuilder
  let linhas: Linha[] = []

  if (!consultaNova.error) {
    linhas = (consultaNova.data ?? []) as unknown as Linha[]
  } else {
    const texto = consultaNova.error.message.toLowerCase()
    const schemaAntigo = texto.includes('email_status') || texto.includes('email_erro') || texto.includes('could not find')
    if (!schemaAntigo) {
      console.error('Falha ao listar propostas:', consultaNova.error.message)
      return []
    }

    let consultaAntigaBuilder = supabase
      .from('propostas')
      .select(CAMPOS_BASE)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (!podeAcompanharPrograma) {
      consultaAntigaBuilder = consultaAntigaBuilder.eq('usuario_id', sessao.usuarioId)
    }

    const consultaAntiga = await consultaAntigaBuilder
    if (consultaAntiga.error) {
      console.error('Falha ao listar propostas:', consultaAntiga.error.message)
      return []
    }

    linhas = ((consultaAntiga.data ?? []) as unknown as LinhaAntiga[]).map((linha) => ({
      ...linha,
      email_status: statusEmailLegado(linha),
      email_erro: linha.status === 'falha' && linha.pdf_path ? linha.erro : null,
      email_enviado_em: linha.enviado_em,
    }))
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
