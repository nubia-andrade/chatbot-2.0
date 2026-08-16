import { describe, it, expect } from 'vitest'
import { periodoEspecialEm, aplicarAcrescimo, validarPeriodoEspecial, type PeriodoEspecial } from './datas-especiais'

const blackFriday: PeriodoEspecial = {
  id: 'bf',
  nome: 'Black Friday',
  data_inicio: '2026-11-20',
  data_fim: '2026-11-30',
  percentual_acrescimo: 20,
}

describe('periodoEspecialEm', () => {
  it('devolve o período quando a data está no meio do intervalo', () => {
    expect(periodoEspecialEm([blackFriday], '2026-11-25')).toEqual(blackFriday)
  })

  // Inclusivo nas duas pontas.
  it('devolve o período quando a data é exatamente a inicial', () => {
    expect(periodoEspecialEm([blackFriday], '2026-11-20')).toEqual(blackFriday)
  })

  it('devolve o período quando a data é exatamente a final', () => {
    expect(periodoEspecialEm([blackFriday], '2026-11-30')).toEqual(blackFriday)
  })

  it('devolve nulo para data fora do período', () => {
    expect(periodoEspecialEm([blackFriday], '2026-12-01')).toBeNull()
  })

  it('devolve nulo quando não há período nenhum', () => {
    expect(periodoEspecialEm([], '2026-11-25')).toBeNull()
  })
})

describe('aplicarAcrescimo', () => {
  // Números reais conferidos com a área.
  it('376.000,00 com 20% de acréscimo vira 451.200,00', () => {
    expect(aplicarAcrescimo(376000, 20)).toBe(451200)
  })

  it('53.000,00 (mídia de SP) com 20% de acréscimo vira 63.600,00', () => {
    expect(aplicarAcrescimo(53000, 20)).toBe(63600)
  })

  it('percentual zero não altera o valor', () => {
    expect(aplicarAcrescimo(376000, 0)).toBe(376000)
  })
})

describe('validarPeriodoEspecial', () => {
  it('aceita um período válido sem conflito', () => {
    expect(
      validarPeriodoEspecial(
        { nome: 'Black Friday', data_inicio: '2026-11-20', data_fim: '2026-11-30', percentual_acrescimo: 20 },
        [],
      ),
    ).toEqual([])
  })

  it('recusa nome vazio', () => {
    const erros = validarPeriodoEspecial(
      { nome: '  ', data_inicio: '2026-11-20', data_fim: '2026-11-30', percentual_acrescimo: 20 },
      [],
    )
    expect(erros).toContain('Informe o nome do período.')
  })

  it('recusa data final anterior à inicial', () => {
    const erros = validarPeriodoEspecial(
      { nome: 'Natal', data_inicio: '2026-12-26', data_fim: '2026-12-25', percentual_acrescimo: 10 },
      [],
    )
    expect(erros).toContain('A data final não pode ser anterior à data inicial.')
  })

  it('aceita data final igual à inicial (período de um dia só)', () => {
    const erros = validarPeriodoEspecial(
      { nome: 'Cyber Monday', data_inicio: '2026-11-30', data_fim: '2026-11-30', percentual_acrescimo: 15 },
      [],
    )
    expect(erros).toEqual([])
  })

  it('recusa percentual negativo', () => {
    const erros = validarPeriodoEspecial(
      { nome: 'Desconto', data_inicio: '2026-11-20', data_fim: '2026-11-30', percentual_acrescimo: -5 },
      [],
    )
    expect(erros).toContain('O percentual de acréscimo não pode ser negativo.')
  })

  it('aceita percentual zero', () => {
    const erros = validarPeriodoEspecial(
      { nome: 'Sem acréscimo', data_inicio: '2026-11-20', data_fim: '2026-11-30', percentual_acrescimo: 0 },
      [],
    )
    expect(erros).toEqual([])
  })

  // As quatro formas de sobreposição — nenhuma é redundante com outra.
  describe('sobreposição, nas quatro formas possíveis', () => {
    it('recusa quando o novo período COMEÇA DENTRO do existente', () => {
      // Black Friday: 20 a 30/11. Novo período: 25/11 a 05/12 — começa dentro, termina fora.
      const erros = validarPeriodoEspecial(
        { nome: 'Semana do Consumidor', data_inicio: '2026-11-25', data_fim: '2026-12-05', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
      ])
    })

    it('recusa quando o novo período TERMINA DENTRO do existente', () => {
      // Novo período: 15 a 25/11 — começa fora, termina dentro do Black Friday.
      const erros = validarPeriodoEspecial(
        { nome: 'Pré-Black Friday', data_inicio: '2026-11-15', data_fim: '2026-11-25', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
      ])
    })

    it('recusa quando o novo período ENGLOBA o existente inteiro', () => {
      // Novo período: Natal ampliado que engloba o Black Friday por completo.
      const erros = validarPeriodoEspecial(
        { nome: 'Fim de Ano', data_inicio: '2026-11-01', data_fim: '2026-12-31', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
      ])
    })

    it('recusa quando o novo período é ENGLOBADO pelo existente inteiro', () => {
      // Novo período: 22 a 24/11 — inteiramente dentro do Black Friday.
      const erros = validarPeriodoEspecial(
        { nome: 'Quinta Sextou', data_inicio: '2026-11-22', data_fim: '2026-11-24', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
      ])
    })

    it('nomeia o período do exemplo da área — Black Friday 20-30/11 recusa Natal 25/11-26/12', () => {
      const erros = validarPeriodoEspecial(
        { nome: 'Natal', data_inicio: '2026-11-25', data_fim: '2026-12-26', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
      ])
    })

    it('aceita período adjacente que não se sobrepõe (começa no dia seguinte ao fim do existente)', () => {
      const erros = validarPeriodoEspecial(
        { nome: 'Natal', data_inicio: '2026-12-01', data_fim: '2026-12-26', percentual_acrescimo: 10 },
        [blackFriday],
      )
      expect(erros).toEqual([])
    })

    it('ignora o próprio período ao editar (mesmo id não conflita consigo mesmo)', () => {
      const erros = validarPeriodoEspecial(
        { id: 'bf', nome: 'Black Friday', data_inicio: '2026-11-20', data_fim: '2026-11-30', percentual_acrescimo: 25 },
        [blackFriday],
      )
      expect(erros).toEqual([])
    })

    it('acumula todos os erros de uma vez, incluindo mais de uma sobreposição', () => {
      const outroPeriodo: PeriodoEspecial = {
        id: 'natal',
        nome: 'Natal',
        data_inicio: '2026-12-01',
        data_fim: '2026-12-26',
        percentual_acrescimo: 10,
      }
      const erros = validarPeriodoEspecial(
        { nome: '', data_inicio: '2026-11-25', data_fim: '2026-12-10', percentual_acrescimo: -1 },
        [blackFriday, outroPeriodo],
      )
      expect(erros).toEqual([
        'Informe o nome do período.',
        'O percentual de acréscimo não pode ser negativo.',
        'O período se sobrepõe a "Black Friday" (2026-11-20 a 2026-11-30).',
        'O período se sobrepõe a "Natal" (2026-12-01 a 2026-12-26).',
      ])
    })
  })
})
