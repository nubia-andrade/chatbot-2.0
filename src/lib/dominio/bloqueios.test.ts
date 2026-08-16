import { describe, it, expect } from 'vitest'
import { estaBloqueada, indexarBloqueios, dentroDoPrazoMinimo, diasDeAntecedencia } from './bloqueios'

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

describe('indexarBloqueios', () => {
  // O índice é lido por uma grade mensal: só interessam as datas do mês
  // exibido, mesmo que `bloqueios` tenha datas de outros meses.
  it('inclui só as datas pedidas que estão bloqueadas, com o bloqueio inteiro', () => {
    const indice = indexarBloqueios(bloqueios, ['2026-09-06', '2026-09-07', '2026-12-25'])

    expect(indice.size).toBe(2)
    expect(indice.get('2026-09-07')).toEqual({
      data: '2026-09-07',
      motivo: 'Feriado — programa não vai ao ar',
    })
    expect(indice.get('2026-12-25')).toEqual({ data: '2026-12-25', motivo: 'Natal' })
    expect(indice.has('2026-09-06')).toBe(false)
  })

  it('não inclui uma data bloqueada que não foi pedida', () => {
    // '2026-12-25' está bloqueada de verdade, mas não faz parte do mês
    // consultado — o índice de um mês não pode vazar bloqueios de outro.
    const indice = indexarBloqueios(bloqueios, ['2026-09-07'])

    expect(indice.size).toBe(1)
    expect(indice.has('2026-12-25')).toBe(false)
  })

  it('devolve índice vazio sem bloqueio nenhum', () => {
    expect(indexarBloqueios([], ['2026-09-07']).size).toBe(0)
  })

  // O índice reflete o que `estaBloqueada` decide — inclusive o critério de
  // desempate quando a mesma data aparece mais de uma vez na lista (o
  // primeiro bloqueio da lista vence, mesma regra de `estaBloqueada`).
  it('em caso de duplicata na lista, usa a mesma decisão que estaBloqueada tomaria', () => {
    const comDuplicata = [
      { data: '2026-09-07', motivo: 'Motivo A' },
      { data: '2026-09-07', motivo: 'Motivo B' },
    ]
    const indice = indexarBloqueios(comDuplicata, ['2026-09-07'])

    expect(indice.get('2026-09-07')).toEqual(estaBloqueada(comDuplicata, '2026-09-07'))
    expect(indice.get('2026-09-07')?.motivo).toBe('Motivo A')
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
