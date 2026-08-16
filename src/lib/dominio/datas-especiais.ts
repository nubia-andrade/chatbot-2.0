/**
 * Datas especiais — período com PREÇO diferenciado (Black Friday, Natal…),
 * diferente de data bloqueada (`bloqueios.ts`), que impede a venda. As duas
 * coexistem: uma data pode estar dentro de um período especial e, ao mesmo
 * tempo, bloqueada.
 *
 * O acréscimo é percentual sobre a MÍDIA, aplicado ANTES de direitos e
 * conexos — por isso `aplicarAcrescimo` devolve só a mídia ajustada; quem
 * calcula direitos (`direitos-e-conexos.ts`) recebe essa mídia já maior e
 * sobe junto, sem precisar saber que existe data especial.
 *
 * Caso real conferido com a área: mídia 376.000,00 com 20% de acréscimo →
 * 451.200,00. No regional, o acréscimo incide sobre a mídia de CADA praça:
 * SP 53.000,00 com 20% → 63.600,00.
 */

export type PeriodoEspecial = {
  id?: string
  nome: string
  data_inicio: string
  data_fim: string
  percentual_acrescimo: number
  texto_investimento?: string | null
  /**
   * Dias da semana em que o período vale — 0=domingo … 6=sábado, a mesma
   * convenção de `programas.dias_da_semana` e de `Date.getUTCDay()`. Vazio
   * ou nulo = todos os dias do período (o comportamento original, antes de
   * dias específicos existirem). Preenchido = só aqueles dias, dentro do
   * intervalo — ex.: Mais Você, 01/01 a 30/04, só quartas-feiras.
   */
  dias_da_semana?: number[] | null
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** Dia da semana de uma data ISO (`AAAA-MM-DD`) — 0=domingo … 6=sábado, igual a `Date.getUTCDay()`. */
function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

/** Os sete dias, usado quando `dias_da_semana` está vazio ou nulo — "todos os dias" é a convenção. */
const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6]

/** `dias_da_semana` como conjunto, tratando vazio/nulo como "todos os sete dias". */
function diasEfetivos(dias: number[] | null | undefined): Set<number> {
  return new Set(dias && dias.length > 0 ? dias : TODOS_OS_DIAS)
}

/**
 * O período que cobre `dataIso`, ou `null` se nenhum cobre. Inclusivo nas
 * duas pontas: a data de início e a data de fim do período contam como
 * dentro dele. Quando o período tem `dias_da_semana` preenchido, a data
 * também precisa cair num desses dias — vazio ou nulo continua valendo
 * para qualquer dia, como sempre valeu.
 *
 * Devolve o período inteiro, não um booleano — a interface precisa mostrar
 * o nome e o percentual, igual a `estaBloqueada` devolve o bloqueio inteiro
 * para mostrar o motivo.
 */
export function periodoEspecialEm(
  periodos: PeriodoEspecial[],
  dataIso: string,
): PeriodoEspecial | null {
  return (
    periodos.find(
      (periodo) =>
        dataIso >= periodo.data_inicio &&
        dataIso <= periodo.data_fim &&
        diasEfetivos(periodo.dias_da_semana).has(diaDaSemana(dataIso)),
    ) ?? null
  )
}

/** Valor com o acréscimo percentual aplicado, arredondado a duas casas. */
export function aplicarAcrescimo(valor: number, percentual: number): number {
  return arredondar(valor * (1 + percentual / 100))
}

/**
 * Verdadeiro quando o intervalo [inicio, fim] (inclusivo) contém pelo menos
 * uma data cujo dia da semana está em `dias`. Um dia da semana se repete a
 * cada 7 dias corridos — então basta olhar os primeiros 7 dias do
 * intervalo (ou menos, se o intervalo for mais curto): se nenhum bater ali,
 * nenhum bate depois, porque o padrão só se repete. Isso evita iterar
 * intervalos de meses inteiros dia a dia.
 */
function intervaloContemAlgumDia(inicio: string, fim: string, dias: Set<number>): boolean {
  let cursor = new Date(`${inicio}T00:00:00Z`).getTime()
  const limite = new Date(`${fim}T00:00:00Z`).getTime()
  const UM_DIA_MS = 24 * 60 * 60 * 1000

  for (let i = 0; i < 7 && cursor <= limite; i++, cursor += UM_DIA_MS) {
    if (dias.has(new Date(cursor).getUTCDay())) return true
  }
  return false
}

/**
 * Verdadeiro quando dois períodos se sobrepõem em pelo menos um dia real,
 * inclusive nas pontas. Duas condições precisam valer ao mesmo tempo:
 *
 * 1. As datas se cruzam — cobre as quatro formas possíveis de sobreposição
 *    (o novo período começa dentro do existente, termina dentro dele, o
 *    engloba inteiro, ou é englobado por ele inteiro), todas no mesmo teste
 *    de intervalo, sem tratar cada forma à parte.
 * 2. Dentro do trecho de datas em comum, existe pelo menos uma data cujo
 *    dia da semana está nos dois períodos — não basta cruzar as LISTAS de
 *    dias, porque um período pode escolher "quartas" num intervalo que não
 *    contém quarta nenhuma (ex.: sexta a domingo). Um período sem
 *    `dias_da_semana` conta como os sete dias para esta comparação — é o
 *    que preserva o comportamento de antes de dias específicos existirem.
 */
function periodosSeSobrepoem(
  a: Pick<PeriodoEspecial, 'data_inicio' | 'data_fim' | 'dias_da_semana'>,
  b: Pick<PeriodoEspecial, 'data_inicio' | 'data_fim' | 'dias_da_semana'>,
): boolean {
  if (!(a.data_inicio <= b.data_fim && b.data_inicio <= a.data_fim)) return false

  const diasComuns = [...diasEfetivos(a.dias_da_semana)].filter((dia) => diasEfetivos(b.dias_da_semana).has(dia))
  if (diasComuns.length === 0) return false

  const inicioComum = a.data_inicio > b.data_inicio ? a.data_inicio : b.data_inicio
  const fimComum = a.data_fim < b.data_fim ? a.data_fim : b.data_fim

  return intervaloContemAlgumDia(inicioComum, fimComum, new Set(diasComuns))
}

/**
 * Valida um novo período especial contra as regras da área e contra os
 * períodos já cadastrados NO MESMO PROGRAMA. Devolve a lista de erros em
 * português, frases completas — vazia quando o período pode ser gravado.
 *
 * Períodos do mesmo programa não podem se sobrepor: decisão deliberada da
 * área, porque aninhar períodos (Black Friday dentro do Natal, por exemplo)
 * exigiria uma regra arbitrária de desempate que ninguém pediu. Cada
 * conflito é nomeado — "se sobrepõe a X" —, não um erro genérico, porque
 * quem cadastra precisa saber QUAL período mexer ou encurtar. Desde que
 * `dias_da_semana` existe, dois períodos só conflitam de verdade quando têm
 * data E dia da semana em comum — ver `periodosSeSobrepoem`.
 */
export function validarPeriodoEspecial(
  novo: Pick<
    PeriodoEspecial,
    'nome' | 'data_inicio' | 'data_fim' | 'percentual_acrescimo' | 'dias_da_semana'
  > & {
    id?: string
  },
  existentes: PeriodoEspecial[],
): string[] {
  const erros: string[] = []

  if (novo.nome.trim() === '') {
    erros.push('Informe o nome do período.')
  }

  if (novo.data_fim < novo.data_inicio) {
    erros.push('A data final não pode ser anterior à data inicial.')
  }

  if (novo.percentual_acrescimo < 0) {
    erros.push('O percentual de acréscimo não pode ser negativo.')
  }

  for (const existente of existentes) {
    if (novo.id && existente.id === novo.id) continue
    if (periodosSeSobrepoem(novo, existente)) {
      erros.push(
        `O período se sobrepõe a "${existente.nome}" (${existente.data_inicio} a ${existente.data_fim}).`,
      )
    }
  }

  return erros
}
