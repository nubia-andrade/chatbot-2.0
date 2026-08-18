import { type AcaoVendida } from './ocupacao'
import { ocupaSlot, normalizarFormato, type MapaDeFormatos } from './formatos'
import { estaBloqueada, dentroDoPrazoMinimo, type DataBloqueada } from './bloqueios'
import { concorrenteNaData, type Anunciante } from './restricoes'
import { periodoEspecialEm, aplicarAcrescimo, type PeriodoEspecial } from './datas-especiais'
import { feriadoEm } from './feriados'
import { classificarAnunciante, type IndiceDeAnunciantes } from './casamento-anunciante'
import { calcularCustoDaAcaoNacional } from './custo-da-acao-nacional'
import { calcularCustoDaAcaoRegional, type PrecoDaPracaParaCalculo } from './custo-da-acao-regional'
import { PRACAS, temSlotRegionalEm, regionalConsomeSlotNacional, type AcaoRegional } from './regional'
import { extrairMnemonico } from './programas'

/**
 * O MOTOR. Único lugar do sistema que sabe em que ORDEM as regras se aplicam.
 *
 * Não reimplementa regra nenhuma: `contarOcupacao`, `estaBloqueada`,
 * `dentroDoPrazoMinimo`, `concorrenteNaData`, `temSlotRegionalEm`,
 * `periodoEspecialEm` e os cálculos de custo já existem e já têm teste. Esta
 * função os ordena e devolve, por dia do mês, o que a célula do calendário
 * precisa mostrar.
 *
 * É pura: sem banco, sem tela, sem `Date.now()`. `hojeIso` entra por
 * parâmetro — é o que torna o prazo mínimo testável.
 */

export type EstadoDoDia =
  | 'sem_exibicao'
  | 'fora_do_prazo'
  | 'bloqueado'
  | 'concorrencia'
  | 'esgotado'
  | 'disponivel'

export type Modalidade = 'nacional' | 'regional'

export type PracaNoDia = {
  praca_codigo: string
  disponivel: boolean
  cliente_nome: string | null
}

export type DiaDeDisponibilidade = {
  data: string
  estado: EstadoDoDia
  /** Slots livres no nacional; praças livres no regional. */
  livres: number
  /** Slots do dia no nacional; 5 praças no regional. `0` em dia sem exibição. */
  total: number
  /**
   * TODOS os motivos que valem, não só o que deu a cor. Uma data pode estar
   * ao mesmo tempo fora do prazo e bloqueada, e esconder o segundo faria o
   * executivo achar que resolver o primeiro liberaria a venda.
   */
  motivos: string[]
  /** Ilustração pura — nunca entra em `motivos`, nunca altera `estado`. */
  feriado: string | null
  /** Vazio no nacional. */
  pracas: PracaNoDia[]
  valor_unitario: number | null
  periodo_especial: { nome: string; percentual: number } | null
  /** Ações vendidas na data cujo anunciante não casou com a carteira. */
  acoes_sem_classificacao: number
}

/** O que o motor precisa saber do programa — não o cadastro inteiro. */
export type ProgramaParaDisponibilidade = {
  id: string
  mnemonico: string
  dias_da_semana: number[]
  slots: number
  bloqueio_mensal: number
  prazo_minimo_dias: number
  custo_midia_tv: number | null
  custo_producao_tv: number | null
  percentual_simulcast: number | null
  aceita_regional: boolean
  dia_da_semana_regional: number | null
  prazo_minimo_regional_dias: number | null
  max_pracas_por_acao: number
  custo_producao_regional: number | null
  bloqueio_mensal_regional: number
}

export type AcaoVendidaComAnunciante = AcaoVendida & { anunciante: string | null }

export type InsumosDeDisponibilidade = {
  ano: number
  /** 1 = janeiro … 12 = dezembro. */
  mes: number
  hojeIso: string
  modalidade: Modalidade
  programa: ProgramaParaDisponibilidade
  cliente: Anunciante
  formatos: MapaDeFormatos
  acoesVendidas: AcaoVendidaComAnunciante[]
  acoesRegionais: AcaoRegional[]
  bloqueios: DataBloqueada[]
  periodosEspeciais: PeriodoEspecial[]
  indiceDeAnunciantes: IndiceDeAnunciantes
  precosRegionais: PrecoDaPracaParaCalculo[]
  /**
   * R6 — 4 dos 23 programas chegam da API sem "MNEMONICO - NOME" e dependem
   * de apelido cadastrado em `programa_apelidos`. Padrão: lista vazia, o que
   * preserva o casamento só por mnemônico. Quem chama com os apelidos reais
   * (Task 8, via `listarApelidos`) evita o pior erro possível: sem isto, uma
   * ação desses 4 programas nunca casaria e o calendário mostraria
   * disponibilidade sempre cheia, vendendo espaço já vendido.
   */
  apelidosDoPrograma?: string[]
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Todos os dias do mês, em ISO. `mes` é 1-based, como as pessoas contam. */
export function diasDoMes(ano: number, mes: number): string[] {
  const dias: string[] = []
  let cursor = Date.UTC(ano, mes - 1, 1)
  while (new Date(cursor).getUTCMonth() === mes - 1) {
    dias.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += UM_DIA_MS
  }
  return dias
}

function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

/**
 * As ações vendidas DESTE programa, casadas por mnemônico ou por apelido.
 *
 * R6 — 4 dos 23 programas chegam da API sem "MNEMONICO - NOME" e só têm
 * apelido cadastrado (ex.: "MAIS VOCE", sem "MAVO - "). `extrairMnemonico`
 * devolve `null` para esses textos, então casar só por mnemônico deixaria
 * essas ações sem programa — e o calendário mostraria disponibilidade
 * sempre cheia, o pior erro possível, porque vende espaço já vendido. Segue
 * a mesma lógica de `encontrarProgramaId` (`./programas`): mnemônico
 * primeiro, apelido como recurso, sobre o texto integral normalizado.
 */
function acoesDoPrograma(
  acoes: AcaoVendidaComAnunciante[],
  programa: ProgramaParaDisponibilidade,
  apelidos: string[] = [],
): AcaoVendidaComAnunciante[] {
  const mnemonicoAlvo = normalizarFormato(programa.mnemonico)
  const apelidosAlvo = new Set(apelidos.map((apelido) => normalizarFormato(apelido)))

  return acoes.filter((acao) => {
    const mnemonico = extrairMnemonico(acao.programa)
    if (mnemonico !== null && mnemonico === mnemonicoAlvo) return true
    return apelidosAlvo.has(normalizarFormato(acao.programa))
  })
}

/** Ações regionais DISTINTAS (data + cliente) do mês — uma ação de 3 praças ocupa 3 linhas de `acoes_regionais` mas continua sendo uma ação só. */
function acoesRegionaisDistintasNoMes(acoesRegionais: AcaoRegional[], doMes: Set<string>): number {
  const distintas = new Set(
    acoesRegionais
      .filter((acao) => doMes.has(acao.data_de_exibicao))
      .map((acao) => `${acao.data_de_exibicao}|${acao.cliente_nome}`),
  )
  return distintas.size
}

/**
 * R16 — quantas ações já caíram no mês. No nacional, ações de conteúdo
 * vendidas mais — quando R15 (provisório, `regionalConsomeSlotNacional`) diz
 * que a ação regional consome também um slot nacional do dia — as ações
 * regionais DISTINTAS (data + cliente) do mês, mesma unidade usada na conta
 * diária de `usadosNacional`: sem somar aqui, o teto mensal nacional ficaria
 * cego para um consumo que o próprio motor já contabiliza dia a dia. No
 * regional, ações DISTINTAS (data + cliente), porque uma ação de 3 praças
 * ocupa 3 linhas de `acoes_regionais` mas continua sendo uma ação só para o
 * teto de 4 do Manual de Práticas.
 */
function acoesNoMes(insumos: InsumosDeDisponibilidade, dias: string[]): number {
  const doMes = new Set(dias)

  if (insumos.modalidade === 'regional') {
    return acoesRegionaisDistintasNoMes(insumos.acoesRegionais, doMes)
  }

  const vendidas = acoesDoPrograma(
    insumos.acoesVendidas,
    insumos.programa,
    insumos.apelidosDoPrograma,
  ).filter((acao) => doMes.has(acao.data_de_exibicao) && ocupaSlot(acao.formato, insumos.formatos)).length

  const regionais = regionalConsomeSlotNacional()
    ? acoesRegionaisDistintasNoMes(insumos.acoesRegionais, doMes)
    : 0

  return vendidas + regionais
}

export function calcularDisponibilidadeDoMes(
  insumos: InsumosDeDisponibilidade,
): DiaDeDisponibilidade[] {
  const dias = diasDoMes(insumos.ano, insumos.mes)
  const regional = insumos.modalidade === 'regional'
  const programa = insumos.programa

  const doPrograma = acoesDoPrograma(insumos.acoesVendidas, programa, insumos.apelidosDoPrograma)

  const prazo = regional
    ? (programa.prazo_minimo_regional_dias ?? 0)
    : programa.prazo_minimo_dias

  const tetoMensal = regional ? programa.bloqueio_mensal_regional : programa.bloqueio_mensal
  const mesFechado = tetoMensal > 0 && acoesNoMes(insumos, dias) >= tetoMensal

  return dias.map((data) => {
    const feriado = feriadoEm(data)?.nome ?? null
    const motivos: string[] = []

    // 1. Existe inventário neste dia? Se não, não é estado nenhum — é ausência.
    const temInventario = regional
      ? temSlotRegionalEm(
          {
            aceita_regional: programa.aceita_regional,
            dia_da_semana_regional: programa.dia_da_semana_regional,
            max_pracas_por_acao: programa.max_pracas_por_acao,
          },
          data,
        )
      : programa.dias_da_semana.includes(diaDaSemana(data))

    if (!temInventario) {
      return {
        data,
        estado: 'sem_exibicao',
        livres: 0,
        total: 0,
        motivos: [],
        feriado,
        pracas: [],
        valor_unitario: null,
        periodo_especial: null,
        acoes_sem_classificacao: 0,
      }
    }

    // Ocupação — nacional por slots, regional por praças.
    const vendidasNaData = doPrograma.filter((acao) => acao.data_de_exibicao === data)
    const regionaisNaData = insumos.acoesRegionais.filter((acao) => acao.data_de_exibicao === data)

    const porPraca = new Map(regionaisNaData.map((acao) => [acao.praca_codigo, acao.cliente_nome]))
    const pracas: PracaNoDia[] = regional
      ? PRACAS.map((praca) => ({
          praca_codigo: praca,
          disponivel: !porPraca.has(praca),
          cliente_nome: porPraca.get(praca) ?? null,
        }))
      : []

    /**
     * R1 — só formato de categoria AÇÃO DE CONTEÚDO ocupa slot.
     * R15 (provisório) — a ação regional consome também um slot nacional do
     * dia. Uma ação de 3 praças é UMA ação: por isso conta clientes
     * distintos, não linhas de `acoes_regionais`.
     */
    const usadosNacional =
      vendidasNaData.filter((acao) => ocupaSlot(acao.formato, insumos.formatos)).length +
      (regionalConsomeSlotNacional()
        ? new Set(regionaisNaData.map((acao) => acao.cliente_nome)).size
        : 0)

    const total = regional ? PRACAS.length : programa.slots
    const livres = regional
      ? pracas.filter((praca) => praca.disponivel).length
      : Math.max(0, programa.slots - usadosNacional)

    // Preço do dia, com o acréscimo do período especial já aplicado.
    const periodo = periodoEspecialEm(insumos.periodosEspeciais, data)
    const acrescimo = periodo?.percentual_acrescimo ?? 0
    const periodo_especial = periodo ? { nome: periodo.nome, percentual: acrescimo } : null

    const valor_unitario = regional
      ? calcularCustoDaAcaoRegional(
          pracas.filter((praca) => praca.disponivel).map((praca) => praca.praca_codigo),
          acrescimo > 0
            ? insumos.precosRegionais.map((preco) => ({
                ...preco,
                custo_midia_tv: aplicarAcrescimo(preco.custo_midia_tv, acrescimo),
              }))
            : insumos.precosRegionais,
          programa.custo_producao_regional,
        )
      : calcularCustoDaAcaoNacional(
          {
            custo_midia_tv: programa.custo_midia_tv,
            custo_producao_tv: programa.custo_producao_tv,
            percentual_simulcast: programa.percentual_simulcast,
          },
          acrescimo,
        )

    // Concorrência (R14) — só no que casou com a carteira.
    const classificadas = vendidasNaData.map((acao) => ({
      acao,
      cliente: classificarAnunciante(acao.anunciante, insumos.indiceDeAnunciantes),
    }))
    const acoes_sem_classificacao = classificadas.filter((linha) => linha.cliente === null).length

    const concorrente = concorrenteNaData(
      classificadas
        .filter((linha) => linha.cliente !== null)
        .map((linha) => ({
          anunciante: linha.cliente!.nome,
          setor: linha.cliente!.setor,
          industria: linha.cliente!.industria,
        })),
      insumos.cliente,
    )

    // 2. Os motivos, todos, na ordem em que pintam a célula.
    const foraDoPrazo = dentroDoPrazoMinimo(insumos.hojeIso, data, prazo)
    if (foraDoPrazo) {
      motivos.push(`Fora do prazo mínimo de ${prazo} dias para este programa.`)
    }

    const bloqueio = estaBloqueada(insumos.bloqueios, data)
    if (bloqueio) motivos.push(bloqueio.motivo)

    if (mesFechado) {
      motivos.push(`O mês já atingiu o limite de ${tetoMensal} ações deste programa.`)
    }

    if (concorrente) {
      motivos.push(
        `${concorrente.anunciante} já tem ação nesta data, na mesma categoria do cliente.`,
      )
    }

    if (livres === 0) motivos.push('Todos os espaços desta data já foram vendidos.')

    /**
     * A ORDEM. Prazo vem primeiro porque forma uma faixa contígua no começo
     * do calendário, que o executivo lê de uma vez como "daqui não dá mais
     * tempo" — furar essa faixa com uma célula de outra cor faz ele achar
     * que as vizinhas são negociáveis. Os outros motivos continuam em
     * `motivos`, visíveis no detalhe da célula: nada se perde.
     */
    const estado: EstadoDoDia = foraDoPrazo
      ? 'fora_do_prazo'
      : bloqueio || mesFechado
        ? 'bloqueado'
        : concorrente
          ? 'concorrencia'
          : livres === 0
            ? 'esgotado'
            : 'disponivel'

    return {
      data,
      estado,
      livres,
      total,
      motivos,
      feriado,
      pracas,
      valor_unitario,
      periodo_especial,
      acoes_sem_classificacao,
    }
  })
}
