import { describe, it, expect } from 'vitest'
import { validarPrograma, vaiAoArEm, type Programa } from './cadastro'

function programa(sobrescritas: Partial<Programa> = {}): Partial<Programa> {
  return {
    nome: 'Mais Você',
    mnemonico: 'MAVO',
    canal: 'TV Globo',
    estado: 'ativo',
    dias_da_semana: [1, 2, 3, 4, 5],
    slots: 3,
    bloqueio_mensal: 20,
    acoes_minimas: 1,
    acoes_maximas: 3,
    prazo_minimo_dias: 15,
    disponivel_para_proposta: true,
    custo_midia: 100000,
    custo_producao: 50000,
    ...sobrescritas,
  }
}

describe('validarPrograma', () => {
  it('aceita cadastro completo', () => {
    expect(validarPrograma(programa())).toEqual([])
  })

  it('exige nome, mnemônico e canal', () => {
    const erros = validarPrograma(programa({ nome: '', mnemonico: '  ', canal: '' }))
    expect(erros).toContain('Informe o nome do programa.')
    expect(erros).toContain('Informe o mnemônico do programa.')
    expect(erros).toContain('Informe o canal onde o programa é exibido.')
  })

  // R7
  it('exige mínimo menor ou igual ao máximo', () => {
    expect(validarPrograma(programa({ acoes_minimas: 5, acoes_maximas: 3 })))
      .toContain('A quantidade mínima de ações não pode ser maior que a máxima.')
  })

  it('exige pelo menos um slot', () => {
    expect(validarPrograma(programa({ slots: 0 })))
      .toContain('O programa precisa ter pelo menos 1 slot por data.')
  })

  it('recusa prazo mínimo negativo', () => {
    expect(validarPrograma(programa({ prazo_minimo_dias: -1 })))
      .toContain('O prazo mínimo não pode ser negativo.')
  })

  it('exige ao menos um dia de exibição', () => {
    expect(validarPrograma(programa({ dias_da_semana: [] })))
      .toContain('Selecione ao menos um dia de exibição.')
  })

  it('recusa dia da semana fora de 0 a 6', () => {
    expect(validarPrograma(programa({ dias_da_semana: [1, 9] })))
      .toContain('Dia da semana inválido: use 0 (domingo) a 6 (sábado).')
  })

  // Custos são condicionais à elegibilidade para proposta
  it('exige custos quando o programa está disponível para proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: true, custo_midia: null, custo_producao: null }),
    )
    expect(erros).toContain('Informe o custo de mídia para programas disponíveis para proposta.')
    expect(erros).toContain('Informe o custo de produção para programas disponíveis para proposta.')
  })

  it('dispensa custos quando o programa não gera proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: false, custo_midia: null, custo_producao: null }),
    )
    expect(erros).toEqual([])
  })
})

describe('vaiAoArEm', () => {
  it('reconhece dia de exibição', () => {
    // 2026-08-17 é uma segunda-feira
    expect(vaiAoArEm({ dias_da_semana: [1, 2, 3, 4, 5] }, '2026-08-17')).toBe(true)
  })

  it('recusa dia sem exibição', () => {
    // 2026-08-16 é um domingo
    expect(vaiAoArEm({ dias_da_semana: [1, 2, 3, 4, 5] }, '2026-08-16')).toBe(false)
  })

  it('reconhece domingo como dia 0', () => {
    expect(vaiAoArEm({ dias_da_semana: [0] }, '2026-08-16')).toBe(true)
  })
})
