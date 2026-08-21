import { describe, expect, it } from 'vitest'
import { deveExibirClienteComMarca, nomePrincipalDaProposta } from './exibicao-marca-cliente'

describe('exibição de marca e cliente', () => {
  it('usa a marca como informação principal', () => {
    expect(nomePrincipalDaProposta('BETANO', 'BETANO BR')).toBe('BETANO')
  })

  it('usa cliente como contingência quando a marca não existe', () => {
    expect(nomePrincipalDaProposta(null, 'SHOPEE BRASIL')).toBe('SHOPEE BRASIL')
  })

  it('exibe cliente somente quando acrescenta informação', () => {
    expect(deveExibirClienteComMarca('BETANO', 'BETANO BR')).toBe(true)
    expect(deveExibirClienteComMarca('SHOPEE BRASIL', 'SHOPEE BRASIL')).toBe(false)
  })

  it('ignora diferenças de caixa, acento e espaços na comparação', () => {
    expect(deveExibirClienteComMarca('  São João ', 'SAO   JOAO')).toBe(false)
  })
})
