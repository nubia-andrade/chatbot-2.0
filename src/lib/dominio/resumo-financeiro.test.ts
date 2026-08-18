import { describe, expect, it } from 'vitest'
import { calcularResumoFinanceiro } from './resumo-financeiro'
import type { Programa } from './cadastro'

const programa = {
  id: 'p1',
  nome: 'Mais Você',
  mnemonico: 'MAVO',
  imagem_url: null,
  canal: 'TV Globo',
  possui_fluxo_aprovacao: false,
  contem_digital: true,
  redes_sociais: false,
  estado: 'ativo',
  dias_da_semana: [1, 2, 3, 4, 5],
  slots: 3,
  bloqueio_mensal: 12,
  acoes_minimas: 1,
  acoes_maximas: 12,
  custo_midia_tv: 100,
  custo_producao_tv: 20,
  percentual_simulcast: 10,
  custo_midia_digital: 50,
  custo_producao_digital: 5,
  prazo_minimo_dias: 3,
  disponivel_para_proposta: true,
  atualizado_em: '2026-08-18',
  aceita_regional: false,
  dia_da_semana_regional: null,
  prazo_minimo_regional_dias: null,
  max_pracas_por_acao: 3,
  custo_producao_regional: null,
  bloqueio_mensal_regional: 0,
} satisfies Programa

describe('calcularResumoFinanceiro', () => {
  it('separa Total Comercial de produção e direitos', () => {
    const resumo = calcularResumoFinanceiro({
      programa,
      modalidade: 'nacional',
      itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }],
      periodosEspeciais: [],
    })

    expect(resumo.midia_tv).toBe(100)
    expect(resumo.midia_digital).toBe(50)
    expect(resumo.simulcast).toBe(10)
    expect(resumo.total_comercial).toBe(160)
    expect(resumo.producao).toBe(25)
    expect(resumo.direitos_tv).toBe(16.5)
    expect(resumo.direitos_digital).toBe(7.5)
    expect(resumo.direitos_total).toBe(24)
    expect(resumo.total_geral).toBe(209)
  })

  it('aplica período especial em TV e Digital antes de simulcast e direitos', () => {
    const resumo = calcularResumoFinanceiro({
      programa,
      modalidade: 'nacional',
      itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }],
      periodosEspeciais: [{
        nome: 'Especial',
        data_inicio: '2026-09-01',
        data_fim: '2026-09-30',
        percentual_acrescimo: 20,
      }],
    })

    expect(resumo.midia_tv).toBe(120)
    expect(resumo.midia_digital).toBe(60)
    expect(resumo.simulcast).toBe(12)
    expect(resumo.total_comercial).toBe(192)
    expect(resumo.direitos_tv).toBe(19.8)
    expect(resumo.direitos_digital).toBe(9)
    expect(resumo.producao).toBe(25)
    expect(resumo.total_geral).toBe(245.8)
  })
})
