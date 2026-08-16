/**
 * Feriados nacionais — ILUSTRAÇÃO, nunca regra.
 *
 * Decisão da área (spec da Entrega 3): o calendário nomeia o feriado para o
 * executivo se situar no mês, mas ele NÃO altera disponibilidade nem preço.
 * 25/12 só fecha se estiver em `datas_bloqueadas`; só muda de valor se
 * estiver dentro de um período de `datas_especiais`. Um feriado sem cadastro
 * é um dia vendável como outro qualquer.
 *
 * Quem consumir isto: o nome do feriado nunca entra em `motivos` de
 * `DiaDeDisponibilidade` e nunca influencia `estado`.
 *
 * Só os nacionais. Estadual e municipal ficam de fora — são muitos, mudam
 * por praça, e o que decide continua sendo o cadastro.
 */

export type Feriado = {
  data: string
  nome: string
}

/** Dia-mês fixos, no formato `MM-DD`. */
const FIXOS: [string, string][] = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['12-25', 'Natal'],
]

/** Deslocamento em dias a partir do Domingo de Páscoa. */
const MOVEIS: [number, string][] = [
  [-47, 'Carnaval'],
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi'],
]

const UM_DIA_MS = 24 * 60 * 60 * 1000

function paraIso(momento: number): string {
  return new Date(momento).toISOString().slice(0, 10)
}

function deslocar(dataIso: string, dias: number): string {
  return paraIso(new Date(`${dataIso}T00:00:00Z`).getTime() + dias * UM_DIA_MS)
}

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano).
 * Os três feriados móveis brasileiros derivam dele: Carnaval é 47 dias antes,
 * Sexta-feira Santa 2 dias antes, Corpus Christi 60 dias depois.
 */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Os onze feriados nacionais do ano, ordenados por data. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano)

  const feriados: Feriado[] = [
    ...FIXOS.map(([diaMes, nome]) => ({ data: `${ano}-${diaMes}`, nome })),
    ...MOVEIS.map(([deslocamento, nome]) => ({ data: deslocar(pascoa, deslocamento), nome })),
  ]

  return feriados.sort((um, outro) => um.data.localeCompare(outro.data))
}

/** O feriado daquela data, ou nulo. Calculado do ano da própria data — não há tabela fixa a manter. */
export function feriadoEm(dataIso: string): Feriado | null {
  const ano = Number(dataIso.slice(0, 4))
  if (!Number.isFinite(ano)) return null
  return feriadosDoAno(ano).find((feriado) => feriado.data === dataIso) ?? null
}
