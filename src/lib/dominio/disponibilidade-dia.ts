import { dentroDoPrazoMinimo, estaBloqueada, type DataBloqueada } from './bloqueios'
import { vaiAoArEm } from './cadastro'
import { periodoEspecialEm, type PeriodoEspecial } from './datas-especiais'
import {
  concorrenteNaData,
  restricaoQueBloqueia,
  type Anunciante,
  type Restricao,
  type VendaNaData,
} from './restricoes'

export type EstadoDaDisponibilidade =
  | 'disponivel'
  | 'concorrencia'
  | 'restricao'
  | 'ja_comprado'
  | 'limite_mensal'
  | 'bloqueado'
  | 'prazo'
  | 'esgotado'
  | 'fora_grade'

export type DisponibilidadeDoDia = {
  data: string
  estado: EstadoDaDisponibilidade
  selecionavel: boolean
  slotsTotais: number
  slotsOcupados: number
  slotsLivres: number
  motivo: string | null
  periodoEspecial: {
    nome: string
    percentualAcrescimo: number
  } | null
}

export type EntradaDaDisponibilidade = {
  data: string
  hoje: string
  programa: {
    dias_da_semana: number[]
    slots: number
    prazo_minimo_dias: number
  }
  cliente: Anunciante
  ocupacao: number
  vendasNaData: VendaNaData[]
  proprioAnuncianteNaData: boolean
  acoesDoAnuncianteNoMes: number
  limiteMensalDoAnunciante: number
  bloqueios: DataBloqueada[]
  restricoes: Restricao[]
  periodosEspeciais: PeriodoEspecial[]
}

function limitarOcupacao(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.max(0, Math.floor(valor))
}

function limitarQuantidade(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.max(0, Math.floor(valor))
}

/**
 * Responde a única pergunta que o calendário precisa fazer para cada data:
 * "esta marca pode receber uma proposta aqui, e por quê?".
 *
 * A ordem é deliberada. Fora da grade não existe inventário; bloqueio e prazo
 * vencem regras comerciais; restrição cadastrada e concorrência real tornam a
 * data inelegível para ESTE cliente. Depois disso distinguimos dois bloqueios
 * do próprio anunciante: já comprado nesta data e limite mensal atingido.
 * Esgotamento vem por último porque é condição do inventário. Data especial
 * acompanha o estado e só altera preço, nunca elegibilidade por si só.
 */
export function avaliarDisponibilidadeDoDia(
  entrada: EntradaDaDisponibilidade,
): DisponibilidadeDoDia {
  const ocupados = limitarOcupacao(entrada.ocupacao)
  const slotsTotais = Math.max(0, Math.floor(entrada.programa.slots))
  const slotsLivres = Math.max(0, slotsTotais - ocupados)
  const acoesNoMes = limitarQuantidade(entrada.acoesDoAnuncianteNoMes)
  const limiteMensal = limitarQuantidade(entrada.limiteMensalDoAnunciante)
  const especial = periodoEspecialEm(entrada.periodosEspeciais, entrada.data)
  const base = {
    data: entrada.data,
    slotsTotais,
    slotsOcupados: ocupados,
    slotsLivres,
    periodoEspecial: especial
      ? { nome: especial.nome, percentualAcrescimo: especial.percentual_acrescimo }
      : null,
  }

  if (!vaiAoArEm(entrada.programa, entrada.data)) {
    return {
      ...base,
      estado: 'fora_grade',
      selecionavel: false,
      motivo: 'O programa não possui inventário nesta data.',
    }
  }

  const bloqueio = estaBloqueada(entrada.bloqueios, entrada.data)
  if (bloqueio) {
    return {
      ...base,
      estado: 'bloqueado',
      selecionavel: false,
      motivo: bloqueio.motivo,
    }
  }

  if (dentroDoPrazoMinimo(entrada.hoje, entrada.data, entrada.programa.prazo_minimo_dias)) {
    return {
      ...base,
      estado: 'prazo',
      selecionavel: false,
      motivo: `Prazo mínimo de ${entrada.programa.prazo_minimo_dias} dias não atendido.`,
    }
  }

  const restricao = restricaoQueBloqueia(entrada.restricoes, entrada.cliente)
  if (restricao) {
    return {
      ...base,
      estado: 'restricao',
      selecionavel: false,
      motivo: restricao.motivo,
    }
  }

  const concorrente = concorrenteNaData(entrada.vendasNaData, entrada.cliente)
  if (concorrente) {
    return {
      ...base,
      estado: 'concorrencia',
      selecionavel: false,
      motivo: 'Já existe anunciante concorrente nesta data.',
    }
  }

  if (entrada.proprioAnuncianteNaData) {
    return {
      ...base,
      estado: 'ja_comprado',
      selecionavel: false,
      motivo: 'Este anunciante já possui uma ação nesta data.',
    }
  }

  if (limiteMensal > 0 && acoesNoMes >= limiteMensal) {
    return {
      ...base,
      estado: 'limite_mensal',
      selecionavel: false,
      motivo: `O anunciante atingiu o limite de ${limiteMensal} ações neste programa neste mês.`,
    }
  }

  if (slotsLivres === 0) {
    return {
      ...base,
      estado: 'esgotado',
      selecionavel: false,
      motivo: 'Todos os slots da data estão ocupados.',
    }
  }

  return {
    ...base,
    estado: 'disponivel',
    selecionavel: true,
    motivo: null,
  }
}
