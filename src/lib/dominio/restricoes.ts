import { normalizarNome as normalizar } from './texto'

export type Restricao = {
  anunciante: string | null
  setor: string | null
  industria: string | null
  segmentacao_se: string | null
  motivo: string
}

export type Anunciante = {
  nome: string
  setor: string | null
  industria: string | null
  segmentacao_se: string | null
}

export type VendaNaData = {
  anunciante: string
  setor: string | null
  industria: string | null
}

/**
 * R13 — restrição cadastrada pelo consultor.
 *
 * A prioridade é estrutural e independe da ordem do banco:
 * anunciante específico > setor + indústria > Segmentação SE.
 *
 * Segmentação SE é uma classificação própria da Carteira (`clientes.segmentacao_se`)
 * e nunca deve ser inferida a partir de setor ou indústria.
 */
export function restricaoQueBloqueia(
  restricoes: Restricao[],
  cliente: Anunciante,
): Restricao | null {
  const nome = normalizar(cliente.nome)
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)
  const segmentacaoSe = normalizar(cliente.segmentacao_se)

  const porAnunciante = restricoes.find((restricao) => {
    const rAnunciante = normalizar(restricao.anunciante)
    return rAnunciante !== '' && rAnunciante === nome
  })
  if (porAnunciante) return porAnunciante

  const porSetorEIndustria = restricoes.find((restricao) => {
    if (normalizar(restricao.anunciante) !== '') return false
    const rSetor = normalizar(restricao.setor)
    const rIndustria = normalizar(restricao.industria)
    return rSetor !== '' && rIndustria !== '' && rSetor === setor && rIndustria === industria
  })
  if (porSetorEIndustria) return porSetorEIndustria

  const porSegmentacaoSe = restricoes.find((restricao) => {
    if (normalizar(restricao.anunciante) !== '') return false
    if (normalizar(restricao.setor) !== '' || normalizar(restricao.industria) !== '') return false
    const rSegmentacaoSe = normalizar(restricao.segmentacao_se)
    return rSegmentacaoSe !== '' && rSegmentacaoSe === segmentacaoSe
  })

  return porSegmentacaoSe ?? null
}

/**
 * R14 — a concorrência é CALCULADA a partir do que já está vendido na data.
 * Dois clientes concorrem quando compartilham setor e indústria. Segmentação
 * SE não participa da regra de concorrência.
 */
export function concorrenteNaData(
  vendas: VendaNaData[],
  cliente: Anunciante,
): VendaNaData | null {
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)
  if (setor === '' || industria === '') return null

  const nome = normalizar(cliente.nome)
  return (
    vendas.find(
      (venda) =>
        normalizar(venda.anunciante) !== nome &&
        normalizar(venda.setor) === setor &&
        normalizar(venda.industria) === industria,
    ) ?? null
  )
}
