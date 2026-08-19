import type { StatusNegociacao } from '../dados/propostas'

export type LinhaParaPerformance = {
  id: string
  cliente_id: string | null
  cliente_nome: string
  modalidade: 'nacional' | 'regional'
  inclui_digital: boolean
  inclui_redes_sociais: boolean
  valor_total_comercial: number
  valor_final_negociado: number | null
  negociacao_status: StatusNegociacao
  grupo_versao_id: string
  versao: number
  status: string
}

export type MetricasPerformance = {
  propostas: number
  valorProposto: number
  clientes: number
  ticketMedio: number
  emNegociacao: number
  fechadas: number
  perdidas: number
  canceladas: number
  valorFechado: number
  conversao: number | null
  percentualDigital: number
  percentualRedes: number
  nacionais: number
  regionais: number
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** Mantém apenas a versão mais alta de cada família e documentos válidos. */
export function selecionarVersoesAtuais<T extends LinhaParaPerformance>(linhas: T[]): T[] {
  const porGrupo = new Map<string, T>()
  for (const linha of linhas) {
    const atual = porGrupo.get(linha.grupo_versao_id)
    if (!atual || linha.versao > atual.versao) porGrupo.set(linha.grupo_versao_id, linha)
  }

  return [...porGrupo.values()].filter(
    (linha) => linha.negociacao_status !== 'substituida' && linha.status !== 'falha' && linha.status !== 'gerando',
  )
}

/**
 * Conversão = Fechadas / (Fechadas + Perdidas).
 * Em negociação não entra no denominador porque ainda não houve decisão.
 */
export function calcularMetricasPerformance<T extends LinhaParaPerformance>(linhas: T[]): MetricasPerformance {
  const propostas = linhas.length
  const valorProposto = arredondar(linhas.reduce((total, linha) => total + Number(linha.valor_total_comercial || 0), 0))
  const clientes = new Set(linhas.map((linha) => linha.cliente_id ?? linha.cliente_nome)).size
  const fechadas = linhas.filter((linha) => linha.negociacao_status === 'fechada')
  const perdidas = linhas.filter((linha) => linha.negociacao_status === 'perdida')
  const decididas = fechadas.length + perdidas.length

  return {
    propostas,
    valorProposto,
    clientes,
    ticketMedio: propostas > 0 ? arredondar(valorProposto / propostas) : 0,
    emNegociacao: linhas.filter((linha) => linha.negociacao_status === 'em_negociacao').length,
    fechadas: fechadas.length,
    perdidas: perdidas.length,
    canceladas: linhas.filter((linha) => linha.negociacao_status === 'cancelada').length,
    valorFechado: arredondar(fechadas.reduce((total, linha) => total + Number(linha.valor_final_negociado ?? linha.valor_total_comercial ?? 0), 0)),
    conversao: decididas > 0 ? Math.round((fechadas.length / decididas) * 1000) / 10 : null,
    percentualDigital: propostas > 0 ? Math.round((linhas.filter((linha) => linha.inclui_digital).length / propostas) * 100) : 0,
    percentualRedes: propostas > 0 ? Math.round((linhas.filter((linha) => linha.inclui_redes_sociais).length / propostas) * 100) : 0,
    nacionais: linhas.filter((linha) => linha.modalidade === 'nacional').length,
    regionais: linhas.filter((linha) => linha.modalidade === 'regional').length,
  }
}
