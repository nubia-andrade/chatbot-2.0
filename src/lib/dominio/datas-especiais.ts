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
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * O período que cobre `dataIso`, ou `null` se nenhum cobre. Inclusivo nas
 * duas pontas: a data de início e a data de fim do período contam como
 * dentro dele.
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
      (periodo) => dataIso >= periodo.data_inicio && dataIso <= periodo.data_fim,
    ) ?? null
  )
}

/** Valor com o acréscimo percentual aplicado, arredondado a duas casas. */
export function aplicarAcrescimo(valor: number, percentual: number): number {
  return arredondar(valor * (1 + percentual / 100))
}

/**
 * Verdadeiro quando dois períodos se sobrepõem em pelo menos um dia,
 * inclusive nas pontas. Cobre as quatro formas possíveis de sobreposição:
 * o novo período começa dentro do existente, termina dentro dele, o
 * engloba inteiro, ou é englobado por ele inteiro — todas caem no mesmo
 * teste de intervalo, sem tratar cada forma à parte.
 */
function periodosSeSobrepoem(
  a: Pick<PeriodoEspecial, 'data_inicio' | 'data_fim'>,
  b: Pick<PeriodoEspecial, 'data_inicio' | 'data_fim'>,
): boolean {
  return a.data_inicio <= b.data_fim && b.data_inicio <= a.data_fim
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
 * quem cadastra precisa saber QUAL período mexer ou encurtar.
 */
export function validarPeriodoEspecial(
  novo: Pick<PeriodoEspecial, 'nome' | 'data_inicio' | 'data_fim' | 'percentual_acrescimo'> & {
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
