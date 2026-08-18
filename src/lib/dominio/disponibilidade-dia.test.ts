import { describe, expect, it } from 'vitest'
import { avaliarDisponibilidadeDoDia, type EntradaDaDisponibilidade } from './disponibilidade-dia'

function entrada(
  sobrescritas: Partial<EntradaDaDisponibilidade> = {},
): EntradaDaDisponibilidade {
  return {
    data: '2026-09-05',
    hoje: '2026-08-17',
    programa: {
      dias_da_semana: [6],
      slots: 4,
      prazo_minimo_dias: 10,
    },
    cliente: {
      nome: 'Nestlé Brasil',
      setor: 'Alimentos',
      industria: 'Café',
    },
    ocupacao: 2,
    vendasNaData: [],
    bloqueios: [],
    restricoes: [],
    periodosEspeciais: [],
    ...sobrescritas,
  }
}

describe('avaliarDisponibilidadeDoDia', () => {
  it('libera data da grade com slot restante', () => {
    expect(avaliarDisponibilidadeDoDia(entrada())).toMatchObject({
      estado: 'disponivel',
      selecionavel: true,
      slotsTotais: 4,
      slotsOcupados: 2,
      slotsLivres: 2,
    })
  })

  it('marca fora da grade antes das demais regras', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({ data: '2026-09-04', bloqueios: [{ data: '2026-09-04', motivo: 'Gravação externa' }] }),
    )
    expect(resultado.estado).toBe('fora_grade')
  })

  it('bloqueio vence disponibilidade e preserva o motivo', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({ bloqueios: [{ data: '2026-09-05', motivo: 'Gravação externa' }] }),
    )
    expect(resultado).toMatchObject({
      estado: 'bloqueado',
      selecionavel: false,
      motivo: 'Gravação externa',
    })
  })

  it('bloqueia data dentro do prazo mínimo', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({ data: '2026-08-22', programa: { dias_da_semana: [6], slots: 4, prazo_minimo_dias: 10 } }),
    )
    expect(resultado.estado).toBe('prazo')
  })

  it('aplica restrição cadastrada ao anunciante', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({
        restricoes: [
          { anunciante: null, setor: 'Alimentos', industria: 'Café', motivo: 'Categoria não permitida.' },
        ],
      }),
    )
    expect(resultado).toMatchObject({ estado: 'restricao', motivo: 'Categoria não permitida.' })
  })

  it('bloqueia por concorrência sem expor o nome do concorrente', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({
        vendasNaData: [{ anunciante: 'Outra Empresa', setor: 'Alimentos', industria: 'Café' }],
      }),
    )
    expect(resultado).toMatchObject({
      estado: 'concorrencia',
      motivo: 'Já existe anunciante concorrente nesta data.',
    })
    expect(resultado.motivo).not.toContain('Outra Empresa')
  })

  it('não trata o próprio anunciante como concorrente', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({
        vendasNaData: [{ anunciante: 'Nestlé Brasil', setor: 'Alimentos', industria: 'Café' }],
      }),
    )
    expect(resultado.estado).toBe('disponivel')
  })

  it('marca esgotado quando não há slot livre', () => {
    const resultado = avaliarDisponibilidadeDoDia(entrada({ ocupacao: 4 }))
    expect(resultado).toMatchObject({ estado: 'esgotado', slotsLivres: 0 })
  })

  it('leva a data especial junto sem torná-la indisponível', () => {
    const resultado = avaliarDisponibilidadeDoDia(
      entrada({
        periodosEspeciais: [
          {
            nome: 'Black Friday',
            data_inicio: '2026-09-01',
            data_fim: '2026-09-30',
            percentual_acrescimo: 20,
          },
        ],
      }),
    )
    expect(resultado).toMatchObject({
      estado: 'disponivel',
      periodoEspecial: { nome: 'Black Friday', percentualAcrescimo: 20 },
    })
  })
})

