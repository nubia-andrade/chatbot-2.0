import { describe, it, expect } from 'vitest'
import { paraNumero, formatarMoeda } from './moeda'

describe('paraNumero', () => {
  it('aceita número sem separador', () => {
    expect(paraNumero('8300')).toBe(8300)
  })

  it('aceita ponto como separador de milhar', () => {
    expect(paraNumero('8.300')).toBe(8300)
  })

  it('aceita vírgula como separador decimal', () => {
    expect(paraNumero('8300,00')).toBe(8300)
  })

  it('aceita ponto de milhar e vírgula decimal juntos', () => {
    expect(paraNumero('8.300,00')).toBe(8300)
  })

  it('aceita o prefixo R$', () => {
    expect(paraNumero('R$ 8.300,00')).toBe(8300)
  })

  it('campo vazio vira null', () => {
    expect(paraNumero('')).toBeNull()
    expect(paraNumero('   ')).toBeNull()
  })

  it('preserva os centavos', () => {
    expect(paraNumero('1.234,56')).toBe(1234.56)
  })

  it('texto inválido vira null', () => {
    expect(paraNumero('abc')).toBeNull()
  })

  it('aceita múltiplos grupos de milhar', () => {
    expect(paraNumero('1.234.567,89')).toBe(1234567.89)
  })

  it('aceita valor decimal digitado só com ponto e duas casas', () => {
    expect(paraNumero('8.30')).toBe(8.3)
  })

  it('undefined vira null', () => {
    expect(paraNumero(undefined)).toBeNull()
  })
})

describe('formatarMoeda', () => {
  it('formata com milhar e duas casas decimais', () => {
    expect(formatarMoeda(8300)).toBe('8.300,00')
  })

  it('formata centavos', () => {
    expect(formatarMoeda(1234.56)).toBe('1.234,56')
  })

  it('null vira texto vazio', () => {
    expect(formatarMoeda(null)).toBe('')
  })

  it('undefined vira texto vazio', () => {
    expect(formatarMoeda(undefined)).toBe('')
  })

  it('zero é um valor válido, não vazio', () => {
    expect(formatarMoeda(0)).toBe('0,00')
  })
})
