import { describe, it, expect } from 'vitest'
import {
  podeComprarRegional,
  normalizarCnpj,
  separarCnpjsColados,
  cnpjUtil,
  chaveDeCasamento,
  deduplicarPorId,
} from './elegibilidade-regional'

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

describe('cnpjUtil', () => {
  it('devolve os dígitos de um CNPJ de verdade', () => {
    expect(cnpjUtil('06.004.860/0001-80')).toBe('06004860000180')
  })

  // O achado real: sete clientes internacionais diferentes usam
  // "00000000000000" como CNPJ (Amazon Music, Casa de Apostas, etc.) —
  // tratar isso como identificador juntaria clientes distintos.
  it('rejeita CNPJ todo zero', () => {
    expect(cnpjUtil('00000000000000')).toBe('')
    expect(cnpjUtil('00.000.000/0000-00')).toBe('')
  })

  it('rejeita CNPJ incompleto ou ausente', () => {
    expect(cnpjUtil('123')).toBe('')
    expect(cnpjUtil('')).toBe('')
    expect(cnpjUtil(null)).toBe('')
    expect(cnpjUtil(undefined)).toBe('')
  })
})

describe('chaveDeCasamento', () => {
  it('casa dois clientes com o mesmo CNPJ útil e nome equivalente (acento e caixa)', () => {
    const a = chaveDeCasamento({ cnpj: '06.004.860/0001-80', nome: 'Bem Brasil Alimentos' })
    const b = chaveDeCasamento({ cnpj: '06004860000180', nome: 'BEM BRASIL ALIMENTOS' })
    expect(a).toBe(b)
  })

  it('NÃO casa dois clientes diferentes que só compartilham o CNPJ inútil "00000000000000"', () => {
    const amazonMusic = chaveDeCasamento({ cnpj: '00000000000000', nome: 'Amazon Music' })
    const casaDeApostas = chaveDeCasamento({ cnpj: '00000000000000', nome: 'Casa De Apostas' })
    expect(amazonMusic).not.toBe(casaDeApostas)
  })

  it('cai para o nome quando o CNPJ não é útil', () => {
    expect(chaveDeCasamento({ cnpj: '00000000000000', nome: 'Amazon Music' })).toBe(
      chaveDeCasamento({ cnpj: null, nome: 'Amazon Music' }),
    )
  })

  it('distingue clientes de nomes diferentes mesmo sem CNPJ útil nos dois', () => {
    const a = chaveDeCasamento({ cnpj: null, nome: 'Universal Orlando' })
    const b = chaveDeCasamento({ cnpj: '00000000000000', nome: 'Facebook' })
    expect(a).not.toBe(b)
  })
})

describe('deduplicarPorId', () => {
  it('mantém a primeira ocorrência e conta as duplicadas', () => {
    const { itens, duplicadas } = deduplicarPorId([
      { id: '1', valor: 'a' },
      { id: '2', valor: 'b' },
      { id: '1', valor: 'a-repetido' },
      { id: '1', valor: 'a-de-novo' },
    ])
    expect(itens).toEqual([
      { id: '1', valor: 'a' },
      { id: '2', valor: 'b' },
    ])
    expect(duplicadas).toBe(2)
  })

  it('nunca trata itens sem id como duplicata entre si (clientes novos, ainda sem casamento)', () => {
    const { itens, duplicadas } = deduplicarPorId<{ id?: string; valor: string }>([
      { valor: 'novo-1' },
      { valor: 'novo-2' },
    ])
    expect(itens).toHaveLength(2)
    expect(duplicadas).toBe(0)
  })

  it('lista vazia devolve lista vazia e zero duplicadas', () => {
    expect(deduplicarPorId([])).toEqual({ itens: [], duplicadas: 0 })
  })
})
