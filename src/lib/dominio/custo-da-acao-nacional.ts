import { calcularDireitosTv } from './direitos-e-conexos'
import { aplicarAcrescimo } from './datas-especiais'

/**
 * Total de UMA ação nacional:
 *
 *   total = mídia de TV (já com o acréscimo de data especial, quando houver)
 *         + direitos e conexos (calculado sobre essa mídia — `direitos-e-conexos.ts`)
 *         + custo de produção de TV
 *
 * Espelha `custo-da-acao-regional.ts`, com a diferença de não haver praças: o
 * nacional é um valor só. Digital fica de fora enquanto a área não confirmar
 * quais programas vendem digital junto — os campos existem no cadastro e
 * entram aqui quando isso for definido.
 */

export type CustosNacionais = {
  custo_midia_tv: number | null
  custo_producao_tv: number | null
  percentual_simulcast: number | null
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * `percentualAcrescimo` vem de um período de `datas_especiais` e incide sobre
 * a MÍDIA, antes dos direitos — que por isso sobem junto, sem precisar saber
 * que existe data especial. Produção não é mídia e não sobe.
 *
 * Devolve `null` quando não há custo de mídia: "não dá para calcular ainda",
 * não "custa zero" — mesma convenção de `direitos-e-conexos.ts`. Um programa
 * sem mídia preenchida não tem ação de R$ 0,00.
 */
export function calcularCustoDaAcaoNacional(
  custos: CustosNacionais,
  percentualAcrescimo: number = 0,
): number | null {
  if (custos.custo_midia_tv === null || custos.custo_midia_tv === undefined) return null

  const midia =
    percentualAcrescimo > 0
      ? aplicarAcrescimo(custos.custo_midia_tv, percentualAcrescimo)
      : custos.custo_midia_tv

  const direitos = calcularDireitosTv(midia, custos.percentual_simulcast) ?? 0

  return arredondar(midia + direitos + (custos.custo_producao_tv ?? 0))
}
