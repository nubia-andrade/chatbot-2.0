import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'
import {
  calcularMetricasPerformance,
  selecionarVersoesAtuais,
  type LinhaParaPerformance,
  type MetricasPerformance,
} from '../dominio/performance-propostas'
import type { StatusNegociacao } from './propostas'

export type { MetricasPerformance } from '../dominio/performance-propostas'

type LinhaPerformance = LinhaParaPerformance & {
  usuario_id: string
  marca_nome: string | null
  programa_id: string | null
  programa_nome: string
  criado_em: string
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
  const atuaisExecutivo = selecionarVersoesAtuais(dadosExecutivo.linhas)
  const atuaisProgramas = selecionarVersoesAtuais(dadosProgramas.linhas)
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
      metricasMes: calcularMetricasPerformance(mesExecutivo),
      recentes: recentes(atuaisExecutivo),
    } : null,
    programas: temPapelConsultor || proprietario ? {
      metricasMes: calcularMetricasPerformance(mesProgramas),
      porPrograma: [...grupos.values()]
        .map((linhas) => ({
          programaId: linhas[0]?.programa_id ?? null,
          programaNome: linhas[0]?.programa_nome ?? 'Programa',
          metricas: calcularMetricasPerformance(linhas),
        }))
        .sort((a, b) => b.metricas.valorProposto - a.metricas.valorProposto),
      recentes: recentes(atuaisProgramas),
    } : null,
  }
}
