import { describe, it, expect } from 'vitest'
import { calcularCustoDaAcaoNacional } from './custo-da-acao-nacional'

describe('calcularCustoDaAcaoNacional', () => {
  // Caso real do É de Casa, o mesmo de `direitos-e-conexos.test.ts`:
  // mídia 376.000 + simulcast 3% → direitos 58.092.
  const edeCasa = {
    custo_midia_tv: 376000,
    custo_producao_tv: 7910,
    percentual_simulcast: 3,
  }

  it('soma mídia, direitos e produção', () => {
    // 376.000 + 58.092 + 7.910
    expect(calcularCustoDaAcaoNacional(edeCasa)).toBe(442002)
  })

  it('trata produção ausente como zero, sem impedir a conta', () => {
    expect(calcularCustoDaAcaoNacional({ ...edeCasa, custo_producao_tv: null })).toBe(434092)
  })

  // Mídia ausente é "não dá para calcular ainda", não "custa zero" — a mesma
  // convenção de `direitos-e-conexos.ts` e `moeda.ts`.
  it('devolve nulo sem custo de mídia', () => {
    expect(calcularCustoDaAcaoNacional({ ...edeCasa, custo_midia_tv: null })).toBeNull()
  })

  it('sem simulcast, calcula só a parcela de TV', () => {
    // 100.000 + 15.000 + 0
    expect(
      calcularCustoDaAcaoNacional({
        custo_midia_tv: 100000,
        custo_producao_tv: null,
        percentual_simulcast: null,
      }),
    ).toBe(115000)
  })

  // Data especial: o acréscimo incide sobre a MÍDIA, antes dos direitos, que
  // sobem junto. Produção não muda — não é mídia.
  it('aplica o acréscimo do período especial sobre a mídia, antes dos direitos', () => {
    // 100.000 +20% = 120.000; direitos 15% = 18.000; produção 5.000
    expect(
      calcularCustoDaAcaoNacional(
        { custo_midia_tv: 100000, custo_producao_tv: 5000, percentual_simulcast: null },
        20,
      ),
    ).toBe(143000)
  })

  it('acréscimo zero não muda nada', () => {
    expect(calcularCustoDaAcaoNacional(edeCasa, 0)).toBe(442002)
  })
})
