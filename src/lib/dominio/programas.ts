import { normalizarFormato as normalizarTexto } from './formatos'

export type IndiceDeProgramas = {
  porMnemonico: Map<string, string>
  porApelido: Map<string, string>
}

/**
 * R6 — o campo `programa` da API chega como `MNEMONICO - NOME`
 * (ex.: `MAVO - MAIS VOCE`). Quatro dos 23 programas chegam sem mnemônico e
 * dependem de apelido cadastrado.
 */
export function extrairMnemonico(textoDaApi: string | null | undefined): string | null {
  const texto = normalizarTexto(textoDaApi)
  const posicao = texto.indexOf(' - ')
  if (posicao <= 0) return null
  return texto.slice(0, posicao).trim()
}

export function montarIndice(
  programas: { id: string; mnemonico: string }[],
  apelidos: { programa_id: string; texto: string }[],
): IndiceDeProgramas {
  const porMnemonico = new Map<string, string>()
  for (const programa of programas) {
    porMnemonico.set(normalizarTexto(programa.mnemonico), programa.id)
  }
  const porApelido = new Map<string, string>()
  for (const apelido of apelidos) {
    porApelido.set(normalizarTexto(apelido.texto), apelido.programa_id)
  }
  return { porMnemonico, porApelido }
}

export function encontrarProgramaId(
  textoDaApi: string | null | undefined,
  indice: IndiceDeProgramas,
): string | null {
  const mnemonico = extrairMnemonico(textoDaApi)
  if (mnemonico !== null) {
    const achado = indice.porMnemonico.get(mnemonico)
    if (achado !== undefined) return achado
  }
  return indice.porApelido.get(normalizarTexto(textoDaApi)) ?? null
}
