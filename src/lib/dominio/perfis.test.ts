import { describe, it, expect } from 'vitest'
import {
  temPerfil,
  podeAdministrarProgramas,
  podeExcluirPrograma,
  podeConsultarRegional,
  podeEditarPrograma,
} from './perfis'

describe('temPerfil', () => {
  it('encontra o perfil na lista', () => {
    expect(temPerfil(['executivo', 'executivo_regional'], 'executivo_regional')).toBe(true)
  })

  it('devolve falso quando não está na lista', () => {
    expect(temPerfil(['executivo'], 'proprietario')).toBe(false)
    expect(temPerfil([], 'executivo')).toBe(false)
  })
})

describe('podeConsultarRegional', () => {
  // Perfis se acumulam: quem vende nacional e regional tem os dois
  it('exige o perfil regional', () => {
    expect(podeConsultarRegional(['executivo', 'executivo_regional'])).toBe(true)
    expect(podeConsultarRegional(['executivo'])).toBe(false)
  })

  it('proprietário enxerga tudo', () => {
    expect(podeConsultarRegional(['proprietario'])).toBe(true)
  })
})

describe('podeAdministrarProgramas', () => {
  it('vale para consultor e proprietário', () => {
    expect(podeAdministrarProgramas(['consultor_programa'])).toBe(true)
    expect(podeAdministrarProgramas(['proprietario'])).toBe(true)
  })

  it('não vale para executivo', () => {
    expect(podeAdministrarProgramas(['executivo', 'executivo_regional'])).toBe(false)
  })
})

describe('podeExcluirPrograma', () => {
  // Só o proprietário apaga: excluir leva junto datas, restrições e preços
  it('só o proprietário', () => {
    expect(podeExcluirPrograma(['proprietario'])).toBe(true)
    expect(podeExcluirPrograma(['consultor_programa'])).toBe(false)
  })
})

describe('podeEditarPrograma', () => {
  it('consultor edita só o programa a que está vinculado', () => {
    expect(podeEditarPrograma(['consultor_programa'], ['p-1'], 'p-1')).toBe(true)
    expect(podeEditarPrograma(['consultor_programa'], ['p-1'], 'p-2')).toBe(false)
  })

  it('proprietário edita qualquer um, mesmo sem vínculo', () => {
    expect(podeEditarPrograma(['proprietario'], [], 'p-9')).toBe(true)
  })

  it('executivo não edita nada', () => {
    expect(podeEditarPrograma(['executivo'], ['p-1'], 'p-1')).toBe(false)
  })
})
