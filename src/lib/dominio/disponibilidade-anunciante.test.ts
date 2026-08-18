import { describe, expect, it } from 'vitest'
import { calcularDisponibilidadeDoMes, type InsumosDeDisponibilidade } from './disponibilidade'
import { montarMapa } from './formatos'
import { indexarAnunciantes } from './casamento-anunciante'

const FORMATOS = montarMapa([
  { formato: 'ACAO DE CONTEUDO', categoria: 'AÇÃO DE CONTEÚDO' },
])

const programa = {
  id: 'mavo',
  mnemonico: 'MAVO',
  dias_da_semana: [1, 2, 3, 4, 5],
  slots: 3,
  bloqueio_mensal: 12,
  prazo_minimo_dias: 3,
  custo_midia_tv: 100000,
  custo_producao_tv: 5000,
  percentual_simulcast: null,
  aceita_regional: false,
  dia_da_semana_regional: null,
  prazo_minimo_regional_dias: null,
  max_pracas_por_acao: 3,
  custo_producao_regional: null,
  bloqueio_mensal_regional: 0,
}

const carteira = [
  { nome: 'PAGBANK', setor: 'Financeiro', industria: 'Serviços financeiros' },
  { nome: 'BANCO X', setor: 'Financeiro', industria: 'Serviços financeiros' },
  { nome: 'NESTLE', setor: 'Alimentos', industria: 'Alimentos' },
]

function base(ajustes: Partial<InsumosDeDisponibilidade> = {}): InsumosDeDisponibilidade {
  return {
    ano: 2026,
    mes: 8,
    hojeIso: '2026-08-18',
    modalidade: 'nacional',
    programa,
    cliente: { nome: 'PAGBANK', setor: 'Financeiro', industria: 'Serviços financeiros' },
    formatos: FORMATOS,
    acoesVendidas: [],
    acoesRegionais: [],
    bloqueios: [],
    periodosEspeciais: [],
    indiceDeAnunciantes: indexarAnunciantes(carteira),
    precosRegionais: [],
    apelidosDoPrograma: ['MAIS VOCE'],
    datasJaCompradasPeloCliente: [],
    acoesDoClienteNoMes: 0,
    ...ajustes,
  }
}

function estadoEm(insumos: InsumosDeDisponibilidade, data: string) {
  const dia = calcularDisponibilidadeDoMes(insumos).find((item) => item.data === data)
  if (!dia) throw new Error(`Data ${data} não encontrada`)
  return dia
}

describe('regras por anunciante no calendário canônico', () => {
  it('mostra ✓ Já comprado mesmo quando a data já passou', () => {
    const resultado = estadoEm(
      base({
        hojeIso: '2026-08-25',
        datasJaCompradasPeloCliente: ['2026-08-10'],
        acoesDoClienteNoMes: 1,
        acoesVendidas: [
          { programa: 'MAIS VOCE', data_de_exibicao: '2026-08-10', formato: 'ACAO DE CONTEUDO', anunciante: 'PAGBANK' },
        ],
      }),
      '2026-08-10',
    )

    expect(resultado.estado).toBe('ja_comprado')
    expect(resultado.motivos.join(' ')).toContain('já possui uma ação')
  })

  it('concorrência real vence o estado já comprado', () => {
    const resultado = estadoEm(
      base({
        datasJaCompradasPeloCliente: ['2026-08-31'],
        acoesDoClienteNoMes: 1,
        acoesVendidas: [
          { programa: 'MAIS VOCE', data_de_exibicao: '2026-08-31', formato: 'ACAO DE CONTEUDO', anunciante: 'PAGBANK' },
          { programa: 'MAIS VOCE', data_de_exibicao: '2026-08-31', formato: 'ACAO DE CONTEUDO', anunciante: 'BANCO X' },
        ],
      }),
      '2026-08-31',
    )

    expect(resultado.estado).toBe('concorrencia')
  })

  it('bloqueia novas datas quando o próprio anunciante chega a 12/12', () => {
    const resultado = estadoEm(base({ acoesDoClienteNoMes: 12 }), '2026-08-31')
    expect(resultado.estado).toBe('limite_mensal')
    expect(resultado.motivos.join(' ')).toContain('12 ações')
  })

  it('vendas de outros anunciantes não consomem o limite mensal do cliente consultado', () => {
    const vendas = Array.from({ length: 12 }, (_, indice) => ({
      programa: 'MAIS VOCE',
      data_de_exibicao: `2026-08-${String((indice % 14) + 3).padStart(2, '0')}`,
      formato: 'ACAO DE CONTEUDO',
      anunciante: 'NESTLE',
    }))

    const resultado = estadoEm(
      base({ acoesVendidas: vendas, acoesDoClienteNoMes: 0 }),
      '2026-08-31',
    )
    expect(resultado.estado).toBe('disponivel')
  })

  it('com 11/12 ainda permite selecionar uma nova data disponível', () => {
    expect(estadoEm(base({ acoesDoClienteNoMes: 11 }), '2026-08-31').estado).toBe('disponivel')
  })
})
