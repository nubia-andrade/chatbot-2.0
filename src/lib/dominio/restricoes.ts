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
 * como o apresentador não fazer bebidas alcoólicas. Casa do mais específico
 * para o mais genérico: anunciante nomeado, depois setor+indústria, depois
 * setor ou indústria isolados.
 */
export function restricaoQueBloqueia(
  restricoes: Restricao[],
  cliente: Anunciante,
): Restricao | null {
  const nome = normalizar(cliente.nome)
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)

  for (const restricao of restricoes) {
    const rAnunciante = normalizar(restricao.anunciante)
    const rSetor = normalizar(restricao.setor)
    const rIndustria = normalizar(restricao.industria)

    if (rAnunciante !== '' && rAnunciante === nome) return restricao

    if (rAnunciante === '') {
      const setorCasa = rSetor === '' || rSetor === setor
      const industriaCasa = rIndustria === '' || rIndustria === industria
      const temAlgumCriterio = rSetor !== '' || rIndustria !== ''
      if (temAlgumCriterio && setorCasa && industriaCasa) return restricao
    }
  }

  return null
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
