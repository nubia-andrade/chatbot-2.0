import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterPrograma, listarApelidos } from './programas'
import { listarDatasBloqueadas } from './datas-bloqueadas'
import { listarDatasEspeciais } from './datas-especiais'
import { listarAcoesRegionais, listarPrecos, type PrecoDePraca } from './regional'
import { lerPaginado } from './paginacao'
import { montarMapa } from '../dominio/formatos'
import { indexarAnunciantes, type ClienteClassificado } from '../dominio/casamento-anunciante'
import {
  calcularDisponibilidadeDoMes,
  diasDoMes,
  type DiaDeDisponibilidade,
  type InsumosDeDisponibilidade,
  type Modalidade,
  type ProgramaParaDisponibilidade,
} from '../dominio/disponibilidade'
import type { Programa } from '../dominio/cadastro'

/**
 * `carregarDisponibilidade` — a ÚNICA função do sistema que vai ao banco para
 * montar o calendário. Um dia da grade depende de seis fontes (programa,
 * cliente, ações vendidas, formatos, bloqueios, datas especiais, ações
 * regionais, preços regionais e a carteira inteira para o índice de
 * anunciantes) — o front-end não deve saber disso, só chamar esta função uma
 * vez por mês exibido.
 *
 * Todas as leituras do mês corrente rodam em paralelo (`Promise.all`); nunca
 * uma consulta por célula.
 */

export type ResultadoDeDisponibilidade = {
  dias: DiaDeDisponibilidade[]
  /** `null` quando `erro` está preenchido — programa ou cliente inexistente. */
  programa: Programa | null
  erro: string | null
  /**
   * As 5 praças com preço, cruas — quem grava uma consulta regional precisa
   * recalcular o preço só das praças EFETIVAMENTE compradas
   * (`calcularCustoDaAcaoRegional`), nunca reaproveitar `dia.valor_unitario`
   * (que é o preço de levar TODAS as praças livres daquele dia — correto
   * para pintar a célula do calendário, errado para gravar um retrato).
   * Vazio quando `erro` está preenchido.
   */
  precosRegionais: PrecoDePraca[]
}

type LinhaDeCliente = {
  id: string
  nome: string
  setor: string | null
  industria: string | null
}

type LinhaDeAcaoVendida = {
  programa: string
  data_de_exibicao: string
  formato: string | null
  anunciante: string | null
}

type LinhaDeFormato = { formato: string; categoria: string }

function paraProgramaDeDisponibilidade(programa: Programa): ProgramaParaDisponibilidade {
  return {
    id: programa.id,
    mnemonico: programa.mnemonico,
    dias_da_semana: programa.dias_da_semana,
    slots: programa.slots,
    bloqueio_mensal: programa.bloqueio_mensal,
    prazo_minimo_dias: programa.prazo_minimo_dias,
    custo_midia_tv: programa.custo_midia_tv,
    custo_producao_tv: programa.custo_producao_tv,
    percentual_simulcast: programa.percentual_simulcast,
    aceita_regional: programa.aceita_regional,
    dia_da_semana_regional: programa.dia_da_semana_regional,
    prazo_minimo_regional_dias: programa.prazo_minimo_regional_dias,
    max_pracas_por_acao: programa.max_pracas_por_acao,
    custo_producao_regional: programa.custo_producao_regional,
    // Domínio exige número; cadastro permite nulo enquanto a área não
    // informou o teto regional do programa. Sem teto = mês nunca fecha (a
    // mesma leitura de "0 desliga o teto" que `bloqueio_mensal` já usa).
    bloqueio_mensal_regional: programa.bloqueio_mensal_regional ?? 0,
  }
}

const ERRO_PROGRAMA = 'Programa não encontrado.'
const ERRO_CLIENTE = 'Cliente não encontrado.'
const ERRO_CARREGAMENTO = 'Não foi possível carregar a disponibilidade. Tente novamente.'

export async function carregarDisponibilidade(params: {
  programaId: string
  clienteId: string
  modalidade: Modalidade
  ano: number
  mes: number
}): Promise<ResultadoDeDisponibilidade> {
  const { programaId, clienteId, modalidade, ano, mes } = params

  const programa = await obterPrograma(programaId)
  if (!programa) {
    return { dias: [], programa: null, erro: ERRO_PROGRAMA, precosRegionais: [] }
  }

  const supabase = await criarClienteServidor()
  const dias = diasDoMes(ano, mes)
  const primeiroDia = dias[0]
  const ultimoDia = dias[dias.length - 1]

  const [
    respostaCliente,
    respostaAcoesVendidas,
    respostaFormatos,
    bloqueios,
    periodosEspeciais,
    acoesRegionais,
    precosRegionais,
    apelidos,
    leituraDeCarteira,
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, setor, industria')
      .eq('id', clienteId)
      .maybeSingle(),
    supabase
      .from('acoes_vendidas')
      .select('programa, data_de_exibicao, formato, anunciante')
      .gte('data_de_exibicao', primeiroDia)
      .lte('data_de_exibicao', ultimoDia),
    supabase.from('formatos').select('formato, categoria'),
    listarDatasBloqueadas(programaId),
    listarDatasEspeciais(programaId),
    listarAcoesRegionais(programaId, primeiroDia, ultimoDia),
    listarPrecos(programaId),
    listarApelidos(programaId),
    // A carteira inteira (15.519 linhas) para o índice de anunciantes — só
    // nome, setor e indústria, e paginada porque o PostgREST corta em 1000.
    lerPaginado<ClienteClassificado>((de, ate) =>
      supabase.from('clientes').select('nome, setor, industria').range(de, ate),
    ),
  ])

  if (respostaCliente.error) {
    console.error('Falha ao carregar cliente da consulta:', respostaCliente.error.message)
    return { dias: [], programa: null, erro: ERRO_CARREGAMENTO, precosRegionais: [] }
  }
  const cliente = respostaCliente.data as LinhaDeCliente | null
  if (!cliente) {
    return { dias: [], programa: null, erro: ERRO_CLIENTE, precosRegionais: [] }
  }

  if (respostaAcoesVendidas.error) {
    console.error('Falha ao carregar ações vendidas do mês:', respostaAcoesVendidas.error.message)
  }
  if (respostaFormatos.error) {
    console.error('Falha ao carregar formatos:', respostaFormatos.error.message)
  }
  if (leituraDeCarteira.erro) {
    console.error('Falha ao carregar a carteira de clientes:', leituraDeCarteira.erro)
  }

  const acoesVendidas = (respostaAcoesVendidas.data ?? []) as LinhaDeAcaoVendida[]
  const formatosLinhas = (respostaFormatos.data ?? []) as LinhaDeFormato[]

  const insumos: InsumosDeDisponibilidade = {
    ano,
    mes,
    hojeIso: new Date().toISOString().slice(0, 10),
    modalidade,
    programa: paraProgramaDeDisponibilidade(programa),
    cliente: { nome: cliente.nome, setor: cliente.setor, industria: cliente.industria },
    formatos: montarMapa(formatosLinhas),
    acoesVendidas: acoesVendidas.map((acao) => ({
      programa: acao.programa,
      data_de_exibicao: acao.data_de_exibicao,
      formato: acao.formato ?? '',
      anunciante: acao.anunciante,
    })),
    acoesRegionais,
    bloqueios,
    periodosEspeciais,
    indiceDeAnunciantes: indexarAnunciantes(leituraDeCarteira.linhas),
    precosRegionais,
    apelidosDoPrograma: apelidos.map((apelido) => apelido.texto),
  }

  return {
    dias: calcularDisponibilidadeDoMes(insumos),
    programa,
    erro: null,
    precosRegionais,
  }
}
