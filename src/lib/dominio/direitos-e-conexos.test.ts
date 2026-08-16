import { describe, it, expect } from 'vitest'
import {
  calcularDireitosTv,
  calcularDireitosDigital,
  PERCENTUAL_DIREITOS_E_CONEXOS,
} from './direitos-e-conexos'

describe('calcularDireitosTv', () => {
  it('caso real conferido com a área: É de Casa — mídia 376.000, simulcast 3% → 58.092,00', () => {
    expect(calcularDireitosTv(376000, 3)).toBe(58092)
  })

  it('simulcast zero não altera a base de cálculo', () => {
    expect(calcularDireitosTv(100000, 0)).toBe(15000)
  })

  it('simulcast ausente equivale a simulcast zero', () => {
    expect(calcularDireitosTv(100000)).toBe(15000)
    expect(calcularDireitosTv(100000, null)).toBe(15000)
  })

  it('mídia ausente devolve null — não dá para calcular, não é custo zero', () => {
    expect(calcularDireitosTv(null, 3)).toBeNull()
    expect(calcularDireitosTv(undefined, 3)).toBeNull()
  })

  it('outro percentual de simulcast', () => {
    // 50.000 + 10% = 55.000; 15% de 55.000 = 8.250
    expect(calcularDireitosTv(50000, 10)).toBe(8250)
  })
})

describe('calcularDireitosDigital', () => {
  it('digital não tem simulcast: 15% direto sobre a mídia digital', () => {
    expect(calcularDireitosDigital(100000)).toBe(15000)
  })

  it('mídia digital ausente devolve null', () => {
    expect(calcularDireitosDigital(null)).toBeNull()
    expect(calcularDireitosDigital(undefined)).toBeNull()
  })
})

describe('PERCENTUAL_DIREITOS_E_CONEXOS', () => {
  it('é 15%, fixo e nomeado', () => {
    expect(PERCENTUAL_DIREITOS_E_CONEXOS).toBe(0.15)
  })
})
