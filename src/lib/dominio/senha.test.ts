import { describe, it, expect } from 'vitest'
import { problemaDaSenha, MOTIVOS_SENHA, TAMANHO_MINIMO } from './senha'

describe('problemaDaSenha', () => {
  it('acusa senha vazia', () => {
    expect(problemaDaSenha('', '')).toBe(MOTIVOS_SENHA.vazia)
  })

  it('acusa senha curta demais', () => {
    expect(problemaDaSenha('abc123', 'abc123')).toBe(MOTIVOS_SENHA.curta)
  })

  it(`aceita senha com exatamente ${TAMANHO_MINIMO} caracteres`, () => {
    expect(problemaDaSenha('abcd1234', 'abcd1234')).toBeNull()
  })

  it('acusa quando as duas senhas não conferem', () => {
    expect(problemaDaSenha('abcd1234', 'abcd1235')).toBe(MOTIVOS_SENHA.naoConfere)
  })

  it('não acusa nada quando a senha é válida e as duas conferem', () => {
    expect(problemaDaSenha('senha-forte-123', 'senha-forte-123')).toBeNull()
  })

  it('senha vazia tem prioridade sobre a checagem de igualdade', () => {
    expect(problemaDaSenha('', 'qualquercoisa')).toBe(MOTIVOS_SENHA.vazia)
  })
})
