import { describe, it, expect } from 'vitest'
import { podeComprarRegional, normalizarCnpj, separarCnpjsColados } from './elegibilidade-regional'

describe('podeComprarRegional', () => {
  it('libera cliente marcado como apto', () => {
    expect(podeComprarRegional({ apto_regional: true })).toBe(true)
  })

  it('bloqueia cliente não marcado', () => {
    expect(podeComprarRegional({ apto_regional: false })).toBe(false)
  })
})

describe('normalizarCnpj', () => {
  // CNPJs reais da carteira (dados/Carteira.xlsx), formatados de jeitos diferentes.
  it('compara CNPJ formatado com CNPJ só de dígitos, mesmo cliente', () => {
    expect(normalizarCnpj('06.004.860/0001-80')).toBe(normalizarCnpj('06004860000180'))
  })

  it('compara dois CNPJs formatados de formas diferentes', () => {
    expect(normalizarCnpj('87.547.188/0001-70')).toBe(normalizarCnpj('87547188/0001-70'))
    expect(normalizarCnpj('87.547.188/0001-70')).toBe('87547188000170')
  })

  it('distingue CNPJs diferentes depois de normalizar', () => {
    expect(normalizarCnpj('06.004.860/0001-80')).not.toBe(normalizarCnpj('87.547.188/0001-70'))
  })

  it('trata espaços em volta e devolve vazio para entrada vazia', () => {
    expect(normalizarCnpj('  06.004.860/0001-80  ')).toBe('06004860000180')
    expect(normalizarCnpj('')).toBe('')
    expect(normalizarCnpj(null)).toBe('')
    expect(normalizarCnpj(undefined)).toBe('')
  })
})

describe('separarCnpjsColados', () => {
  it('quebra por linha, ignorando linhas em branco e espaços nas pontas', () => {
    const texto = '06.004.860/0001-80\n\n  87.547.188/0001-70  \r\n14.294.395/0001-97\n'
    expect(separarCnpjsColados(texto)).toEqual([
      '06.004.860/0001-80',
      '87.547.188/0001-70',
      '14.294.395/0001-97',
    ])
  })

  it('devolve lista vazia para texto vazio ou só espaços', () => {
    expect(separarCnpjsColados('')).toEqual([])
    expect(separarCnpjsColados('   \n  \n')).toEqual([])
  })
})
