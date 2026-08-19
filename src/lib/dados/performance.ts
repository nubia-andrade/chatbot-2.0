import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'
import { listarProgramas } from './programas'
import {
  calcularEvolucaoMensal,
  calcularMetricasPerformance,
  calcularRankingExecutivos,
  selecionarVersoesAtuais,
  type ItemRankingExecutivo,
  type LinhaExecutivoPerformance,
  type MetricasPerformance,
  type PontoEvolucaoMensal,
} from '../dominio/performance-propostas'
import type { StatusNegociacao } from './propostas'

export type { ItemRankingExecutivo, MetricasPerformance, PontoEvolucaoMensal } from '../dominio/performance-propostas'

export type ItemAtencaoPerformance = {
  tipo: 'alerta' | 'info' | 'sucesso'
  titulo: string
  detalhe: string
}

type LinhaPerformance = LinhaExecutivoPerformance & {
  marca_nome: string | null
  programa_id: string | null
  programa_nome: string
  criado_em: string
  email_status: string | null
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
  programaId: string
  programaNome: string
  metricasMes: MetricasPerformance
  evolucao12Meses: PontoEvolucaoMensal[]
  ranking: ItemRankingExecutivo[]
  recentes: PropostaRecente[]
  atencoes: ItemAtencaoPerformance[]
}

export type PerformanceInicio = {
  schemaDisponivel: boolean
  executivo: {
    metricasMes: MetricasPerformance
    evolucao12Meses: PontoEvolucaoMensal[]
    recentes: PropostaRecente[]
    atencoes: ItemAtencaoPerformance[]
  } | null
  programas: {
    metricasMes: MetricasPerformance
    evolucao12Meses: PontoEvolucaoMensal[]
    ranking: ItemRankingExecutivo[]
    porPrograma: PerformancePrograma[]
    recentes: PropostaRecente[]
    atencoes: ItemAtencaoPerformance[]
  } | null
}

const CAMPOS = 'id, usuario_id, executivo_nome, marca_nome, cliente_id, cliente_nome, programa_id, programa_nome, modalidade, inclui_digital, inclui_redes_sociais, valor_total_comercial, valor_final_negociado, negociacao_status, grupo_versao_id, versao, criado_em, status, email_status'

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

function atencoes(linhas: LinhaPerformance[], diasSemMovimento: number): ItemAtencaoPerformance[] {
  const agora = Date.now()
  const limite = diasSemMovimento * 24 * 60 * 60 * 1000
  const antigas = linhas.filter((linha) =>
    linha.negociacao_status === 'em_negociacao'
    && agora - new Date(linha.criado_em).getTime() >= limite,
  ).length
  const falhasEmail = linhas.filter((linha) => linha.email_status === 'falha').length

  const itens: ItemAtencaoPerformance[] = []
  if (antigas > 0) {
    itens.push({
      tipo: 'alerta',
      titulo: `${antigas} proposta${antigas === 1 ? '' : 's'} há mais de ${diasSemMovimento} dias em negociação`,
      detalhe: 'Vale revisar o andamento comercial e atualizar o status quando houver decisão.',
    })
  }
  if (falhasEmail > 0) {
    itens.push({
      tipo: 'alerta',
      titulo: `${falhasEmail} envio${falhasEmail === 1 ? '' : 's'} de e-mail com falha`,
      detalhe: 'O PDF continua válido. Abra Propostas para reenviar quando necessário.',
    })
  }
  if (itens.length === 0) {
    itens.push({
      tipo: 'sucesso',
      titulo: 'Sem pendências críticas neste momento',
      detalhe: 'As propostas vigentes não têm alertas de prazo ou falha de distribuição.',
    })
  }
  return itens
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
    const schemaIndisponivel = texto.includes('negociacao_status')
      || texto.includes('grupo_versao_id')
      || texto.includes('executivo_nome')
      || texto.includes('could not find')
    if (!schemaIndisponivel) console.error('Falha ao carregar performance:', error.message)
    return { linhas: [], schemaDisponivel: !schemaIndisponivel }
  }

  return { linhas: (data ?? []) as unknown as LinhaPerformance[], schemaDisponivel: true }
}

function montarPerformancePrograma(
  programaId: string,
  programaNome: string,
  linhas: LinhaPerformance[],
  inicioMes: string,
): PerformancePrograma {
  const mes = linhas.filter((linha) => linha.criado_em >= inicioMes)
  return {
    programaId,
    programaNome,
    metricasMes: calcularMetricasPerformance(mes),
    evolucao12Meses: calcularEvolucaoMensal(linhas),
    ranking: calcularRankingExecutivos(mes),
    recentes: recentes(linhas),
    atencoes: atencoes(linhas, 15),
  }
}

export async function carregarPerformanceInicio(): Promise<PerformanceInicio> {
  const sessao = await obterSessao()
  if (!sessao) return { schemaDisponivel: true, executivo: null, programas: null }

  const temPapelExecutivo = temPerfil(sessao.perfis, 'executivo') || temPerfil(sessao.perfis, 'executivo_regional')
  const temPapelConsultor = temPerfil(sessao.perfis, 'consultor_programa')
  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const temVisaoProgramas = temPapelConsultor || proprietario

  const [dadosExecutivo, dadosProgramas, programasCadastrados] = await Promise.all([
    temPapelExecutivo ? consultarLinhas({ usuarioId: sessao.usuarioId }) : Promise.resolve({ linhas: [], schemaDisponivel: true }),
    temVisaoProgramas
      ? consultarLinhas(proprietario ? {} : { programas: sessao.programasVinculados })
      : Promise.resolve({ linhas: [], schemaDisponivel: true }),
    temVisaoProgramas ? listarProgramas() : Promise.resolve([]),
  ])

  const inicioMes = inicioDoMesAtual()
  const atuaisExecutivo = selecionarVersoesAtuais(dadosExecutivo.linhas) as LinhaPerformance[]
  const atuaisProgramas = selecionarVersoesAtuais(dadosProgramas.linhas) as LinhaPerformance[]
  const mesExecutivo = atuaisExecutivo.filter((linha) => linha.criado_em >= inicioMes)
  const mesProgramas = atuaisProgramas.filter((linha) => linha.criado_em >= inicioMes)

  const programasPermitidos = programasCadastrados
    .filter((programa) => proprietario || sessao.programasVinculados.includes(programa.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const porPrograma = programasPermitidos.map((programa) => {
    const linhas = atuaisProgramas.filter((linha) => linha.programa_id === programa.id)
    return montarPerformancePrograma(programa.id, programa.nome, linhas, inicioMes)
  })

  return {
    schemaDisponivel: dadosExecutivo.schemaDisponivel && dadosProgramas.schemaDisponivel,
    executivo: temPapelExecutivo ? {
      metricasMes: calcularMetricasPerformance(mesExecutivo),
      evolucao12Meses: calcularEvolucaoMensal(atuaisExecutivo),
      recentes: recentes(atuaisExecutivo),
      atencoes: atencoes(atuaisExecutivo, 10),
    } : null,
    programas: temVisaoProgramas ? {
      metricasMes: calcularMetricasPerformance(mesProgramas),
      evolucao12Meses: calcularEvolucaoMensal(atuaisProgramas),
      ranking: calcularRankingExecutivos(mesProgramas),
      porPrograma,
      recentes: recentes(atuaisProgramas),
      atencoes: atencoes(atuaisProgramas, 15),
    } : null,
  }
}
