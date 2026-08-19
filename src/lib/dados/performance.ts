import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'
import type { StatusNegociacao } from './propostas'

type LinhaPerformance = {
  id: string
  usuario_id: string
  marca_nome: string | null
  cliente_id: string | null
  cliente_nome: string
  programa_id: string | null
  programa_nome: string
  modalidade: 'nacional' | 'regional'
  inclui_digital: boolean
  inclui_redes_sociais: boolean
  valor_total_comercial: number
  valor_final_negociado: number | null
  negociacao_status: StatusNegociacao
  grupo_versao_id: string
  versao: number
  criado_em: string
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

export type PropostaRecente = {
  id: string
  marca: string
  cliente: string
  programa: string
  valor: number
  status: StatusNegociacao
  versao: number
  criadoEm: string
}

export type PerformancePrograma = {
  programaId: string | null
  programaNome: string
  metricas: MetricasPerformance
}

export type PerformanceInicio = {
  schemaDisponivel: boolean
  executivo: {
    metricasMes: MetricasPerformance
    recentes: PropostaRecente[]
  } | null
  programas: {
    metricasMes: MetricasPerformance
    porPrograma: PerformancePrograma[]
    recentes: PropostaRecente[]
  } | null
}

const CAMPOS = 'id, usuario_id, marca_nome, cliente_id, cliente_nome, programa_id, programa_nome, modalidade, inclui_digital, inclui_redes_sociais, valor_total_comercial, valor_final_negociado, negociacao_status, grupo_versao_id, versao, criado_em, status'

function inicioDoMesAtual(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
}

function versoesAtuais(linhas: LinhaPerformance[]): LinhaPerformance[] {
  const porGrupo = new Map<string, LinhaPerformance>()
  for (const linha of linhas) {
    const atual = porGrupo.get(linha.grupo_versao_id)
    if (!atual || linha.versao > atual.versao) porGrupo.set(linha.grupo_versao_id, linha)
  }
  return [...porGrupo.values()].filter((linha) => linha.negociacao_status !== 'substituida' && linha.status !== 'falha' && linha.status !== 'gerando')
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function metricas(linhas: LinhaPerformance[]): MetricasPerformance {
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

function recentes(linhas: LinhaPerformance[]): PropostaRecente[] {
  return [...linhas]
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .slice(0, 6)
    .map((linha) => ({
      id: linha.id,
      marca: linha.marca_nome ?? linha.cliente_nome,
      cliente: linha.cliente_nome,
      programa: linha.programa_nome,
      valor: Number(linha.valor_total_comercial || 0),
      status: linha.negociacao_status,
      versao: linha.versao,
      criadoEm: linha.criado_em,
    }))
}

async function consultarLinhas(params: {
  usuarioId?: string
  programas?: string[]
}): Promise<{ linhas: LinhaPerformance[]; schemaDisponivel: boolean }> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('propostas')
    .select(CAMPOS)
    .order('criado_em', { ascending: false })
    .limit(1000)

  if (params.usuarioId) consulta = consulta.eq('usuario_id', params.usuarioId)
  if (params.programas) {
    if (params.programas.length === 0) return { linhas: [], schemaDisponivel: true }
    consulta = consulta.in('programa_id', params.programas)
  }

  const { data, error } = await consulta
  if (error) {
    const texto = error.message.toLowerCase()
    const schemaIndisponivel = texto.includes('negociacao_status') || texto.includes('grupo_versao_id') || texto.includes('could not find')
    if (!schemaIndisponivel) console.error('Falha ao carregar performance:', error.message)
    return { linhas: [], schemaDisponivel: !schemaIndisponivel }
  }

  return { linhas: (data ?? []) as unknown as LinhaPerformance[], schemaDisponivel: true }
}

export async function carregarPerformanceInicio(): Promise<PerformanceInicio> {
  const sessao = await obterSessao()
  if (!sessao) return { schemaDisponivel: true, executivo: null, programas: null }

  const temPapelExecutivo = temPerfil(sessao.perfis, 'executivo') || temPerfil(sessao.perfis, 'executivo_regional')
  const temPapelConsultor = temPerfil(sessao.perfis, 'consultor_programa')
  const proprietario = temPerfil(sessao.perfis, 'proprietario')

  const [dadosExecutivo, dadosProgramas] = await Promise.all([
    temPapelExecutivo ? consultarLinhas({ usuarioId: sessao.usuarioId }) : Promise.resolve({ linhas: [], schemaDisponivel: true }),
    temPapelConsultor || proprietario
      ? consultarLinhas(proprietario ? {} : { programas: sessao.programasVinculados })
      : Promise.resolve({ linhas: [], schemaDisponivel: true }),
  ])

  const inicioMes = inicioDoMesAtual()
  const atuaisExecutivo = versoesAtuais(dadosExecutivo.linhas)
  const atuaisProgramas = versoesAtuais(dadosProgramas.linhas)
  const mesExecutivo = atuaisExecutivo.filter((linha) => linha.criado_em >= inicioMes)
  const mesProgramas = atuaisProgramas.filter((linha) => linha.criado_em >= inicioMes)

  const grupos = new Map<string, LinhaPerformance[]>()
  for (const linha of mesProgramas) {
    const chave = linha.programa_id ?? linha.programa_nome
    const grupo = grupos.get(chave) ?? []
    grupo.push(linha)
    grupos.set(chave, grupo)
  }

  return {
    schemaDisponivel: dadosExecutivo.schemaDisponivel && dadosProgramas.schemaDisponivel,
    executivo: temPapelExecutivo ? {
      metricasMes: metricas(mesExecutivo),
      recentes: recentes(atuaisExecutivo),
    } : null,
    programas: temPapelConsultor || proprietario ? {
      metricasMes: metricas(mesProgramas),
      porPrograma: [...grupos.values()]
        .map((linhas) => ({
          programaId: linhas[0]?.programa_id ?? null,
          programaNome: linhas[0]?.programa_nome ?? 'Programa',
          metricas: metricas(linhas),
        }))
        .sort((a, b) => b.metricas.valorProposto - a.metricas.valorProposto),
      recentes: recentes(atuaisProgramas),
    } : null,
  }
}
