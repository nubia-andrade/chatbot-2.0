import { describe, expect, it } from 'vitest'
import {
  calcularEvolucaoMensal,
  calcularMetricasPerformance,
  calcularRankingExecutivos,
  selecionarVersoesAtuais,
  type LinhaExecutivoPerformance,
  type LinhaParaPerformance,
} from './performance-propostas'

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
    criado_em: parcial.criado_em,
  }
}

function linhaExecutivo(parcial: Partial<LinhaExecutivoPerformance> = {}): LinhaExecutivoPerformance {
  return {
    ...linha(parcial),
    usuario_id: parcial.usuario_id ?? 'u-1',
    executivo_nome: parcial.executivo_nome ?? 'Executivo 1',
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

describe('calcularRankingExecutivos', () => {
  it('ordena por vendido e depois por ofertado', () => {
    const ranking = calcularRankingExecutivos([
      linhaExecutivo({ usuario_id: 'u-a', executivo_nome: 'Ana', grupo_versao_id: 'a1', valor_total_comercial: 500, negociacao_status: 'em_negociacao' }),
      linhaExecutivo({ usuario_id: 'u-b', executivo_nome: 'Bruno', grupo_versao_id: 'b1', valor_total_comercial: 300, negociacao_status: 'fechada', valor_final_negociado: 200 }),
      linhaExecutivo({ usuario_id: 'u-c', executivo_nome: 'Carla', grupo_versao_id: 'c1', valor_total_comercial: 450, negociacao_status: 'fechada', valor_final_negociado: 200 }),
    ])

    expect(ranking.map((item) => item.nome)).toEqual(['Carla', 'Bruno', 'Ana'])
    expect(ranking[0].metricas.valorFechado).toBe(200)
    expect(ranking[0].metricas.valorProposto).toBe(450)
  })

  it('consolida várias propostas do mesmo executivo', () => {
    const ranking = calcularRankingExecutivos([
      linhaExecutivo({ usuario_id: 'u-a', executivo_nome: 'Ana', grupo_versao_id: 'a1', valor_total_comercial: 100 }),
      linhaExecutivo({ usuario_id: 'u-a', executivo_nome: 'Ana', grupo_versao_id: 'a2', valor_total_comercial: 250, negociacao_status: 'fechada', valor_final_negociado: 220 }),
    ])

    expect(ranking).toHaveLength(1)
    expect(ranking[0].metricas.propostas).toBe(2)
    expect(ranking[0].metricas.valorProposto).toBe(350)
    expect(ranking[0].metricas.valorFechado).toBe(220)
  })
})

describe('calcularEvolucaoMensal', () => {
  it('agrupa ofertado e vendido pelo mês de criação da proposta', () => {
    const evolucao = calcularEvolucaoMensal([
      linha({
        grupo_versao_id: '1',
        criado_em: '2026-06-10T10:00:00.000Z',
        valor_total_comercial: 100,
        negociacao_status: 'fechada',
        valor_final_negociado: 80,
      }),
      linha({
        grupo_versao_id: '2',
        criado_em: '2026-06-20T10:00:00.000Z',
        valor_total_comercial: 200,
        negociacao_status: 'em_negociacao',
      }),
      linha({
        grupo_versao_id: '3',
        criado_em: '2026-07-05T10:00:00.000Z',
        valor_total_comercial: 300,
        negociacao_status: 'fechada',
        valor_final_negociado: 250,
      }),
    ], new Date('2026-08-19T12:00:00.000Z'), 3)

    expect(evolucao).toEqual([
      { mes: '2026-06', rotulo: 'jun/26', ofertado: 300, vendido: 80, propostas: 2, fechadas: 1 },
      { mes: '2026-07', rotulo: 'jul/26', ofertado: 300, vendido: 250, propostas: 1, fechadas: 1 },
      { mes: '2026-08', rotulo: 'ago/26', ofertado: 0, vendido: 0, propostas: 0, fechadas: 0 },
    ])
  })

  it('mantém meses sem propostas para preservar a continuidade da linha', () => {
    const evolucao = calcularEvolucaoMensal([], new Date('2026-08-19T12:00:00.000Z'), 4)

    expect(evolucao.map((ponto) => ponto.mes)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
    expect(evolucao.every((ponto) => ponto.ofertado === 0 && ponto.vendido === 0)).toBe(true)
  })
})
