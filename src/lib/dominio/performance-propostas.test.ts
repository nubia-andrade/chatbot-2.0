import { describe, expect, it } from 'vitest'
import { calcularMetricasPerformance, selecionarVersoesAtuais, type LinhaParaPerformance } from './performance-propostas'

function linha(parcial: Partial<LinhaParaPerformance> = {}): LinhaParaPerformance {
  return {
    id: parcial.id ?? crypto.randomUUID(),
    cliente_id: parcial.cliente_id ?? 'c-1',
    cliente_nome: parcial.cliente_nome ?? 'Cliente',
    modalidade: parcial.modalidade ?? 'nacional',
    inclui_digital: parcial.inclui_digital ?? false,
    inclui_redes_sociais: parcial.inclui_redes_sociais ?? false,
    valor_total_comercial: parcial.valor_total_comercial ?? 100,
    valor_final_negociado: parcial.valor_final_negociado ?? null,
    negociacao_status: parcial.negociacao_status ?? 'em_negociacao',
    grupo_versao_id: parcial.grupo_versao_id ?? 'g-1',
    versao: parcial.versao ?? 1,
    status: parcial.status ?? 'gerada',
  }
}

describe('selecionarVersoesAtuais', () => {
  it('mantém apenas a versão mais recente da mesma família', () => {
    const atuais = selecionarVersoesAtuais([
      linha({ id: 'v1', grupo_versao_id: 'grupo', versao: 1, negociacao_status: 'substituida' }),
      linha({ id: 'v2', grupo_versao_id: 'grupo', versao: 2, valor_total_comercial: 150 }),
    ])

    expect(atuais).toHaveLength(1)
    expect(atuais[0].id).toBe('v2')
    expect(atuais[0].valor_total_comercial).toBe(150)
  })

  it('exclui PDF em falha ou ainda gerando', () => {
    expect(selecionarVersoesAtuais([
      linha({ id: 'falha', grupo_versao_id: 'a', status: 'falha' }),
      linha({ id: 'gerando', grupo_versao_id: 'b', status: 'gerando' }),
    ])).toEqual([])
  })
})

describe('calcularMetricasPerformance', () => {
  it('calcula conversão apenas sobre negociações decididas', () => {
    const metricas = calcularMetricasPerformance([
      linha({ grupo_versao_id: '1', negociacao_status: 'fechada', valor_final_negociado: 90 }),
      linha({ grupo_versao_id: '2', negociacao_status: 'perdida' }),
      linha({ grupo_versao_id: '3', negociacao_status: 'em_negociacao' }),
      linha({ grupo_versao_id: '4', negociacao_status: 'em_negociacao' }),
    ])

    expect(metricas.propostas).toBe(4)
    expect(metricas.fechadas).toBe(1)
    expect(metricas.perdidas).toBe(1)
    expect(metricas.emNegociacao).toBe(2)
    expect(metricas.conversao).toBe(50)
    expect(metricas.valorFechado).toBe(90)
  })

  it('não inventa conversão quando nenhuma negociação foi decidida', () => {
    const metricas = calcularMetricasPerformance([
      linha({ grupo_versao_id: '1', negociacao_status: 'em_negociacao' }),
    ])

    expect(metricas.conversao).toBeNull()
  })
})
