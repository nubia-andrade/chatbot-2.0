import { aplicarAcrescimo, type PeriodoEspecial } from './datas-especiais'
import { calcularDireitosDigital, calcularDireitosTv } from './direitos-e-conexos'
import type { Programa } from './cadastro'
import type { PrecoDePraca } from '../dados/regional'

export type ItemParaResumoFinanceiro = {
  data: string
  quantidade: number
  pracas: string[]
}

export type LinhaFinanceiraDaProposta = {
  data: string
  quantidade: number
  pracas: string[]
  periodo_especial_nome: string | null
  periodo_especial_percentual: number
  midia_tv: number
  midia_digital: number
  simulcast: number
  total_comercial: number
  producao: number
  direitos_tv: number
  direitos_digital: number
  direitos_total: number
  total_geral: number
}

export type ResumoFinanceiroDaProposta = {
  linhas: LinhaFinanceiraDaProposta[]
  midia_tv: number
  midia_digital: number
  simulcast: number
  total_comercial: number
  producao: number
  direitos_tv: number
  direitos_digital: number
  direitos_total: number
  total_geral: number
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function periodoDaData(periodos: PeriodoEspecial[], data: string): PeriodoEspecial | null {
  return periodos.find((periodo) => data >= periodo.data_inicio && data <= periodo.data_fim) ?? null
}

function multiplicar(valor: number, quantidade: number): number {
  return arredondar(valor * quantidade)
}

function linhaNacional(
  programa: Programa,
  item: ItemParaResumoFinanceiro,
  periodos: PeriodoEspecial[],
): LinhaFinanceiraDaProposta {
  const periodo = periodoDaData(periodos, item.data)
  const percentual = periodo?.percentual_acrescimo ?? 0

  // Regra vigente: o acréscimo de período especial incide na mídia de TV.
  // Digital permanece com o preço cadastrado até definição comercial diversa.
  const midiaTvBase = programa.custo_midia_tv ?? 0
  const midiaTvUnit = percentual > 0 ? aplicarAcrescimo(midiaTvBase, percentual) : midiaTvBase
  const midiaDigitalUnit = programa.custo_midia_digital ?? 0
  const simulcastUnit = arredondar(midiaTvUnit * ((programa.percentual_simulcast ?? 0) / 100))
  const producaoUnit = arredondar((programa.custo_producao_tv ?? 0) + (programa.custo_producao_digital ?? 0))
  const direitosTvUnit = calcularDireitosTv(midiaTvUnit, programa.percentual_simulcast) ?? 0
  const direitosDigitalUnit = calcularDireitosDigital(midiaDigitalUnit) ?? 0

  const midiaTv = multiplicar(midiaTvUnit, item.quantidade)
  const midiaDigital = multiplicar(midiaDigitalUnit, item.quantidade)
  const simulcast = multiplicar(simulcastUnit, item.quantidade)
  const producao = multiplicar(producaoUnit, item.quantidade)
  const direitosTv = multiplicar(direitosTvUnit, item.quantidade)
  const direitosDigital = multiplicar(direitosDigitalUnit, item.quantidade)
  const totalComercial = arredondar(midiaTv + midiaDigital + simulcast)
  const direitosTotal = arredondar(direitosTv + direitosDigital)

  return {
    data: item.data,
    quantidade: item.quantidade,
    pracas: [],
    periodo_especial_nome: periodo?.nome ?? null,
    periodo_especial_percentual: percentual,
    midia_tv: midiaTv,
    midia_digital: midiaDigital,
    simulcast,
    total_comercial: totalComercial,
    producao,
    direitos_tv: direitosTv,
    direitos_digital: direitosDigital,
    direitos_total: direitosTotal,
    total_geral: arredondar(totalComercial + producao + direitosTotal),
  }
}

function linhaRegional(
  programa: Programa,
  item: ItemParaResumoFinanceiro,
  periodos: PeriodoEspecial[],
  precos: PrecoDePraca[],
): LinhaFinanceiraDaProposta {
  const periodo = periodoDaData(periodos, item.data)
  const percentual = periodo?.percentual_acrescimo ?? 0
  const selecionados = new Set(item.pracas)
  const precosSelecionados = precos.filter((preco) => selecionados.has(preco.praca_codigo))

  let midiaTvUnit = 0
  let midiaDigitalUnit = 0
  let simulcastUnit = 0
  let direitosTvUnit = 0
  let direitosDigitalUnit = 0

  for (const preco of precosSelecionados) {
    const tv = percentual > 0
      ? aplicarAcrescimo(preco.custo_midia_tv, percentual)
      : preco.custo_midia_tv
    const digital = preco.custo_midia_digital ?? 0
    const simulcast = arredondar(tv * ((preco.percentual_simulcast ?? 0) / 100))

    midiaTvUnit += tv
    midiaDigitalUnit += digital
    simulcastUnit += simulcast
    direitosTvUnit += calcularDireitosTv(tv, preco.percentual_simulcast) ?? 0
    direitosDigitalUnit += calcularDireitosDigital(digital) ?? 0
  }

  const midiaTv = multiplicar(arredondar(midiaTvUnit), item.quantidade)
  const midiaDigital = multiplicar(arredondar(midiaDigitalUnit), item.quantidade)
  const simulcast = multiplicar(arredondar(simulcastUnit), item.quantidade)
  // Produção regional é uma cobrança única por ação, independentemente de 1, 2 ou 3 praças.
  const producao = multiplicar(programa.custo_producao_regional ?? 0, item.quantidade)
  const direitosTv = multiplicar(arredondar(direitosTvUnit), item.quantidade)
  const direitosDigital = multiplicar(arredondar(direitosDigitalUnit), item.quantidade)
  const totalComercial = arredondar(midiaTv + midiaDigital + simulcast)
  const direitosTotal = arredondar(direitosTv + direitosDigital)

  return {
    data: item.data,
    quantidade: item.quantidade,
    pracas: [...item.pracas],
    periodo_especial_nome: periodo?.nome ?? null,
    periodo_especial_percentual: percentual,
    midia_tv: midiaTv,
    midia_digital: midiaDigital,
    simulcast,
    total_comercial: totalComercial,
    producao,
    direitos_tv: direitosTv,
    direitos_digital: direitosDigital,
    direitos_total: direitosTotal,
    total_geral: arredondar(totalComercial + producao + direitosTotal),
  }
}

export function calcularResumoFinanceiro(params: {
  programa: Programa
  modalidade: 'nacional' | 'regional'
  itens: ItemParaResumoFinanceiro[]
  periodosEspeciais: PeriodoEspecial[]
  precosRegionais?: PrecoDePraca[]
}): ResumoFinanceiroDaProposta {
  const linhas = params.itens.map((item) =>
    params.modalidade === 'regional'
      ? linhaRegional(params.programa, item, params.periodosEspeciais, params.precosRegionais ?? [])
      : linhaNacional(params.programa, item, params.periodosEspeciais),
  )

  const soma = (campo: keyof Pick<LinhaFinanceiraDaProposta,
    'midia_tv' | 'midia_digital' | 'simulcast' | 'total_comercial' | 'producao' |
    'direitos_tv' | 'direitos_digital' | 'direitos_total' | 'total_geral'>) =>
    arredondar(linhas.reduce((total, linha) => total + linha[campo], 0))

  return {
    linhas,
    midia_tv: soma('midia_tv'),
    midia_digital: soma('midia_digital'),
    simulcast: soma('simulcast'),
    total_comercial: soma('total_comercial'),
    producao: soma('producao'),
    direitos_tv: soma('direitos_tv'),
    direitos_digital: soma('direitos_digital'),
    direitos_total: soma('direitos_total'),
    total_geral: soma('total_geral'),
  }
}
