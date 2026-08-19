import { describe, it, expect } from 'vitest'
import { restricaoQueBloqueia, concorrenteNaData } from './restricoes'

const restricoes = [
  { anunciante: 'AMBEV', setor: null, industria: null, motivo: 'Concorrente do patrocinador' },
  { anunciante: null, setor: 'Bebidas', industria: 'Alcoólicas', motivo: 'Apresentadora não faz' },
  { anunciante: null, setor: null, industria: 'Cigarros', motivo: 'Política editorial' },
]

describe('restricaoQueBloqueia', () => {
  it('bloqueia o anunciante cadastrado, sem depender de acento ou caixa', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'ambev', setor: 'Bebidas', industria: 'Cervejas' })
    expect(achado?.motivo).toBe('Concorrente do patrocinador')
  })

  it('bloqueia pelo par setor e indústria', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'Outra Marca', setor: 'Bebidas', industria: 'Alcoólicas' })
    expect(achado?.motivo).toBe('Apresentadora não faz')
  })

  it('bloqueia por Segmentação SE quando há somente indústria', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'Marca X', setor: 'Tabaco', industria: 'Cigarros' })
    expect(achado?.motivo).toBe('Política editorial')
  })

  it('prioriza anunciante específico mesmo quando uma regra genérica aparece antes', () => {
    const achado = restricaoQueBloqueia([
      { anunciante: null, setor: 'Apostas', industria: null, motivo: 'Segmentação genérica' },
      { anunciante: null, setor: 'Apostas', industria: 'Bet', motivo: 'Setor e indústria' },
      { anunciante: 'BETANO BR', setor: null, industria: null, motivo: 'Restrição específica da marca' },
    ], {
      nome: 'Betano BR',
      setor: 'Apostas',
      industria: 'Bet',
    })

    expect(achado?.motivo).toBe('Restrição específica da marca')
  })

  it('prioriza setor e indústria sobre Segmentação SE', () => {
    const achado = restricaoQueBloqueia([
      { anunciante: null, setor: 'Bebidas', industria: null, motivo: 'Só setor' },
      { anunciante: null, setor: 'Bebidas', industria: 'Alcoólicas', motivo: 'Par completo' },
    ], {
      nome: 'Cliente',
      setor: 'Bebidas',
      industria: 'Alcoólicas',
    })

    expect(achado?.motivo).toBe('Par completo')
  })

  it('libera cliente que não casa com nenhuma restrição', () => {
    expect(restricaoQueBloqueia(restricoes, { nome: 'Nestlé', setor: 'Alimentos', industria: 'Chocolates' })).toBeNull()
  })

  it('não bloqueia por setor quando a restrição exige também a indústria', () => {
    expect(restricaoQueBloqueia(restricoes, { nome: 'Suco Bom', setor: 'Bebidas', industria: 'Sucos' })).toBeNull()
  })
})

describe('concorrenteNaData', () => {
  const vendas = [
    { anunciante: 'COCA-COLA', setor: 'Bebidas', industria: 'Refrigerantes' },
    { anunciante: 'NESTLÉ', setor: 'Alimentos', industria: 'Chocolates' },
  ]

  it('acusa concorrente de mesmo setor e indústria', () => {
    const achado = concorrenteNaData(vendas, { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' })
    expect(achado?.anunciante).toBe('COCA-COLA')
  })

  it('libera categoria diferente', () => {
    expect(concorrenteNaData(vendas, { nome: 'PEPSI', setor: 'Bebidas', industria: 'Sucos' })).toBeNull()
  })

  it('não acusa o próprio cliente como concorrente de si mesmo', () => {
    expect(concorrenteNaData(vendas, { nome: 'coca-cola', setor: 'Bebidas', industria: 'Refrigerantes' })).toBeNull()
  })

  it('não acusa nada quando a categoria do cliente é desconhecida', () => {
    expect(concorrenteNaData(vendas, { nome: 'X', setor: null, industria: null })).toBeNull()
  })
})
