/** As 5 Globos, na ordem em que aparecem na interface. */
export const PRACAS = ['SP', 'RJ', 'BH', 'DF', 'PE1'] as const

export type AcaoRegional = {
  data_de_exibicao: string
  praca_codigo: string
  cliente_nome: string
}

export type ConfiguracaoRegional = {
  aceita_regional: boolean
  dia_da_semana_regional: number | null
  max_pracas_por_acao: number
}

function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

/**
 * R10 — o slot regional só existe no dia da semana do programa: sextas no
 * Encontro, sábados no É de Casa. Fora dele não há "esgotado", simplesmente
 * não existe ação regional.
 */
export function temSlotRegionalEm(config: ConfiguracaoRegional, dataIso: string): boolean {
  if (!config.aceita_regional) return false
  if (config.dia_da_semana_regional === null) return false
  return diaDaSemana(dataIso) === config.dia_da_semana_regional
}

export function pracasOcupadasEm(acoes: AcaoRegional[], dataIso: string): string[] {
  return acoes.filter((a) => a.data_de_exibicao === dataIso).map((a) => a.praca_codigo)
}

/** R8 — cada praça tem seu próprio slot na data. */
export function pracasLivresEm(
  config: ConfiguracaoRegional,
  acoes: AcaoRegional[],
  dataIso: string,
): string[] {
  if (!temSlotRegionalEm(config, dataIso)) return []
  const ocupadas = new Set(pracasOcupadasEm(acoes, dataIso))
  return PRACAS.filter((praca) => !ocupadas.has(praca))
}

/** R9 — um cliente compra até `max_pracas_por_acao` praças, consumindo o slot de cada. */
export function validarCompra(
  config: ConfiguracaoRegional,
  acoes: AcaoRegional[],
  dataIso: string,
  pracasDesejadas: string[],
): string[] {
  const erros: string[] = []

  if (pracasDesejadas.length === 0) {
    erros.push('Selecione ao menos uma praça.')
  }
  if (!temSlotRegionalEm(config, dataIso)) {
    erros.push('Este programa não tem ação regional nesta data.')
  }
  if (pracasDesejadas.length > config.max_pracas_por_acao) {
    erros.push(`Uma ação pode ter no máximo ${config.max_pracas_por_acao} praças.`)
  }

  const ocupadas = new Set(pracasOcupadasEm(acoes, dataIso))
  for (const praca of pracasDesejadas) {
    if (!PRACAS.includes(praca as (typeof PRACAS)[number])) {
      erros.push(`Praça desconhecida: ${praca}.`)
    } else if (ocupadas.has(praca)) {
      erros.push(`A praça ${praca} já está vendida nesta data.`)
    }
  }

  return erros
}

/**
 * R15 (PROVISÓRIO) — a área ainda não confirmou se a ação regional consome
 * também um slot do inventário nacional do dia. Assumimos que sim, por ser o
 * erro menos grave: mostrar menos disponibilidade nacional custa uma venda
 * possível; o contrário faz vender espaço que não existe.
 *
 * Quando a área confirmar, troque o retorno desta função — e só dela.
 */
export function regionalConsomeSlotNacional(): boolean {
  return true
}
