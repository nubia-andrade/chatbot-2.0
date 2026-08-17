import type { DiaDeDisponibilidade, Modalidade } from './disponibilidade'

/**
 * O que pode virar uma consulta gravada. Roda no navegador, para habilitar o
 * botão e mostrar o erro na hora, e DE NOVO no servidor antes de gravar —
 * validação de tela é conveniência, a que vale é a do servidor.
 */

export type ItemDaConsulta = {
  data: string
  quantidade: number
  /** Vazio no nacional. */
  pracas: string[]
}

export type ConsultaEmMontagem = {
  clienteId: string | null
  programaId: string | null
  modalidade: Modalidade
  itens: ItemDaConsulta[]
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Quantas ações cabem numa data: o menor entre o que o programa permite por
 * dia e o que ainda sobrou. Dia indisponível não comporta nenhuma, qualquer
 * que seja o teto do cadastro.
 */
export function limiteDeAcoesNoDia(dia: DiaDeDisponibilidade, acoesMaximas: number): number {
  if (dia.estado !== 'disponivel') return 0
  return Math.min(acoesMaximas, dia.livres)
}

export function validarConsulta(
  consulta: ConsultaEmMontagem,
  dias: DiaDeDisponibilidade[],
  acoesMinimas: number,
  acoesMaximas: number,
  maxPracas: number,
): string[] {
  const erros: string[] = []

  if (!consulta.clienteId) erros.push('Escolha um cliente para consultar.')
  if (!consulta.programaId) erros.push('Escolha um programa para consultar.')
  if (consulta.itens.length === 0) erros.push('Selecione ao menos uma data.')

  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  for (const item of consulta.itens) {
    const dia = porData.get(item.data)

    if (!dia || dia.estado !== 'disponivel') {
      erros.push(`A data ${item.data} não está disponível.`)
      continue
    }

    const limite = limiteDeAcoesNoDia(dia, acoesMaximas)
    if (item.quantidade > limite) {
      erros.push(`A data ${item.data} comporta no máximo ${limite} ação${limite > 1 ? 'ões' : ''}.`)
    }
    if (item.quantidade < acoesMinimas) {
      erros.push(`A data ${item.data} exige ao menos ${acoesMinimas} ações.`)
    }

    if (consulta.modalidade === 'regional') {
      if (item.pracas.length === 0) {
        erros.push(`Selecione ao menos uma praça na data ${item.data}.`)
      }
      if (item.pracas.length > maxPracas) {
        erros.push(`A data ${item.data} pode ter no máximo ${maxPracas} praças.`)
      }
    }
  }

  return erros
}

/**
 * Total da consulta. Data cujo valor não pôde ser apurado (`valor_unitario`
 * nulo — programa sem custo de mídia cadastrado) contribui zero, para o total
 * nunca virar `NaN` na tela; o resumo mostra o aviso separadamente.
 */
export function totalDaConsulta(
  consulta: ConsultaEmMontagem,
  dias: DiaDeDisponibilidade[],
): number {
  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  return arredondar(
    consulta.itens.reduce((total, item) => {
      const unitario = porData.get(item.data)?.valor_unitario ?? 0
      return total + unitario * item.quantidade
    }, 0),
  )
}
