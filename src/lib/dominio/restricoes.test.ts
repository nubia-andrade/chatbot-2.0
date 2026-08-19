import { describe, it, expect } from 'vitest'
import { restricaoQueBloqueia, concorrenteNaData } from './restricoes'

const restricoes = [
  { anunciante: 'AMBEV', setor: null, industria: null, segmentacao_se: null, motivo: 'Concorrente do patrocinador' },
  { anunciante: null, setor: 'Bebidas', industria: 'Alcoólicas', segmentacao_se: null, motivo: 'Apresentadora não faz' },
  { anunciante: null, setor: null, industria: null, segmentacao_se: 'BET', motivo: 'Política editorial' },
]

describe('restricaoQueBloqueia', () => {
  it('bloqueia o anunciante cadastrado, sem depender de acento ou caixa', () => {
    const achado = restricaoQueBloqueia(restricoes, {
      nome: 'ambev',
      setor: 'Bebidas',
      industria: 'Cervejas',
      segmentacao_se: 'ALIMENTOS E BEBIDAS',
    })
    expect(achado?.motivo).toBe('Concorrente do patrocinador')
  })

  it('bloqueia pelo par setor e indústria', () => {
    const achado = restricaoQueBloqueia(restricoes, {
      nome: 'Outra Marca',
      setor: 'Bebidas',
      industria: 'Alcoólicas',
      segmentacao_se: 'OUTRA',
    })
    expect(achado?.motivo).toBe('Apresentadora não faz')
  })

  it('bloqueia por Segmentação SE usando o campo próprio da carteira', () => {
    const achado = restricaoQueBloqueia(restricoes, {
      nome: 'Marca X',
      setor: 'Serviços',
      industria: 'Plataformas',
      segmentacao_se: 'bet',
    })
    expect(achado?.motivo).toBe('Política editorial')
  })

  it('não interpreta setor isolado como Segmentação SE', () => {
    const achado = restricaoQueBloqueia([
      { anunciante: null, setor: 'Apostas', industria: null, segmentacao_se: null, motivo: 'Legado' },
    ], {
      nome: 'Cliente',
      setor: 'Apostas',
      industria: 'Bet',
      segmentacao_se: 'BET',
    })
    expect(achado).toBeNull()
  })

  it('prioriza anunciante específico mesmo quando regras genéricas aparecem antes', () => {
    const achado = restricaoQueBloqueia([
      { anunciante: null, setor: null, industria: null, segmentacao_se: 'BET', motivo: 'Segmentação genérica' },
      { anunciante: null, setor: 'Apostas', industria: 'Bet', segmentacao_se: null, motivo: 'Setor e indústria' },
      { anunciante: 'BETANO BR', setor: null, industria: null, segmentacao_se: null, motivo: 'Restrição específica da marca' },
    ], {
      nome: 'Betano BR',
      setor: 'Apostas',
      industria: 'Bet',
      segmentacao_se: 'BET',
    })

    expect(achado?.motivo).toBe('Restrição específica da marca')
  })

  it('prioriza setor e indústria sobre Segmentação SE', () => {
    const achado = restricaoQueBloqueia([
      { anunciante: null, setor: null, industria: null, segmentacao_se: 'BEBIDAS', motivo: 'Segmentação' },
      { anunciante: null, setor: 'Bebidas', industria: 'Alcoólicas', segmentacao_se: null, motivo: 'Par completo' },
    ], {
      nome: 'Cliente',
      setor: 'Bebidas',
      industria: 'Alcoólicas',
      segmentacao_se: 'Bebidas',
    })

    expect(achado?.motivo).toBe('Par completo')
  })

  it('libera cliente que não casa com nenhuma restrição', () => {
    expect(restricaoQueBloqueia(restricoes, {
      nome: 'Nestlé',
      setor: 'Alimentos',
      industria: 'Chocolates',
      segmentacao_se: 'ALIMENTOS',
    })).toBeNull()
  })

  it('não bloqueia por setor quando a restrição exige também a indústria', () => {
    expect(restricaoQueBloqueia(restricoes, {
      nome: 'Suco Bom',
      setor: 'Bebidas',
      industria: 'Sucos',
      segmentacao_se: 'BEBIDAS',
    })).toBeNull()
  })
})

describe('concorrenteNaData', () => {
  const vendas = [
    { anunciante: 'COCA-COLA', setor: 'Bebidas', industria: 'Refrigerantes' },
    { anunciante: 'NESTLÉ', setor: 'Alimentos', industria: 'Chocolates' },
  ]

  it('acusa concorrente de mesmo setor e indústria', () => {
    const achado = concorrenteNaData(vendas, {
      nome: 'PEPSI',
      setor: 'Bebidas',
      industria: 'Refrigerantes',
      segmentacao_se: 'BEBIDAS',
    })
    expect(achado?.anunciante).toBe('COCA-COLA')
  })

  it('libera categoria diferente', () => {
    expect(concorrenteNaData(vendas, {
      nome: 'PEPSI',
      setor: 'Bebidas',
      industria: 'Sucos',
      segmentacao_se: 'BEBIDAS',
    })).toBeNull()
  })

  it('não acusa o próprio cliente como concorrente de si mesmo', () => {
    expect(concorrenteNaData(vendas, {
      nome: 'coca-cola',
      setor: 'Bebidas',
      industria: 'Refrigerantes',
      segmentacao_se: 'BEBIDAS',
    })).toBeNull()
  })

  it('não acusa nada quando a categoria do cliente é desconhecida', () => {
    expect(concorrenteNaData(vendas, {
      nome: 'X',
      setor: null,
      industria: null,
      segmentacao_se: null,
    })).toBeNull()
  })
})
