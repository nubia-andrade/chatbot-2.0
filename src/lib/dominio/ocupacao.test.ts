import { describe, it, expect } from 'vitest'
import { montarMapa } from './formatos'
import { contarOcupacao, ocupacaoEm, chaveDeOcupacao } from './ocupacao'

const mapa = montarMapa([
  { formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'AÇÃO ESPECIAL', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL BREAK', categoria: 'COMERCIAL' },
  { formato: 'VINHETA TOP DE 5', categoria: 'VINHETA' },
])

const acoes = [
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO ESPECIAL' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO ESPECIAL' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'COMERCIAL BREAK' },
  { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-08-17', formato: 'VINHETA TOP DE 5' },
]

describe('contarOcupacao', () => {
  // R1: as 6 vendas do Domingão viram 5 slots — o comercial break não conta
  it('conta apenas ações de conteúdo', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.get(chaveDeOcupacao('DOMI - DOMINGAO', '2026-08-16'))).toBe(5)
  })

  it('separa por programa e por data', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.get(chaveDeOcupacao('MAVO - MAIS VOCE', '2026-08-16'))).toBe(1)
  })

  it('não cria entrada para data só com formato que não ocupa slot', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.has(chaveDeOcupacao('MAVO - MAIS VOCE', '2026-08-17'))).toBe(false)
  })
})

describe('ocupacaoEm', () => {
  it('devolve a contagem da data pedida', () => {
    expect(ocupacaoEm(acoes, mapa, 'DOMI - DOMINGAO', '2026-08-16')).toBe(5)
  })

  it('devolve zero para data sem venda', () => {
    expect(ocupacaoEm(acoes, mapa, 'DOMI - DOMINGAO', '2026-12-25')).toBe(0)
  })
})
