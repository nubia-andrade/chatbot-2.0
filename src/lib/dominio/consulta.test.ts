import { describe, it, expect } from 'vitest'
import { limiteDeAcoesNoDia, validarConsulta, totalDaConsulta } from './consulta'
import type { DiaDeDisponibilidade } from './disponibilidade'

function diaLivre(data: string, livres: number, valor: number): DiaDeDisponibilidade {
  return {
    data,
    estado: 'disponivel',
    livres,
    total: livres,
    motivos: [],
    feriado: null,
    pracas: [],
    valor_unitario: valor,
    periodo_especial: null,
    acoes_sem_classificacao: 0,
  }
}

const dias = [diaLivre('2026-09-08', 3, 120000), diaLivre('2026-09-09', 1, 120000)]

describe('limiteDeAcoesNoDia', () => {
  // O teto é o menor entre o que o programa permite e o que sobrou no dia.
  it('respeita o menor entre o máximo do programa e os slots livres', () => {
    expect(limiteDeAcoesNoDia(dias[0], 5)).toBe(3)
    expect(limiteDeAcoesNoDia(dias[0], 2)).toBe(2)
    expect(limiteDeAcoesNoDia(dias[1], 5)).toBe(1)
  })

  it('dia indisponível não comporta ação nenhuma', () => {
    expect(limiteDeAcoesNoDia({ ...dias[0], estado: 'esgotado', livres: 0 }, 5)).toBe(0)
  })
})

describe('validarConsulta', () => {
  const base = { clienteId: 'c-1', programaId: 'p-1', modalidade: 'nacional' as const }

  it('aceita consulta bem formada', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-08', quantidade: 2, pracas: [] }] }, dias, 1, 5, 3),
    ).toEqual([])
  })

  it('exige cliente e programa', () => {
    const erros = validarConsulta(
      { clienteId: null, programaId: null, modalidade: 'nacional', itens: [] },
      dias, 1, 5, 3,
    )
    expect(erros).toContain('Escolha um cliente para consultar.')
    expect(erros).toContain('Escolha um programa para consultar.')
  })

  it('exige ao menos uma data', () => {
    expect(validarConsulta({ ...base, itens: [] }, dias, 1, 5, 3)).toContain(
      'Selecione ao menos uma data.',
    )
  })

  it('recusa data que não está disponível', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-12', quantidade: 1, pracas: [] }] }, dias, 1, 5, 3),
    ).toContain('A data 2026-09-12 não está disponível.')
  })

  it('recusa quantidade acima do que sobrou no dia', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-09', quantidade: 2, pracas: [] }] }, dias, 1, 5, 3),
    ).toContain('A data 2026-09-09 comporta no máximo 1 ação.')
  })

  it('recusa quantidade abaixo do mínimo do programa', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }] }, dias, 2, 5, 3),
    ).toContain('A data 2026-09-08 exige ao menos 2 ações.')
  })

  // R9: no regional, o teto de praças por ação vale na consulta também.
  it('recusa mais praças que o permitido por ação', () => {
    const erros = validarConsulta(
      {
        ...base,
        modalidade: 'regional',
        itens: [{ data: '2026-09-08', quantidade: 1, pracas: ['SP', 'RJ', 'BH', 'DF'] }],
      },
      dias, 1, 5, 3,
    )
    expect(erros).toContain('A data 2026-09-08 pode ter no máximo 3 praças.')
  })

  it('no regional exige ao menos uma praça por data', () => {
    expect(
      validarConsulta(
        { ...base, modalidade: 'regional', itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }] },
        dias, 1, 5, 3,
      ),
    ).toContain('Selecione ao menos uma praça na data 2026-09-08.')
  })
})

describe('totalDaConsulta', () => {
  it('soma valor unitário vezes quantidade em cada data', () => {
    expect(
      totalDaConsulta(
        {
          clienteId: 'c-1',
          programaId: 'p-1',
          modalidade: 'nacional',
          itens: [
            { data: '2026-09-08', quantidade: 2, pracas: [] },
            { data: '2026-09-09', quantidade: 1, pracas: [] },
          ],
        },
        dias,
      ),
    ).toBe(360000)
  })

  it('data sem valor apurado contribui zero, sem quebrar o total', () => {
    expect(
      totalDaConsulta(
        {
          clienteId: 'c-1',
          programaId: 'p-1',
          modalidade: 'nacional',
          itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }],
        },
        [{ ...dias[0], valor_unitario: null }],
      ),
    ).toBe(0)
  })
})
