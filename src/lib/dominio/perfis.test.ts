import { describe, it, expect } from 'vitest'
import {
  temPerfil,
  podeAdministrarProgramas,
  podeAdministrarGovernancaGlobal,
  podeExcluirPrograma,
  podeConsultarRegional,
  podeEditarPrograma,
  secoesPadraoDosPerfis,
  podeAcessarSecao,
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

describe('seções por perfil', () => {
  it('executivo vê somente início, nova consulta e propostas por padrão', () => {
    expect(secoesPadraoDosPerfis(['executivo'])).toEqual(['inicio', 'consulta', 'propostas'])
    expect(podeAcessarSecao(secoesPadraoDosPerfis(['executivo']), 'configuracoes')).toBe(false)
  })

  it('executivo regional tem as mesmas seções comerciais', () => {
    expect(secoesPadraoDosPerfis(['executivo_regional'])).toEqual(['inicio', 'consulta', 'propostas'])
  })

  it('perfis acumulados somam suas permissões sem criar seção redundante de histórico', () => {
    expect(secoesPadraoDosPerfis(['executivo', 'consultor_programa'])).toEqual([
      'inicio', 'consulta', 'propostas', 'configuracoes',
    ])
  })

  it('proprietário possui todas as seções atuais', () => {
    expect(secoesPadraoDosPerfis(['proprietario'])).toEqual([
      'inicio', 'consulta', 'propostas', 'configuracoes',
    ])
  })
})

describe('podeConsultarRegional', () => {
  it('exige o perfil regional', () => {
    expect(podeConsultarRegional(['executivo', 'executivo_regional'])).toBe(true)
    expect(podeConsultarRegional(['executivo'])).toBe(false)
  })

  it('proprietário enxerga tudo', () => {
    expect(podeConsultarRegional(['proprietario'])).toBe(true)
  })
})

describe('administração', () => {
  it('consultor e proprietário administram programas', () => {
    expect(podeAdministrarProgramas(['consultor_programa'])).toBe(true)
    expect(podeAdministrarProgramas(['proprietario'])).toBe(true)
  })

  it('governança global é exclusiva do proprietário', () => {
    expect(podeAdministrarGovernancaGlobal(['proprietario'])).toBe(true)
    expect(podeAdministrarGovernancaGlobal(['consultor_programa'])).toBe(false)
    expect(podeAdministrarGovernancaGlobal(['executivo'])).toBe(false)
  })

  it('executivo não administra programas', () => {
    expect(podeAdministrarProgramas(['executivo', 'executivo_regional'])).toBe(false)
  })
})

describe('podeExcluirPrograma', () => {
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
