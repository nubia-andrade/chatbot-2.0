import { describe, it, expect } from 'vitest'
import { domingoDePascoa, feriadosDoAno, feriadoEm } from './feriados'

describe('domingoDePascoa', () => {
  // Datas conferíveis em qualquer calendário — se o algoritmo não bater com
  // elas, o algoritmo está errado, não o teste.
  it('acerta a Páscoa de anos conhecidos', () => {
    expect(domingoDePascoa(2025)).toBe('2025-04-20')
    expect(domingoDePascoa(2026)).toBe('2026-04-05')
    expect(domingoDePascoa(2027)).toBe('2027-03-28')
  })
})

describe('feriadosDoAno', () => {
  it('traz os oito fixos', () => {
    const datas = feriadosDoAno(2026).map((f) => f.data)
    for (const fixo of [
      '2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07',
      '2026-10-12', '2026-11-02', '2026-11-15', '2026-12-25',
    ]) {
      expect(datas).toContain(fixo)
    }
  })

  // Os móveis são a razão da função existir: ninguém sabe de cabeça quando
  // cai o Carnaval de 2027, e é o feriado que mais desloca grade comercial.
  it('calcula os móveis a partir da Páscoa', () => {
    const de2026 = feriadosDoAno(2026)
    expect(de2026).toContainEqual({ data: '2026-02-17', nome: 'Carnaval' })
    expect(de2026).toContainEqual({ data: '2026-04-03', nome: 'Sexta-feira Santa' })
    expect(de2026).toContainEqual({ data: '2026-06-04', nome: 'Corpus Christi' })
  })

  it('acerta o Carnaval em anos diferentes', () => {
    expect(feriadosDoAno(2025).find((f) => f.nome === 'Carnaval')?.data).toBe('2025-03-04')
    expect(feriadosDoAno(2027).find((f) => f.nome === 'Carnaval')?.data).toBe('2027-02-09')
  })

  it('vem ordenado por data', () => {
    const datas = feriadosDoAno(2026).map((f) => f.data)
    expect([...datas].sort()).toEqual(datas)
  })
})

describe('feriadoEm', () => {
  it('nomeia a data quando é feriado', () => {
    expect(feriadoEm('2026-12-25')).toEqual({ data: '2026-12-25', nome: 'Natal' })
  })

  it('devolve nulo em dia comum', () => {
    expect(feriadoEm('2026-08-21')).toBeNull()
  })

  it('funciona em qualquer ano, sem tabela fixa', () => {
    expect(feriadoEm('2031-01-01')?.nome).toBe('Confraternização Universal')
  })
})
