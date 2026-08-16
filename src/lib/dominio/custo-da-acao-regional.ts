import { calcularDireitosTv } from './direitos-e-conexos'

/**
 * Total de uma ação regional — decisão da área: a produção é ÚNICA por
 * PROGRAMA, não por praça. Um cliente que compra SP, RJ e BH paga a
 * produção uma vez, não três; a mídia continua sendo por praça (é ela que
 * varia entre SP e PE1), a produção não.
 *
 *   total = soma das mídias das praças compradas
 *         + direitos e conexos de cada praça (calculado, `direitos-e-conexos.ts`)
 *         + custo de produção regional (uma vez, fora do somatório por praça)
 */

/** O que a conta precisa saber de cada praça — não o cadastro inteiro da praça. */
export type PrecoDaPracaParaCalculo = {
  praca_codigo: string
  custo_midia_tv: number
  percentual_simulcast?: number | null
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Soma mídia + direitos das praças efetivamente compradas, mais a produção
 * regional somada uma única vez — nunca por praça.
 *
 * Uma praça pedida que não tem preço cadastrado em `precos` contribui `0`
 * para o total, a mesma convenção de "praça sem linha no banco" já usada na
 * leitura (`src/lib/dados/regional.ts`: `custo_midia_tv` nasce `0` para
 * quem não tem preço ainda) — o total nunca fica indefinido só porque uma
 * praça específica não foi precificada.
 *
 * `custoProducaoRegional` ausente (`null`/`undefined`) equivale a "produção
 * ainda não informada": entra como `0` na soma, sem impedir o cálculo do
 * resto — igual à convenção do resto do domínio (`moeda.ts`).
 *
 * Lista de praças vazia devolve `0`: sem praça comprada não existe ação, e
 * uma ação que não existe não carrega produção nenhuma.
 */
export function calcularCustoDaAcaoRegional(
  pracasCompradas: string[],
  precos: PrecoDaPracaParaCalculo[],
  custoProducaoRegional: number | null | undefined,
): number {
  if (pracasCompradas.length === 0) return 0

  const porPraca = new Map(precos.map((preco) => [preco.praca_codigo, preco]))

  const totalDasPracas = pracasCompradas.reduce((total, codigo) => {
    const preco = porPraca.get(codigo)
    if (!preco) return total

    const direitos = calcularDireitosTv(preco.custo_midia_tv, preco.percentual_simulcast) ?? 0
    return total + preco.custo_midia_tv + direitos
  }, 0)

  return arredondar(totalDasPracas + (custoProducaoRegional ?? 0))
}
