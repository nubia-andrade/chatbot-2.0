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
  criado_em?: string
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

export type PontoEvolucaoMensal = {
  mes: string
  rotulo: string
  ofertado: number
  vendido: number
  propostas: number
  fechadas: number
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

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

function chaveMes(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  return `${MESES_PT[mes - 1]}/${String(ano).slice(-2)}`
}

/**
 * Evolução por mês de CRIAÇÃO da proposta vigente.
 *
 * Ofertado = Total Comercial da versão vigente criada naquele mês.
 * Vendido = Valor Final Negociado das propostas Fechadas, atribuído ao mês em
 * que a proposta foi criada (não ao mês do fechamento), conforme a leitura
 * comercial da Home.
 */
export function calcularEvolucaoMensal<T extends LinhaParaPerformance>(
  linhas: T[],
  referencia: Date = new Date(),
  quantidadeMeses = 12,
): PontoEvolucaoMensal[] {
  const quantidade = Math.max(1, Math.trunc(quantidadeMeses))
  const referenciaUtc = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1))
  const meses: PontoEvolucaoMensal[] = []
  const porMes = new Map<string, PontoEvolucaoMensal>()

  for (let deslocamento = quantidade - 1; deslocamento >= 0; deslocamento -= 1) {
    const data = new Date(Date.UTC(
      referenciaUtc.getUTCFullYear(),
      referenciaUtc.getUTCMonth() - deslocamento,
      1,
    ))
    const mes = chaveMes(data)
    const ponto: PontoEvolucaoMensal = {
      mes,
      rotulo: rotuloMes(mes),
      ofertado: 0,
      vendido: 0,
      propostas: 0,
      fechadas: 0,
    }
    meses.push(ponto)
    porMes.set(mes, ponto)
  }

  for (const linha of linhas) {
    if (!linha.criado_em) continue
    const mes = linha.criado_em.slice(0, 7)
    const ponto = porMes.get(mes)
    if (!ponto) continue

    ponto.ofertado = arredondar(ponto.ofertado + Number(linha.valor_total_comercial || 0))
    ponto.propostas += 1

    if (linha.negociacao_status === 'fechada') {
      ponto.vendido = arredondar(
        ponto.vendido + Number(linha.valor_final_negociado ?? linha.valor_total_comercial ?? 0),
      )
      ponto.fechadas += 1
    }
  }

  return meses
}
