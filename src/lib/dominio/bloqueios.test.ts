import { describe, it, expect } from 'vitest'
import { estaBloqueada, dentroDoPrazoMinimo, diasDeAntecedencia } from './bloqueios'

const bloqueios = [
  { data: '2026-12-25', motivo: 'Natal' },
  { data: '2026-09-07', motivo: 'Feriado — programa não vai ao ar' },
]

describe('estaBloqueada', () => {
  // R12: data bloqueada vence tudo, mesmo com slot livre
  it('devolve o bloqueio, com o motivo', () => {
    expect(estaBloqueada(bloqueios, '2026-12-25')).toEqual({ data: '2026-12-25', motivo: 'Natal' })
  })

  it('devolve nulo para data livre', () => {
    expect(estaBloqueada(bloqueios, '2026-12-26')).toBeNull()
  })

  it('devolve nulo quando não há bloqueio nenhum', () => {
    expect(estaBloqueada([], '2026-12-25')).toBeNull()
  })
})

describe('diasDeAntecedencia', () => {
  it('conta os dias entre hoje e a exibição', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-22')).toBe(7)
  })

  it('devolve zero para o próprio dia', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-15')).toBe(0)
  })

  it('devolve negativo para data passada', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-14')).toBe(-1)
  })
})

describe('dentroDoPrazoMinimo', () => {
  // R11: Encontro exige 7 dias; É de Casa, 10
  it('recusa data com menos dias que o prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-20', 7)).toBe(true)
  })

  it('aceita data exatamente no prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-22', 7)).toBe(false)
  })

  it('aceita data confortavelmente além do prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-09-30', 10)).toBe(false)
  })

  it('trata prazo zero', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-15', 0)).toBe(false)
  })
})
