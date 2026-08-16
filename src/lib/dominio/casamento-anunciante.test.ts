import { describe, it, expect } from 'vitest'
import {
  reduzirNomeDeAnunciante,
  indexarAnunciantes,
  classificarAnunciante,
} from './casamento-anunciante'

describe('reduzirNomeDeAnunciante', () => {
  // Os nomes são reais, tirados de `acoes_vendidas` no banco de produção.
  it('tira o asterisco que a API acrescenta', () => {
    expect(reduzirNomeDeAnunciante('AMBEV S.A *')).toBe('AMBEV')
    expect(reduzirNomeDeAnunciante('BOTICARIO *')).toBe('BOTICARIO')
  })

  it('tira as formas societárias', () => {
    expect(reduzirNomeDeAnunciante('VALE SA')).toBe('VALE')
    expect(reduzirNomeDeAnunciante('JBS S/A')).toBe('JBS')
    expect(reduzirNomeDeAnunciante('OTICAS DINIZ LTDA')).toBe('OTICAS DINIZ')
  })

  it('tira o que está entre parênteses', () => {
    expect(reduzirNomeDeAnunciante('BERGAMO COMERCIO LTDA (DUTY COSMETICOS) *')).toBe('BERGAMO')
  })

  it('ignora acento e caixa', () => {
    expect(reduzirNomeDeAnunciante("L'OREAL BRASIL *")).toBe('L OREAL')
    expect(reduzirNomeDeAnunciante('Nestlé')).toBe('NESTLE')
  })

  it('devolve vazio para ausente', () => {
    expect(reduzirNomeDeAnunciante(null)).toBe('')
    expect(reduzirNomeDeAnunciante('   ')).toBe('')
  })

  // Um nome que é SÓ forma societária não sobra nada — e nada nunca casa.
  it('devolve vazio quando não sobra marca nenhuma', () => {
    expect(reduzirNomeDeAnunciante('LTDA SA')).toBe('')
  })
})

describe('indexarAnunciantes e classificarAnunciante', () => {
  const carteira = [
    { nome: 'AMBEV', setor: 'Bebidas', industria: 'Cervejas' },
    { nome: 'Nestlé S/A', setor: 'Alimentos', industria: 'Chocolates' },
    // Duas linhas que reduzem para a mesma chave COM classificação diferente:
    // é o caso ambíguo, que não pode gerar bloqueio.
    { nome: 'ALPHA COMERCIO LTDA', setor: 'Varejo', industria: 'Moda' },
    { nome: 'ALPHA INDUSTRIA SA', setor: 'Química', industria: 'Tintas' },
    // Duas linhas que reduzem igual e CONCORDAM: casamento continua útil.
    { nome: 'BETA LTDA', setor: 'Bancos', industria: 'Financeiro' },
    { nome: 'BETA SA', setor: 'Bancos', industria: 'Financeiro' },
  ]
  const indice = indexarAnunciantes(carteira)

  it('classifica o anunciante da API pelo nome reduzido', () => {
    expect(classificarAnunciante('AMBEV S.A *', indice)).toEqual({
      nome: 'AMBEV',
      setor: 'Bebidas',
      industria: 'Cervejas',
    })
  })

  it('casa apesar da forma societária divergente dos dois lados', () => {
    expect(classificarAnunciante('NESTLE DO BRASIL LTDA', indice)?.industria).toBe('Chocolates')
  })

  // Sem saber QUAL dos dois é, não dá para dizer o setor do concorrente.
  it('devolve nulo quando a chave é ambígua na carteira', () => {
    expect(classificarAnunciante('ALPHA *', indice)).toBeNull()
  })

  it('não considera ambíguo quando os homônimos concordam', () => {
    expect(classificarAnunciante('BETA *', indice)?.setor).toBe('Bancos')
  })

  it('devolve nulo para quem não está na carteira', () => {
    expect(classificarAnunciante('PORTO SEGURO', indice)).toBeNull()
    expect(classificarAnunciante(null, indice)).toBeNull()
  })
})
