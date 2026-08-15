export type Categoria =
  | 'AÇÃO DE CONTEÚDO'
  | 'COMERCIAL'
  | 'CONTEÚDO NO BREAK'
  | 'INSERT'
  | 'VINHETA'
  | 'CHAMADA'

export type MapaDeFormatos = Map<string, Categoria>

/**
 * R2 — o viés é conservador de propósito: ação sem formato definido é lançada
 * com muita antecedência e pode virar ação de conteúdo. Errar para este lado
 * evita anunciar disponibilidade que não existe.
 */
export const CATEGORIA_PADRAO: Categoria = 'AÇÃO DE CONTEÚDO'

export function normalizarFormato(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return ''
  return texto.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function montarMapa(linhas: { formato: string; categoria: string }[]): MapaDeFormatos {
  const mapa: MapaDeFormatos = new Map()
  for (const linha of linhas) {
    mapa.set(normalizarFormato(linha.formato), linha.categoria as Categoria)
  }
  return mapa
}

export function categoriaDoFormato(
  formato: string | null | undefined,
  mapa: MapaDeFormatos,
): Categoria {
  const chave = normalizarFormato(formato)
  if (chave === '' || chave === '-') return CATEGORIA_PADRAO
  return mapa.get(chave) ?? CATEGORIA_PADRAO
}

// R1 — só ação de conteúdo consome slot. Comercial, insert, vinheta, chamada e
// conteúdo no break existem na base mas são invisíveis à disponibilidade.
export function ocupaSlot(formato: string | null | undefined, mapa: MapaDeFormatos): boolean {
  return categoriaDoFormato(formato, mapa) === 'AÇÃO DE CONTEÚDO'
}
