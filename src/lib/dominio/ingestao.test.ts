import { describe, it, expect } from 'vitest'
import { montarMapa } from './formatos'
import { converterData, deveImportar, projetar, formatosNovos } from './ingestao'

const HOJE = '2026-08-15'

function bruto(sobrescritas: Record<string, unknown> = {}) {
  return {
    numero_da_entrega: 9163,
    programa: 'DOMI - DOMINGAO',
    nome_da_obra: 'Domingão',
    data_de_exibicao: '16/08/2026',
    anunciante: 'VALE SA',
    marca: 'VALE',
    formatos: 'AÇÃO PLENA',
    tipo_da_entrega: 'Avulsa',
    status_aprovacao: 'Aprovado',
    custo_de_producao: 461000,
    elenco: 'FULANO DE TAL',
    observacoes_financeiras: 'Total Produção: R$ 1.844.000,00',
    ...sobrescritas,
  }
}

describe('converterData', () => {
  it('converte dd/mm/aaaa para o formato do banco', () => {
    expect(converterData('16/08/2026')).toBe('2026-08-16')
    expect(converterData('01/01/2999')).toBe('2999-01-01')
  })

  it('devolve nulo para entrada inválida', () => {
    expect(converterData('')).toBeNull()
    expect(converterData('-')).toBeNull()
    expect(converterData(null)).toBeNull()
    expect(converterData('32/13/2026')).toBeNull()
  })
})

describe('deveImportar', () => {
  it('aceita exibição futura', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '16/08/2026' }), HOJE)).toBe(true)
  })

  it('aceita o próprio dia de hoje', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '15/08/2026' }), HOJE)).toBe(true)
  })

  it('mantém uma exibição passada do mesmo mês para o limite mensal', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '01/08/2026' }), HOJE)).toBe(true)
    expect(deveImportar(bruto({ data_de_exibicao: '14/08/2026' }), HOJE)).toBe(true)
  })

  it('recusa exibição de mês anterior', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '31/07/2026' }), HOJE)).toBe(false)
  })

  // R4: sentinela de ação sem data definida
  it('recusa a data sentinela 01/01/2999', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '01/01/2999' }), HOJE)).toBe(false)
  })

  it('recusa data inválida', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '-' }), HOJE)).toBe(false)
  })
})

describe('projetar', () => {
  it('mantém só as colunas que importam à disponibilidade', () => {
    expect(projetar(bruto())).toEqual({
      numero_da_entrega: '9163',
      programa: 'DOMI - DOMINGAO',
      data_de_exibicao: '2026-08-16',
      anunciante: 'VALE SA',
      marca: 'VALE',
      formato: 'AÇÃO PLENA',
      tipo_da_entrega: 'Avulsa',
      status_aprovacao: 'Aprovado',
    })
  })

  // R5: a categoria não é gravada, é resolvida na leitura
  it('não grava categoria nem campos de produção e financeiro', () => {
    const projetado = projetar(bruto()) as Record<string, unknown>
    expect(projetado.categoria).toBeUndefined()
    expect(projetado.custo_de_producao).toBeUndefined()
    expect(projetado.elenco).toBeUndefined()
    expect(projetado.observacoes_financeiras).toBeUndefined()
  })
})

describe('formatosNovos', () => {
  const mapa = montarMapa([{ formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' }])

  it('lista formato ausente do cadastro, sem repetir', () => {
    const acoes = [
      projetar(bruto({ formatos: 'AÇÃO PLENA' })),
      projetar(bruto({ formatos: 'FORMATO NOVO' })),
      projetar(bruto({ formatos: 'formato novo' })),
    ]
    expect(formatosNovos(acoes, mapa)).toEqual(['FORMATO NOVO'])
  })

  it('não acusa vazio nem traço', () => {
    const acoes = [projetar(bruto({ formatos: '-' })), projetar(bruto({ formatos: '' }))]
    expect(formatosNovos(acoes, mapa)).toEqual([])
  })
})
