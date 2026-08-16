/**
 * "Direitos e conexos" deixou de ser um campo digitado (Entrega 2) para virar
 * um valor calculado (Entrega 3 — reestruturação de Custos).
 *
 *   TV:      15% × (custo de mídia TV + simulcast% × custo de mídia TV)
 *   Digital: 15% × custo de mídia digital
 *
 * O simulcast é o valor cobrado pela replicação da exibição no Globoplay —
 * por isso ele só entra na conta de TV. Não existe simulcast de digital.
 *
 * Caso real conferido com a área (É de Casa): mídia TV 376.000,00, simulcast
 * 3% → 376.000 + 11.280 (3% de 376.000) = 387.280; 15% de 387.280 = 58.092,00.
 * Se o cálculo abaixo não bater com isso, o cálculo está errado — não o
 * teste.
 */

/** Alíquota fixa dos dois cálculos. Nomeada para não se espalhar em número mágico. */
export const PERCENTUAL_DIREITOS_E_CONEXOS = 0.15

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Direitos e conexos de TV.
 *
 * `custoMidiaTv` ausente (`null`/`undefined`) devolve `null` — "não dá para
 * calcular ainda", igual à convenção do resto do cadastro (`moeda.ts`:
 * `null` é "não informado", não "custa zero"). Um programa sem custo de
 * mídia preenchido não tem direitos de R$ 0,00: tem direitos indefinidos.
 *
 * `percentualSimulcast` ausente ou `null` é tratado como 0% — simulcast é
 * opcional no cadastro, e sua ausência não deveria impedir o cálculo da
 * parcela de TV que independe dele.
 */
export function calcularDireitosTv(
  custoMidiaTv: number | null | undefined,
  percentualSimulcast?: number | null,
): number | null {
  if (custoMidiaTv === null || custoMidiaTv === undefined) return null

  const simulcast = percentualSimulcast ?? 0
  const valorDoSimulcast = (simulcast / 100) * custoMidiaTv
  return arredondar(PERCENTUAL_DIREITOS_E_CONEXOS * (custoMidiaTv + valorDoSimulcast))
}

/**
 * Direitos e conexos de Digital. Sem simulcast — a replicação no Globoplay
 * não existe para uma mídia que já é digital.
 *
 * Mesma convenção de `custoMidiaDigital` ausente → `null`.
 */
export function calcularDireitosDigital(custoMidiaDigital: number | null | undefined): number | null {
  if (custoMidiaDigital === null || custoMidiaDigital === undefined) return null
  return arredondar(PERCENTUAL_DIREITOS_E_CONEXOS * custoMidiaDigital)
}
