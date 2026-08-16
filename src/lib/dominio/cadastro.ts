export type EstadoDoPrograma = 'ativo' | 'inativo' | 'em_configuracao'

export type Programa = {
  id: string
  nome: string
  mnemonico: string
  imagem_url: string | null
  canal: string
  possui_fluxo_aprovacao: boolean
  contem_digital: boolean
  redes_sociais: boolean
  estado: EstadoDoPrograma
  dias_da_semana: number[]
  slots: number
  bloqueio_mensal: number
  acoes_minimas: number
  acoes_maximas: number
  custo_midia: number | null
  custo_producao: number | null
  prazo_minimo_dias: number
  percentual_simulcast: number | null
  custo_multishow: number | null
  disponivel_para_proposta: boolean
  /** Alimenta o "Modificado em" do cartão da lista — Entrega 2. */
  atualizado_em: string

  // Regional — Entrega 2. O bloco só se aplica quando `aceita_regional` é
  // verdadeiro; os demais campos ficam `null`/vazios em quem não vende
  // regional (Encontro e É de Casa hoje, por `docs/regras-acoes-regionais.md`).
  aceita_regional: boolean
  /** 0 (domingo) a 6 (sábado) — o único dia da semana com slot regional. */
  dia_da_semana_regional: number | null
  prazo_minimo_regional_dias: number | null
  /** Quantas praças uma mesma ação pode reunir. Padrão de banco: 3. */
  max_pracas_por_acao: number
  direitos_e_conexos: number | null
  custo_producao_regional: number | null
}

function vazio(valor: string | undefined | null): boolean {
  return valor === undefined || valor === null || valor.trim() === ''
}

// R7 — validações do cadastro.
export function validarPrograma(programa: Partial<Programa>): string[] {
  const erros: string[] = []

  if (vazio(programa.nome)) erros.push('Informe o nome do programa.')
  if (vazio(programa.mnemonico)) erros.push('Informe o mnemônico do programa.')
  if (vazio(programa.canal)) erros.push('Informe o canal onde o programa é exibido.')

  const dias = programa.dias_da_semana ?? []
  if (dias.length === 0) erros.push('Selecione ao menos um dia de exibição.')
  if (dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    erros.push('Dia da semana inválido: use 0 (domingo) a 6 (sábado).')
  }

  if ((programa.slots ?? 0) < 1) {
    erros.push('O programa precisa ter pelo menos 1 slot por data.')
  }
  if ((programa.acoes_minimas ?? 0) > (programa.acoes_maximas ?? 0)) {
    erros.push('A quantidade mínima de ações não pode ser maior que a máxima.')
  }
  if ((programa.prazo_minimo_dias ?? 0) < 0) {
    erros.push('O prazo mínimo não pode ser negativo.')
  }

  if (programa.disponivel_para_proposta === true) {
    if (programa.custo_midia === null || programa.custo_midia === undefined) {
      erros.push('Informe o custo de mídia para programas disponíveis para proposta.')
    }
    if (programa.custo_producao === null || programa.custo_producao === undefined) {
      erros.push('Informe o custo de produção para programas disponíveis para proposta.')
    }
  }

  // R10/R11 — um programa que aceita regional precisa do dia da semana (o
  // único em que o slot regional existe) e do prazo mínimo regional; sem os
  // dois, `temSlotRegionalEm`/`validarCompra` (regional.ts) não têm o que
  // avaliar.
  if (programa.aceita_regional === true) {
    const dia = programa.dia_da_semana_regional
    if (dia === null || dia === undefined) {
      erros.push('Informe o dia da semana da ação regional.')
    } else if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      erros.push('Dia da semana regional inválido: use 0 (domingo) a 6 (sábado).')
    }

    const prazo = programa.prazo_minimo_regional_dias
    if (prazo === null || prazo === undefined) {
      erros.push('Informe o prazo mínimo regional.')
    } else if (prazo < 0) {
      erros.push('O prazo mínimo regional não pode ser negativo.')
    }

    if ((programa.max_pracas_por_acao ?? 0) < 1) {
      erros.push('O máximo de praças por ação regional precisa ser pelo menos 1.')
    }
  }

  return erros
}

export function vaiAoArEm(
  programa: Pick<Programa, 'dias_da_semana'>,
  dataIso: string,
): boolean {
  const dia = new Date(`${dataIso}T00:00:00Z`).getUTCDay()
  return programa.dias_da_semana.includes(dia)
}
