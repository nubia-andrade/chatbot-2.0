export type DataBloqueada = {
  data: string
  motivo: string
}

/**
 * R12 — data bloqueada vence qualquer disponibilidade. Devolve o bloqueio
 * inteiro, e não só um booleano, porque a interface precisa mostrar o motivo:
 * "indisponível" sem explicação vira dúvida e telefonema.
 */
export function estaBloqueada(
  bloqueios: DataBloqueada[],
  dataIso: string,
): DataBloqueada | null {
  return bloqueios.find((bloqueio) => bloqueio.data === dataIso) ?? null
}

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000

export function diasDeAntecedencia(hojeIso: string, dataIso: string): number {
  const hoje = new Date(`${hojeIso}T00:00:00Z`).getTime()
  const alvo = new Date(`${dataIso}T00:00:00Z`).getTime()
  return Math.round((alvo - hoje) / MILISSEGUNDOS_POR_DIA)
}

/**
 * R11 — verdadeiro quando a data está DENTRO do prazo mínimo, ou seja, perto
 * demais para ser vendida. Encontro exige 7 dias; É de Casa, 10.
 */
export function dentroDoPrazoMinimo(
  hojeIso: string,
  dataIso: string,
  prazoDias: number,
): boolean {
  return diasDeAntecedencia(hojeIso, dataIso) < prazoDias
}
