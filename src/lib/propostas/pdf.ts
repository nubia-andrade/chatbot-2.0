import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ResumoFinanceiroDaProposta } from '../dominio/resumo-financeiro'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

export async function gerarPdfDaProposta(params: {
  propostaId: string
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const largura = 595.28
  const altura = 841.89
  const margem = 44

  let pagina = pdf.addPage([largura, altura])
  let y = altura - margem

  const novaPaginaSePreciso = (espaco: number) => {
    if (y - espaco > margem) return
    pagina = pdf.addPage([largura, altura])
    y = altura - margem
  }

  const texto = (valor: string, tamanho = 10, bold = false) => {
    novaPaginaSePreciso(tamanho + 8)
    pagina.drawText(valor, {
      x: margem,
      y,
      size: tamanho,
      font: bold ? negrito : fonte,
      color: rgb(0.12, 0.1, 0.18),
    })
    y -= tamanho + 7
  }

  pagina.drawRectangle({
    x: 0,
    y: altura - 110,
    width: largura,
    height: 110,
    color: rgb(0.28, 0.12, 0.78),
  })
  pagina.drawText('Proposta Comercial', {
    x: margem,
    y: altura - 65,
    size: 25,
    font: negrito,
    color: rgb(1, 1, 1),
  })
  pagina.drawText(`Proposta ${params.propostaId.slice(0, 8).toUpperCase()}`, {
    x: margem,
    y: altura - 88,
    size: 10,
    font: fonte,
    color: rgb(1, 1, 1),
  })
  y = altura - 145

  texto(params.marcaNome ? `Marca: ${params.marcaNome}` : 'Marca: -', 11, true)
  texto(`Anunciante: ${params.clienteNome}`)
  texto(`Programa: ${params.programaNome}`)
  texto(`Modalidade: ${params.modalidade === 'regional' ? 'Regional' : 'Nacional'}`)
  y -= 8

  texto('Datas e valores', 14, true)
  for (const linha of params.resumo.linhas) {
    novaPaginaSePreciso(88)
    texto(`${dataBr(linha.data)}${linha.pracas.length ? ` - ${linha.pracas.join(', ')}` : ''}`, 11, true)
    texto(`Midia TV: ${moeda(linha.midia_tv)} | Digital: ${moeda(linha.midia_digital)} | Simulcast: ${moeda(linha.simulcast)}`, 9)
    texto(`Total comercial: ${moeda(linha.total_comercial)}`, 9, true)
    texto(`Producao: ${moeda(linha.producao)} | Direitos e conexos: ${moeda(linha.direitos_total)}`, 9)
    if (linha.periodo_especial_nome) {
      texto(`Periodo especial: ${linha.periodo_especial_nome} (+${linha.periodo_especial_percentual}%)`, 9)
    }
    y -= 5
  }

  novaPaginaSePreciso(150)
  y -= 5
  pagina.drawRectangle({
    x: margem,
    y: y - 120,
    width: largura - margem * 2,
    height: 120,
    color: rgb(0.97, 0.96, 0.99),
  })
  y -= 22
  texto(`Midia TV: ${moeda(params.resumo.midia_tv)}`, 10)
  texto(`Midia Digital: ${moeda(params.resumo.midia_digital)}`, 10)
  texto(`Simulcast: ${moeda(params.resumo.simulcast)}`, 10)
  texto(`TOTAL COMERCIAL: ${moeda(params.resumo.total_comercial)}`, 12, true)
  texto(`Producao: ${moeda(params.resumo.producao)}`, 10)
  texto(`Direitos e conexos: ${moeda(params.resumo.direitos_total)}`, 10)
  texto(`Total geral: ${moeda(params.resumo.total_geral)}`, 11, true)

  return pdf.save()
}
