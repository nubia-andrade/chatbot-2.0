import { ocupaSlot, type MapaDeFormatos } from './formatos'

export type AcaoVendida = {
  programa: string
  data_de_exibicao: string
  formato: string
}

export function chaveDeOcupacao(programa: string, data: string): string {
  return `${programa}|${data}`
}

/**
 * R1 — cada linha da API é uma ação; não existe coluna de quantidade.
 * A contagem considera apenas formatos de categoria AÇÃO DE CONTEÚDO.
 */
export function contarOcupacao(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const acao of acoes) {
    if (!ocupaSlot(acao.formato, mapa)) continue
    const chave = chaveDeOcupacao(acao.programa, acao.data_de_exibicao)
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  return contagem
}

export function ocupacaoEm(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
  programa: string,
  data: string,
): number {
  return contarOcupacao(acoes, mapa).get(chaveDeOcupacao(programa, data)) ?? 0
}
