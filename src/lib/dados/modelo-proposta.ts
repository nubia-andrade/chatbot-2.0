import { criarClienteServidor } from '../supabase/cliente-servidor'

export const SECOES_DO_MODELO = [
  'capa',
  'conteudo',
  'digital',
  'redes_sociais',
  'valor',
  'observacoes',
  'contracapa',
] as const

export type SecaoDoModeloDeProposta = (typeof SECOES_DO_MODELO)[number]

export type SlideDoModeloDeProposta = {
  id: string
  programa_id: string
  imagem_url: string
  secao: SecaoDoModeloDeProposta
  ordem: number
  criado_em: string
  atualizado_em: string
}

const ORDEM_DAS_SECOES = new Map<SecaoDoModeloDeProposta, number>(
  SECOES_DO_MODELO.map((secao, indice) => [secao, indice] as const),
)

export function ordenarSlidesDoModelo(
  slides: SlideDoModeloDeProposta[],
): SlideDoModeloDeProposta[] {
  return [...slides].sort((a, b) => {
    const secaoA = ORDEM_DAS_SECOES.get(a.secao) ?? 99
    const secaoB = ORDEM_DAS_SECOES.get(b.secao) ?? 99
    if (secaoA !== secaoB) return secaoA - secaoB
    if (a.ordem !== b.ordem) return a.ordem - b.ordem
    return a.criado_em.localeCompare(b.criado_em)
  })
}

export function slidesDaSecao(
  slides: SlideDoModeloDeProposta[],
  secao: SecaoDoModeloDeProposta,
): SlideDoModeloDeProposta[] {
  return ordenarSlidesDoModelo(slides.filter((slide) => slide.secao === secao))
}

export async function listarSlidesDoModelo(programaId: string): Promise<SlideDoModeloDeProposta[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('programa_modelo_slides')
    .select('id, programa_id, imagem_url, secao, ordem, criado_em, atualizado_em')
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao listar slides do modelo de proposta:', error.message)
    return []
  }

  return ordenarSlidesDoModelo((data ?? []) as SlideDoModeloDeProposta[])
}
