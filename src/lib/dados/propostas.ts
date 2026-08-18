import { criarClienteServidor } from '../supabase/cliente-servidor'

export type PropostaDaLista = {
  id: string
  marca_nome: string | null
  cliente_nome: string
  programa_nome: string
  modalidade: 'nacional' | 'regional'
  valor_total_comercial: number
  valor_total_geral: number
  status: 'gerando' | 'gerada' | 'enviando' | 'enviada' | 'falha'
  erro: string | null
  criado_em: string
  enviado_em: string | null
  pdf_url: string | null
}

type Linha = Omit<PropostaDaLista, 'pdf_url'> & { pdf_path: string | null }

export async function listarPropostasVisiveis(): Promise<PropostaDaLista[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('propostas')
    .select('id, marca_nome, cliente_nome, programa_nome, modalidade, valor_total_comercial, valor_total_geral, status, erro, criado_em, enviado_em, pdf_path')
    .order('criado_em', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Falha ao listar propostas:', error.message)
    return []
  }

  const linhas = (data ?? []) as Linha[]
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
