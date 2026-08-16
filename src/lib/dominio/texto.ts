/**
 * Normalização de nomes próprios da carteira — cliente, setor e indústria.
 *
 * O mesmo anunciante chega escrito de formas diferentes conforme a origem
 * ("Ambev", "AMBEV S/A", "ambev"), e as ações nacionais importadas guardam o
 * nome como texto, não como referência ao cadastro. Comparar sem normalizar
 * faria duas grafias do mesmo cliente passarem por clientes distintos — e a
 * regra de teto de praças (R9) ou a de concorrência (R14) deixaria passar o
 * que deveria recusar.
 *
 * Diferente de `normalizarFormato` (`formatos.ts`), esta função também remove
 * acentuação: "NESTLÉ" e "NESTLE" são o mesmo anunciante, enquanto os
 * formatos da API já chegam num vocabulário fechado e sem essa variação.
 */
export function normalizarNome(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
