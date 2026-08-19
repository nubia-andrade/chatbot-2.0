import { describe, expect, it } from 'vitest'
import { assuntoDoEmailDaProposta, montarEmailDaProposta, type DadosDoEmailDaProposta } from './template-email'

function dados(overrides: Partial<DadosDoEmailDaProposta> = {}): DadosDoEmailDaProposta {
  return {
    executivoNome: 'Núbia Andrade',
    clienteNome: 'OXFORD PORCELANAS',
    marcaNome: 'OXFORD',
    produto: 'Campanha institucional',
    programaNome: 'Encontro',
    modalidade: 'regional',
    objetivo: 'Awareness',
    itens: [{ data: '2026-11-20', quantidade: 1, pracas: ['SP', 'RJ', 'BH'] }],
    totalComercial: 83000,
    linkPdf: 'https://storage.exemplo/proposta-assinada',
    ...overrides,
  }
}

describe('template de e-mail da proposta', () => {
  it('destaca programa, marca, anunciante, praças e total comercial', () => {
    const html = montarEmailDaProposta(dados())

    expect(html).toContain('Encontro')
    expect(html).toContain('OXFORD PORCELANAS')
    expect(html).toContain('OXFORD')
    expect(html).toContain('SP · RJ · BH')
    expect(html).toMatch(/R\$\s83\.000,00/)
    expect(html).toContain('Abrir proposta')
  })

  it('usa somente link e não inclui produção ou direitos no corpo', () => {
    const html = montarEmailDaProposta(dados())

    expect(html).toContain('https://storage.exemplo/proposta-assinada')
    expect(html).not.toContain('Custo de Produção')
    expect(html).not.toContain('Direitos e Conexos')
    expect(html).not.toContain('attachment')
  })

  it('escapa texto livre antes de montar o HTML', () => {
    const html = montarEmailDaProposta(dados({ objetivo: '<script>alert("x")</script>' }))

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('monta assunto com marca e programa', () => {
    expect(assuntoDoEmailDaProposta(dados())).toBe('Proposta comercial · OXFORD · Encontro')
  })
})
