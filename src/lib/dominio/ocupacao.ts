import { ocupaSlot, type MapaDeFormatos } from './formatos'
import { normalizarNome } from './texto'

export type AcaoVendida = {
  programa: string
  data_de_exibicao: string
  formato: string
}

export function chaveDeOcupacao(programa: string, data: string): string {
  return `${programa}|${data}`
}

/**
 * R1 — cada linha da API é uma ação; não existe coluna de quantidade.
 * A contagem considera apenas formatos de categoria AÇÃO DE CONTEÚDO.
 */
export function contarOcupacao(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const acao of acoes) {
    if (!ocupaSlot(acao.formato, mapa)) continue
    const chave = chaveDeOcupacao(acao.programa, acao.data_de_exibicao)
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  return contagem
}

export function ocupacaoEm(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
  programa: string,
  data: string,
): number {
  return contarOcupacao(acoes, mapa).get(chaveDeOcupacao(programa, data)) ?? 0
}

export type AcaoRegionalParaOcupacao = {
  data_de_exibicao: string
  cliente_id: string | null
  cliente_nome: string
  numero_da_entrega: string | null
}

/**
 * Converte linhas de praça do regional em ocupação do inventário nacional.
 *
 * `acoes_regionais` tem UMA LINHA POR PRAÇA. SP+RJ+BH da mesma ação não podem
 * virar três slots nacionais: agrupamos por entrega quando ela existe e, na
 * falta dela, por cliente+data. Se a mesma `numero_da_entrega` já apareceu
 * entre as ações nacionais que ocupam slot, não soma de novo — o registro
 * regional está apenas detalhando a praça de uma venda que o Take já contou.
 */
export function contarRegionalNoInventarioNacional(
  acoes: AcaoRegionalParaOcupacao[],
  entregasNacionaisPorData: Set<string> = new Set(),
): Map<string, number> {
  const contagem = new Map<string, number>()
  const acoesJaContadas = new Set<string>()

  for (const acao of acoes) {
    const chaveEntrega = acao.numero_da_entrega
      ? `${acao.data_de_exibicao}|${acao.numero_da_entrega}`
      : null
    if (chaveEntrega && entregasNacionaisPorData.has(chaveEntrega)) continue

    const chaveDaAcao = chaveEntrega
      ? `entrega|${chaveEntrega}`
      : `cliente|${acao.data_de_exibicao}|${acao.cliente_id ?? normalizarNome(acao.cliente_nome)}`
    if (acoesJaContadas.has(chaveDaAcao)) continue
    acoesJaContadas.add(chaveDaAcao)

    contagem.set(
      acao.data_de_exibicao,
      (contagem.get(acao.data_de_exibicao) ?? 0) + 1,
    )
  }

  return contagem
}
