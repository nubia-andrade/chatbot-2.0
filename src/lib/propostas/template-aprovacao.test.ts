import { describe, expect, it } from 'vitest'
import {
  assuntoPropostaAprovada,
  assuntoPropostaRejeitada,
  assuntoSolicitacaoAprovacao,
  montarEmailPropostaAprovada,
  montarEmailPropostaRejeitada,
  montarEmailSolicitacaoAprovacao,
  type DadosEmailAprovacao,
} from './template-aprovacao'

function dados(sobrescritas: Partial<DadosEmailAprovacao> = {}): DadosEmailAprovacao {
  return {
    executivoNome: 'Fabio Couto',
    clienteNome: 'FERRERO DO BRASIL',
    marcaNome: 'NUTELLA',
    produto: 'Linha de produtos',
    programaNome: 'Mais Você',
    modalidade: 'nacional',
    objetivo: 'Awareness',
    itens: [{ data: '2026-08-28', pracas: [] }],
    totalComercial: 460164,
    linkAprovacoes: 'https://chatbot.g.globo/aprovacoes',
    linkPdf: 'https://storage.example/proposta-assinada.pdf',
    justificativa: 'Ajustar o período da ação.',
    ...sobrescritas,
  }
}

describe('template de aprovação', () => {
  it('solicita aprovação ao consultor sem liberar link do PDF', () => {
    const entrada = dados()
    const html = montarEmailSolicitacaoAprovacao(entrada)

    expect(assuntoSolicitacaoAprovacao(entrada)).toContain('Aprovação pendente')
    expect(html).toContain('Nova proposta aguardando sua aprovação')
    expect(html).toContain('Fabio Couto')
    expect(html).toContain('Mais Você')
    expect(html).toContain('https://chatbot.g.globo/aprovacoes')
    expect(html).not.toContain('https://storage.example/proposta-assinada.pdf')
  })

  it('mantém anunciante quando ele é diferente da marca', () => {
    const html = montarEmailSolicitacaoAprovacao(dados())
    expect(html).toContain('NUTELLA')
    expect(html).toContain('FERRERO DO BRASIL')
    expect(html).toContain('Anunciante')
  })

  it('omite anunciante quando marca e cliente são equivalentes', () => {
    const html = montarEmailSolicitacaoAprovacao(dados({
      marcaNome: 'SHOPEE BRASIL',
      clienteNome: 'shopee brasil',
    }))
    expect(html).toContain('SHOPEE BRASIL')
    expect(html).not.toContain('Anunciante')
  })

  it('aprovação positiva entrega o link seguro do PDF ao executivo', () => {
    const entrada = dados()
    const html = montarEmailPropostaAprovada(entrada)

    expect(assuntoPropostaAprovada(entrada)).toContain('Proposta aprovada')
    expect(html).toContain('Sua proposta foi aprovada')
    expect(html).toContain('Abrir proposta')
    expect(html).toContain('https://storage.example/proposta-assinada.pdf')
  })

  it('rejeição informa a justificativa e não inclui link do PDF', () => {
    const entrada = dados()
    const html = montarEmailPropostaRejeitada(entrada)

    expect(assuntoPropostaRejeitada(entrada)).toContain('Ajuste solicitado')
    expect(html).toContain('Sua proposta precisa de ajustes')
    expect(html).toContain('Ajustar o período da ação.')
    expect(html).not.toContain('https://storage.example/proposta-assinada.pdf')
  })

  it('escapa textos livres antes de inserir no HTML', () => {
    const html = montarEmailPropostaRejeitada(dados({
      objetivo: '<script>alert(1)</script>',
      justificativa: '<b>não confiar</b>',
    }))

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>não confiar</b>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;não confiar&lt;/b&gt;')
  })
})
