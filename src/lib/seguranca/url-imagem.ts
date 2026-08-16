/**
 * Sanitização de URL de imagem antes de virar `background-image` inline.
 *
 * Usada onde quer que uma URL vinda de `programas.imagem_url` (texto livre
 * digitado por quem cadastra) seja interpolada dentro de `url("…")`: o
 * formulário de programa e o cabeçalho da área do programa. Só http(s) e sem
 * aspas/parênteses/barra invertida — caracteres que escapariam do `url("…")`
 * e deixariam quem edita um programa injetar CSS na tela de quem vê outro.
 */
export function urlDeImagemSegura(valor: string | null | undefined): string | null {
  const limpo = (valor ?? '').trim()
  if (!/^https?:\/\//i.test(limpo)) return null
  if (/["'()\\]/.test(limpo)) return null
  return limpo
}
