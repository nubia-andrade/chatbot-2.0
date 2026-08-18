import { aplicarAcrescimo, periodoEspecialEm, type PeriodoEspecial } from './datas-especiais'
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
  redes_sociais: number
  simulcast: number
  total_comercial: number
  producao_tv: number
  producao_digital: number
  producao_redes_sociais: number
  producao: number
  direitos_tv: number
  direitos_digital: number
  direitos_total: number
  total_geral: number
}

export type ResumoFinanceiroDaProposta = {
  linhas: LinhaFinanceiraDaProposta[]
  incluir_digital: boolean
  incluir_redes_sociais: boolean
  midia_tv: number
  midia_digital: number
  redes_sociais: number
  simulcast: number
  total_comercial: number
  producao_tv: number
  producao_digital: number
  producao_redes_sociais: number
  producao: number
  direitos_tv: number
  direitos_digital: number
  direitos_total: number
  total_geral: number
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function multiplicar(valor: number, quantidade: number): number {
  return arredondar(valor * quantidade)
}

function linhaNacional(
  programa: Programa,
  item: ItemParaResumoFinanceiro,
  periodos: PeriodoEspecial[],
  incluirDigital: boolean,
  incluirRedesSociais: boolean,
): LinhaFinanceiraDaProposta {
  const periodo = periodoEspecialEm(periodos, item.data)
  const percentual = periodo?.percentual_acrescimo ?? 0

  const midiaTvBase = programa.custo_midia_tv ?? 0
  const midiaTvUnit = percentual > 0 ? aplicarAcrescimo(midiaTvBase, percentual) : midiaTvBase
  const midiaDigitalUnit = incluirDigital ? (programa.custo_midia_digital ?? 0) : 0
  const redesSociaisUnit = incluirRedesSociais ? (programa.custo_midia_redes_sociais ?? 0) : 0
  const simulcastUnit = arredondar(midiaTvUnit * ((programa.percentual_simulcast ?? 0) / 100))
  const producaoTvUnit = programa.custo_producao_tv ?? 0
  const producaoDigitalUnit = incluirDigital ? (programa.custo_producao_digital ?? 0) : 0
  const producaoRedesUnit = incluirRedesSociais ? (programa.custo_producao_redes_sociais ?? 0) : 0
  const direitosTvUnit = calcularDireitosTv(midiaTvUnit, programa.percentual_simulcast) ?? 0
  const direitosDigitalUnit = incluirDigital ? (calcularDireitosDigital(midiaDigitalUnit) ?? 0) : 0

  const midiaTv = multiplicar(midiaTvUnit, item.quantidade)
  const midiaDigital = multiplicar(midiaDigitalUnit, item.quantidade)
  const redesSociais = multiplicar(redesSociaisUnit, item.quantidade)
  const simulcast = multiplicar(simulcastUnit, item.quantidade)
  const producaoTv = multiplicar(producaoTvUnit, item.quantidade)
  const producaoDigital = multiplicar(producaoDigitalUnit, item.quantidade)
  const producaoRedesSociais = multiplicar(producaoRedesUnit, item.quantidade)
  const producao = arredondar(producaoTv + producaoDigital + producaoRedesSociais)
  const direitosTv = multiplicar(direitosTvUnit, item.quantidade)
  const direitosDigital = multiplicar(direitosDigitalUnit, item.quantidade)
  const totalComercial = arredondar(midiaTv + midiaDigital + redesSociais + simulcast)
  const direitosTotal = arredondar(direitosTv + direitosDigital)

  return {
    data: item.data,
    quantidade: item.quantidade,
    pracas: [],
    periodo_especial_nome: periodo?.nome ?? null,
    periodo_especial_percentual: percentual,
    midia_tv: midiaTv,
    midia_digital: midiaDigital,
    redes_sociais: redesSociais,
    simulcast,
    total_comercial: totalComercial,
    producao_tv: producaoTv,
    producao_digital: producaoDigital,
    producao_redes_sociais: producaoRedesSociais,
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
  incluirDigital: boolean,
  incluirRedesSociais: boolean,
): LinhaFinanceiraDaProposta {
  const periodo = periodoEspecialEm(periodos, item.data)
  const percentual = periodo?.percentual_acrescimo ?? 0
  const selecionados = new Set(item.pracas)
  const precosSelecionados = precos.filter((preco) => selecionados.has(preco.praca_codigo))

  let midiaTvUnit = 0
  let midiaDigitalUnit = 0
  let simulcastUnit = 0
  let direitosTvUnit = 0
  let direitosDigitalUnit = 0

  for (const preco of precosSelecionados) {
    const tv = percentual > 0 ? aplicarAcrescimo(preco.custo_midia_tv, percentual) : preco.custo_midia_tv
    const digital = incluirDigital ? (preco.custo_midia_digital ?? 0) : 0
    const simulcast = arredondar(tv * ((preco.percentual_simulcast ?? 0) / 100))

    midiaTvUnit += tv
    midiaDigitalUnit += digital
    simulcastUnit += simulcast
    direitosTvUnit += calcularDireitosTv(tv, preco.percentual_simulcast) ?? 0
    direitosDigitalUnit += incluirDigital ? (calcularDireitosDigital(digital) ?? 0) : 0
  }

  const midiaTv = multiplicar(arredondar(midiaTvUnit), item.quantidade)
  const midiaDigital = multiplicar(arredondar(midiaDigitalUnit), item.quantidade)
  const redesSociais = multiplicar(incluirRedesSociais ? (programa.custo_midia_redes_sociais ?? 0) : 0, item.quantidade)
  const simulcast = multiplicar(arredondar(simulcastUnit), item.quantidade)
  const producaoTv = multiplicar(programa.custo_producao_regional ?? 0, item.quantidade)
  const producaoDigital = 0
  const producaoRedesSociais = multiplicar(incluirRedesSociais ? (programa.custo_producao_redes_sociais ?? 0) : 0, item.quantidade)
  const producao = arredondar(producaoTv + producaoRedesSociais)
  const direitosTv = multiplicar(arredondar(direitosTvUnit), item.quantidade)
  const direitosDigital = multiplicar(arredondar(direitosDigitalUnit), item.quantidade)
  const totalComercial = arredondar(midiaTv + midiaDigital + redesSociais + simulcast)
  const direitosTotal = arredondar(direitosTv + direitosDigital)

  return {
    data: item.data,
    quantidade: item.quantidade,
    pracas: [...item.pracas],
    periodo_especial_nome: periodo?.nome ?? null,
    periodo_especial_percentual: percentual,
    midia_tv: midiaTv,
    midia_digital: midiaDigital,
    redes_sociais: redesSociais,
    simulcast,
    total_comercial: totalComercial,
    producao_tv: producaoTv,
    producao_digital: producaoDigital,
    producao_redes_sociais: producaoRedesSociais,
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
  incluirDigital?: boolean
  incluirRedesSociais?: boolean
}): ResumoFinanceiroDaProposta {
  const incluirDigital = Boolean(params.incluirDigital && params.programa.contem_digital)
  const incluirRedesSociais = Boolean(params.incluirRedesSociais && params.programa.redes_sociais)

  const linhas = params.itens.map((item) =>
    params.modalidade === 'regional'
      ? linhaRegional(params.programa, item, params.periodosEspeciais, params.precosRegionais ?? [], incluirDigital, incluirRedesSociais)
      : linhaNacional(params.programa, item, params.periodosEspeciais, incluirDigital, incluirRedesSociais),
  )

  const soma = (campo: keyof Pick<LinhaFinanceiraDaProposta,
    'midia_tv' | 'midia_digital' | 'redes_sociais' | 'simulcast' | 'total_comercial' |
    'producao_tv' | 'producao_digital' | 'producao_redes_sociais' | 'producao' |
    'direitos_tv' | 'direitos_digital' | 'direitos_total' | 'total_geral'>) =>
    arredondar(linhas.reduce((total, linha) => total + linha[campo], 0))

  return {
    linhas,
    incluir_digital: incluirDigital,
    incluir_redes_sociais: incluirRedesSociais,
    midia_tv: soma('midia_tv'),
    midia_digital: soma('midia_digital'),
    redes_sociais: soma('redes_sociais'),
    simulcast: soma('simulcast'),
    total_comercial: soma('total_comercial'),
    producao_tv: soma('producao_tv'),
    producao_digital: soma('producao_digital'),
    producao_redes_sociais: soma('producao_redes_sociais'),
    producao: soma('producao'),
    direitos_tv: soma('direitos_tv'),
    direitos_digital: soma('direitos_digital'),
    direitos_total: soma('direitos_total'),
    total_geral: soma('total_geral'),
  }
}
