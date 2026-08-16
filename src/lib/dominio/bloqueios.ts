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

/**
 * Índice de bloqueios por data — para uma grade mensal (Task 11) responder
 * "esta célula está bloqueada?" sem varrer `bloqueios` inteiro a cada uma
 * das ~35 células do mês.
 *
 * Constrói o índice CHAMANDO `estaBloqueada` para cada data, em vez de
 * reimplementar a comparação (`bloqueio.data === dataIso`) por conta própria.
 * A diferença importa: se R12 ganhar nuance — uma tolerância, uma validade,
 * um tipo de bloqueio que não vale para regional —, quem decide isso passa a
 * ser só `estaBloqueada`, e este índice (e qualquer grade que o use)
 * acompanha automaticamente. Sem isso, a regra viveria em dois lugares, e um
 * deles ficaria desatualizado sem avisar ninguém.
 */
export function indexarBloqueios(
  bloqueios: DataBloqueada[],
  datas: string[],
): Map<string, DataBloqueada> {
  const indice = new Map<string, DataBloqueada>()
  for (const data of datas) {
    const bloqueio = estaBloqueada(bloqueios, data)
    if (bloqueio) indice.set(data, bloqueio)
  }
  return indice
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
