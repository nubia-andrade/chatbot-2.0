import { normalizarNome as normalizar } from './texto'

export type Restricao = {
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

export type Anunciante = {
  nome: string
  setor: string | null
  industria: string | null
}

export type VendaNaData = {
  anunciante: string
  setor: string | null
  industria: string | null
}

/**
 * R13 — a restrição CADASTRADA pelo consultor: o que ninguém consegue deduzir,
 * como o apresentador não fazer bebidas alcoólicas.
 *
 * A prioridade é estrutural e NÃO depende da ordem em que o banco devolve as
 * linhas: anunciante específico > setor + indústria > Segmentação SE (setor
 * ou indústria isolados). Assim, quando mais de uma regra casa com o mesmo
 * cliente, a interface consegue explicar sempre a restrição mais específica.
 */
export function restricaoQueBloqueia(
  restricoes: Restricao[],
  cliente: Anunciante,
): Restricao | null {
  const nome = normalizar(cliente.nome)
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)

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

  const porSegmentacao = restricoes.find((restricao) => {
    if (normalizar(restricao.anunciante) !== '') return false
    const rSetor = normalizar(restricao.setor)
    const rIndustria = normalizar(restricao.industria)
    const apenasSetor = rSetor !== '' && rIndustria === '' && rSetor === setor
    const apenasIndustria = rSetor === '' && rIndustria !== '' && rIndustria === industria
    return apenasSetor || apenasIndustria
  })

  return porSegmentacao ?? null
}

/**
 * R14 — a concorrência é CALCULADA a partir do que já está vendido na data.
 * Dois clientes concorrem quando compartilham setor e indústria. Cliente sem
 * classificação não gera bloqueio: acusar concorrência sem base impediria
 * venda legítima.
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
