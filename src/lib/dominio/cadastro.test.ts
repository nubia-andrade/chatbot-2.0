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
    custo_midia_tv: 100000,
    custo_producao_tv: 50000,
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
  it('exige custos de TV quando o programa está disponível para proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: true, custo_midia_tv: null, custo_producao_tv: null }),
    )
    expect(erros).toContain('Informe o custo de mídia de TV para programas disponíveis para proposta.')
    expect(erros).toContain('Informe o custo de produção de TV para programas disponíveis para proposta.')
  })

  it('dispensa custos quando o programa não gera proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: false, custo_midia_tv: null, custo_producao_tv: null }),
    )
    expect(erros).toEqual([])
  })

  it('não exige custos digitais mesmo quando disponível para proposta', () => {
    const erros = validarPrograma(
      programa({
        disponivel_para_proposta: true,
        custo_midia_digital: null,
        custo_producao_digital: null,
      }),
    )
    expect(erros).toEqual([])
  })

  // R10/R11 — bloco regional, condicional a `aceita_regional`
  it('exige dia da semana e prazo mínimo regional quando aceita regional', () => {
    const erros = validarPrograma(
      programa({
        aceita_regional: true,
        dia_da_semana_regional: null,
        prazo_minimo_regional_dias: null,
      }),
    )
    expect(erros).toContain('Informe o dia da semana da ação regional.')
    expect(erros).toContain('Informe o prazo mínimo regional.')
  })

  it('recusa dia da semana regional fora de 0 a 6', () => {
    const erros = validarPrograma(
      programa({ aceita_regional: true, dia_da_semana_regional: 9, prazo_minimo_regional_dias: 7 }),
    )
    expect(erros).toContain('Dia da semana regional inválido: use 0 (domingo) a 6 (sábado).')
  })

  it('recusa prazo mínimo regional negativo', () => {
    const erros = validarPrograma(
      programa({ aceita_regional: true, dia_da_semana_regional: 5, prazo_minimo_regional_dias: -1 }),
    )
    expect(erros).toContain('O prazo mínimo regional não pode ser negativo.')
  })

  it('recusa máximo de praças por ação abaixo de 1', () => {
    const erros = validarPrograma(
      programa({
        aceita_regional: true,
        dia_da_semana_regional: 5,
        prazo_minimo_regional_dias: 7,
        max_pracas_por_acao: 0,
      }),
    )
    expect(erros).toContain('O máximo de praças por ação regional precisa ser pelo menos 1.')
  })

  it('aceita cadastro regional completo', () => {
    const erros = validarPrograma(
      programa({
        aceita_regional: true,
        dia_da_semana_regional: 5,
        prazo_minimo_regional_dias: 7,
        max_pracas_por_acao: 3,
      }),
    )
    expect(erros).toEqual([])
  })

  it('dispensa o bloco regional quando o programa não aceita regional', () => {
    const erros = validarPrograma(
      programa({
        aceita_regional: false,
        dia_da_semana_regional: null,
        prazo_minimo_regional_dias: null,
      }),
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
