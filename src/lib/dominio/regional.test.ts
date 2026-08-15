import { describe, it, expect } from 'vitest'
import {
  PRACAS,
  temSlotRegionalEm,
  pracasOcupadasEm,
  pracasLivresEm,
  validarCompra,
  regionalConsomeSlotNacional,
} from './regional'

// Encontro: 1 slot por semana, sextas-feiras (dia 5)
const encontro = { aceita_regional: true, dia_da_semana_regional: 5, max_pracas_por_acao: 3 }
const semRegional = { aceita_regional: false, dia_da_semana_regional: null, max_pracas_por_acao: 3 }

// 2026-08-21 é uma sexta-feira; 2026-08-20 é quinta
const SEXTA = '2026-08-21'
const QUINTA = '2026-08-20'

const vendidas = [
  { data_de_exibicao: SEXTA, praca_codigo: 'SP', cliente_nome: 'Cliente A' },
  { data_de_exibicao: SEXTA, praca_codigo: 'RJ', cliente_nome: 'Cliente A' },
  { data_de_exibicao: SEXTA, praca_codigo: 'BH', cliente_nome: 'Cliente A' },
]

describe('PRACAS', () => {
  it('são as cinco Globos, nesta ordem', () => {
    expect([...PRACAS]).toEqual(['SP', 'RJ', 'BH', 'DF', 'PE1'])
  })
})

describe('temSlotRegionalEm', () => {
  // R10: o slot só existe no dia da semana do programa
  it('existe na sexta do Encontro', () => {
    expect(temSlotRegionalEm(encontro, SEXTA)).toBe(true)
  })

  it('não existe na quinta', () => {
    expect(temSlotRegionalEm(encontro, QUINTA)).toBe(false)
  })

  it('não existe em programa que não vende regional', () => {
    expect(temSlotRegionalEm(semRegional, SEXTA)).toBe(false)
  })
})

describe('pracasLivresEm', () => {
  // R8: cada praça tem seu próprio slot
  it('vendidas SP, RJ e BH, sobram DF e PE1', () => {
    expect(pracasLivresEm(encontro, vendidas, SEXTA)).toEqual(['DF', 'PE1'])
  })

  it('sem venda nenhuma, as cinco estão livres', () => {
    expect(pracasLivresEm(encontro, [], SEXTA)).toEqual(['SP', 'RJ', 'BH', 'DF', 'PE1'])
  })

  it('em dia sem slot, nenhuma praça está livre', () => {
    expect(pracasLivresEm(encontro, [], QUINTA)).toEqual([])
  })
})

describe('pracasOcupadasEm', () => {
  it('lista as praças já vendidas na data', () => {
    expect(pracasOcupadasEm(vendidas, SEXTA)).toEqual(['SP', 'RJ', 'BH'])
  })

  it('ignora outras datas', () => {
    expect(pracasOcupadasEm(vendidas, '2026-08-28')).toEqual([])
  })
})

describe('validarCompra', () => {
  it('aceita compra de praças livres dentro do teto', () => {
    expect(validarCompra(encontro, vendidas, SEXTA, ['DF', 'PE1'])).toEqual([])
  })

  // R9: máximo de praças por ação de um mesmo cliente
  it('recusa mais praças que o permitido por ação', () => {
    expect(validarCompra(encontro, [], SEXTA, ['SP', 'RJ', 'BH', 'DF']))
      .toContain('Uma ação pode ter no máximo 3 praças.')
  })

  it('recusa praça já vendida', () => {
    expect(validarCompra(encontro, vendidas, SEXTA, ['SP']))
      .toContain('A praça SP já está vendida nesta data.')
  })

  it('recusa data sem slot regional', () => {
    expect(validarCompra(encontro, [], QUINTA, ['SP']))
      .toContain('Este programa não tem ação regional nesta data.')
  })

  it('recusa praça inexistente', () => {
    expect(validarCompra(encontro, [], SEXTA, ['XX']))
      .toContain('Praça desconhecida: XX.')
  })

  it('recusa compra sem praça nenhuma', () => {
    expect(validarCompra(encontro, [], SEXTA, []))
      .toContain('Selecione ao menos uma praça.')
  })
})

describe('regionalConsomeSlotNacional', () => {
  it('assume que sim, enquanto a área não confirma', () => {
    expect(regionalConsomeSlotNacional()).toBe(true)
  })
})
