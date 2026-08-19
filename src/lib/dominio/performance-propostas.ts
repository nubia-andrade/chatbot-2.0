import type { StatusNegociacao, StatusAprovacaoDaProposta } from '../dados/propostas'

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
  aprovacao_status?: StatusAprovacaoDaProposta
  criado_em?: string
}

export type LinhaExecutivoPerformance = LinhaParaPerformance & { usuario_id: string; executivo_nome?: string | null }
export type MetricasPerformance = { propostas: number; valorProposto: number; clientes: number; ticketMedio: number; emNegociacao: number; fechadas: number; perdidas: number; canceladas: number; valorFechado: number; conversao: number | null; percentualDigital: number; percentualRedes: number; nacionais: number; regionais: number }
export type PontoEvolucaoMensal = { mes: string; rotulo: string; ofertado: number; vendido: number; propostas: number; fechadas: number }
export type ItemRankingExecutivo = { usuarioId: string; nome: string; metricas: MetricasPerformance }

function arredondar(valor: number): number { return Math.round((valor + Number.EPSILON) * 100) / 100 }
function comercialmenteValida(linha: LinhaParaPerformance): boolean {
  const aprovacaoValida = !linha.aprovacao_status || linha.aprovacao_status === 'nao_requerida' || linha.aprovacao_status === 'aprovada'
  return linha.negociacao_status !== 'substituida' && linha.status !== 'falha' && linha.status !== 'gerando' && aprovacaoValida
}

/**
 * Escolhe a versão mais alta ENTRE as versões comercialmente válidas.
 * Assim uma v2 pendente/rejeitada não apaga dos KPIs a v1 que continua aprovada.
 */
export function selecionarVersoesAtuais<T extends LinhaParaPerformance>(linhas: T[]): T[] {
  const porGrupo = new Map<string, T>()
  for (const linha of linhas) {
    if (!comercialmenteValida(linha)) continue
    const atual = porGrupo.get(linha.grupo_versao_id)
    if (!atual || linha.versao > atual.versao) porGrupo.set(linha.grupo_versao_id, linha)
  }
  return [...porGrupo.values()]
}

/** Conversão = Fechadas / (Fechadas + Perdidas). */
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

export function calcularRankingExecutivos<T extends LinhaExecutivoPerformance>(linhas: T[]): ItemRankingExecutivo[] {
  const porExecutivo = new Map<string, T[]>()
  for (const linha of linhas) { const grupo = porExecutivo.get(linha.usuario_id) ?? []; grupo.push(linha); porExecutivo.set(linha.usuario_id, grupo) }
  return [...porExecutivo.entries()].map(([usuarioId, propostas]) => ({ usuarioId, nome: propostas.find((linha) => linha.executivo_nome?.trim())?.executivo_nome?.trim() || 'Executivo', metricas: calcularMetricasPerformance(propostas) })).sort((a, b) => {
    const vendido = b.metricas.valorFechado - a.metricas.valorFechado
    if (vendido !== 0) return vendido
    const ofertado = b.metricas.valorProposto - a.metricas.valorProposto
    if (ofertado !== 0) return ofertado
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
function chaveMes(data: Date): string { return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}` }
function rotuloMes(chave: string): string { const [ano, mes] = chave.split('-').map(Number); return `${MESES_PT[mes - 1]}/${String(ano).slice(-2)}` }

export function calcularEvolucaoMensal<T extends LinhaParaPerformance>(linhas: T[], referencia: Date = new Date(), quantidadeMeses = 12): PontoEvolucaoMensal[] {
  const quantidade = Math.max(1, Math.trunc(quantidadeMeses))
  const referenciaUtc = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1))
  const meses: PontoEvolucaoMensal[] = []
  const porMes = new Map<string, PontoEvolucaoMensal>()
  for (let deslocamento = quantidade - 1; deslocamento >= 0; deslocamento -= 1) {
    const data = new Date(Date.UTC(referenciaUtc.getUTCFullYear(), referenciaUtc.getUTCMonth() - deslocamento, 1))
    const mes = chaveMes(data)
    const ponto: PontoEvolucaoMensal = { mes, rotulo: rotuloMes(mes), ofertado: 0, vendido: 0, propostas: 0, fechadas: 0 }
    meses.push(ponto); porMes.set(mes, ponto)
  }
  for (const linha of linhas) {
    if (!linha.criado_em) continue
    const ponto = porMes.get(linha.criado_em.slice(0, 7))
    if (!ponto) continue
    ponto.ofertado = arredondar(ponto.ofertado + Number(linha.valor_total_comercial || 0)); ponto.propostas += 1
    if (linha.negociacao_status === 'fechada') { ponto.vendido = arredondar(ponto.vendido + Number(linha.valor_final_negociado ?? linha.valor_total_comercial ?? 0)); ponto.fechadas += 1 }
  }
  return meses
}
