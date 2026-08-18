import { describe, expect, it } from 'vitest'
import { descreverAcaoDaProposta } from './texto-proposta'

describe('descreverAcaoDaProposta', () => {
  it('descreve uma data com TV e Digital', () => {
    expect(descreverAcaoDaProposta({
      programaNome: 'Mais Você',
      modalidade: 'nacional',
      itens: [{ data: '2026-06-22', quantidade: 1, pracas: [] }],
      incluirDigital: true,
      incluirRedesSociais: false,
    })).toBe('No programa MAIS VOCÊ, previsto no ar em 22/06/2026, com 1 ação na TV e 1 ação no Digital.')
  })

  it('lista até cinco datas do mesmo mês de forma compacta', () => {
    expect(descreverAcaoDaProposta({
      programaNome: 'Mais Você',
      modalidade: 'nacional',
      itens: [19, 20, 21].map((dia) => ({ data: `2026-08-${dia}`, quantidade: 1, pracas: [] })),
      incluirDigital: true,
      incluirRedesSociais: true,
    })).toBe('No programa MAIS VOCÊ, previsto no ar nos dias 19, 20 e 21/08/2026, com 3 ações na TV, 3 ações no Digital e 3 ações em Redes Sociais.')
  })

  it('resume mais de cinco datas pelo intervalo', () => {
    expect(descreverAcaoDaProposta({
      programaNome: 'Mais Você',
      modalidade: 'nacional',
      itens: [
        '2026-08-19', '2026-08-20', '2026-08-21',
        '2026-08-24', '2026-08-25', '2026-09-30',
      ].map((data) => ({ data, quantidade: 1, pracas: [] })),
      incluirDigital: false,
      incluirRedesSociais: false,
    })).toBe('No programa MAIS VOCÊ, previsto no ar em 6 datas entre 19/08 e 30/09/2026, com 6 ações na TV.')
  })

  it('nomeia as praças quando a proposta é regional', () => {
    expect(descreverAcaoDaProposta({
      programaNome: 'Mais Você',
      modalidade: 'regional',
      itens: [{ data: '2026-08-19', quantidade: 1, pracas: ['RJ', 'SP'] }],
      incluirDigital: false,
      incluirRedesSociais: false,
    })).toBe('No programa MAIS VOCÊ, previsto no ar em 19/08/2026, nas praças RJ e SP, com 1 ação na TV.')
  })
})
