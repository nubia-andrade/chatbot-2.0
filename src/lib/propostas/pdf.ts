import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { ResumoFinanceiroDaProposta } from '../dominio/resumo-financeiro'
import {
  slidesDaSecao,
  type SlideDoModeloDeProposta,
} from '../dominio/modelo-proposta'

const LARGURA = 960
const ALTURA = 540
const MARGEM = 44

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function cortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, Math.max(0, maximo - 3))}...`
}

async function carregarImagemDoSlide(pdf: PDFDocument, slide: SlideDoModeloDeProposta) {
  let resposta: Response
  try {
    resposta = await fetch(slide.imagem_url, { cache: 'no-store' })
  } catch {
    throw new Error('Não foi possível carregar uma imagem do modelo de proposta.')
  }
  if (!resposta.ok) {
    throw new Error('Não foi possível carregar uma imagem do modelo de proposta.')
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer())
  const tipo = resposta.headers.get('content-type')?.toLowerCase() ?? ''
  return tipo.includes('png') || slide.imagem_url.toLowerCase().includes('.png')
    ? pdf.embedPng(bytes)
    : pdf.embedJpg(bytes)
}

async function adicionarSlideImagem(
  pdf: PDFDocument,
  slide: SlideDoModeloDeProposta,
): Promise<PDFPage> {
  const imagem = await carregarImagemDoSlide(pdf, slide)
  const pagina = pdf.addPage([LARGURA, ALTURA])
  pagina.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: rgb(1, 1, 1) })

  const escala = Math.min(LARGURA / imagem.width, ALTURA / imagem.height)
  const largura = imagem.width * escala
  const altura = imagem.height * escala
  pagina.drawImage(imagem, {
    x: (LARGURA - largura) / 2,
    y: (ALTURA - altura) / 2,
    width: largura,
    height: altura,
  })

  return pagina
}

async function novaPaginaDeValor(
  pdf: PDFDocument,
  fundo: SlideDoModeloDeProposta | undefined,
): Promise<PDFPage> {
  const pagina = fundo
    ? await adicionarSlideImagem(pdf, fundo)
    : pdf.addPage([LARGURA, ALTURA])

  if (!fundo) {
    pagina.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: rgb(1, 1, 1) })
  }

  pagina.drawRectangle({
    x: 30,
    y: 28,
    width: LARGURA - 60,
    height: ALTURA - 56,
    color: rgb(1, 1, 1),
    opacity: fundo ? 0.94 : 1,
    borderColor: rgb(0.9, 0.88, 0.94),
    borderWidth: fundo ? 1 : 0,
  })

  return pagina
}

function escreverCabecalhoValor(params: {
  pagina: PDFPage
  fonte: PDFFont
  negrito: PDFFont
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
  paginaAtual: number
  totalPaginas: number
}) {
  const { pagina, fonte, negrito } = params

  pagina.drawText('RESUMO COMERCIAL', {
    x: MARGEM,
    y: 466,
    size: 10,
    font: negrito,
    color: rgb(0.48, 0.18, 0.95),
  })
  pagina.drawText(cortar(params.marcaNome ?? params.clienteNome, 46), {
    x: MARGEM,
    y: 435,
    size: 22,
    font: negrito,
    color: rgb(0.14, 0.1, 0.22),
  })
  pagina.drawText(
    cortar(`${params.programaNome} - ${params.modalidade === 'regional' ? 'Regional' : 'Nacional'}`, 70),
    { x: MARGEM, y: 414, size: 10, font: fonte, color: rgb(0.45, 0.42, 0.5) },
  )

  const adicionais = [
    params.resumo.incluir_digital ? 'Digital' : null,
    params.resumo.incluir_redes_sociais ? 'Redes sociais' : null,
  ].filter(Boolean).join(' + ') || 'TV'

  pagina.drawText(`Entregas: ${adicionais}`, {
    x: 650,
    y: 442,
    size: 9,
    font: negrito,
    color: rgb(0.35, 0.31, 0.4),
  })
  pagina.drawText(`Página ${params.paginaAtual}/${params.totalPaginas}`, {
    x: 780,
    y: 414,
    size: 8,
    font: fonte,
    color: rgb(0.55, 0.52, 0.6),
  })
}

function escreverTabelaDeDatas(params: {
  pagina: PDFPage
  fonte: PDFFont
  negrito: PDFFont
  resumo: ResumoFinanceiroDaProposta
  inicio: number
  fim: number
}) {
  const { pagina, fonte, negrito, resumo } = params
  const linhas = resumo.linhas.slice(params.inicio, params.fim)
  const topo = 382
  const alturaCabecalho = 26
  const alturaLinha = 28
  const colunas = [MARGEM + 8, 158, 285, 416, 548, 682, 814]
  const cabecalhos = ['Data', 'TV', 'Digital', 'Redes', 'Simulcast', 'Prod. + Direitos', 'Total comercial']

  pagina.drawRectangle({
    x: MARGEM,
    y: topo - alturaCabecalho,
    width: LARGURA - MARGEM * 2,
    height: alturaCabecalho,
    color: rgb(0.15, 0.12, 0.2),
  })

  cabecalhos.forEach((texto, indice) => {
    pagina.drawText(texto, {
      x: colunas[indice],
      y: topo - 17,
      size: 7.2,
      font: negrito,
      color: rgb(1, 1, 1),
    })
  })

  linhas.forEach((linha, indice) => {
    const y = topo - alturaCabecalho - (indice + 1) * alturaLinha
    if (indice % 2 === 0) {
      pagina.drawRectangle({
        x: MARGEM,
        y,
        width: LARGURA - MARGEM * 2,
        height: alturaLinha,
        color: rgb(0.982, 0.978, 0.99),
      })
    }

    const textoData = linha.periodo_especial_nome
      ? `${dataBr(linha.data)} *`
      : dataBr(linha.data)

    pagina.drawText(textoData, { x: colunas[0], y: y + 10, size: 7.8, font: negrito, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(moeda(linha.midia_tv), { x: colunas[1], y: y + 10, size: 7.4, font: fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(resumo.incluir_digital ? moeda(linha.midia_digital) : '-', { x: colunas[2], y: y + 10, size: 7.4, font: fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(resumo.incluir_redes_sociais ? moeda(linha.redes_sociais) : '-', { x: colunas[3], y: y + 10, size: 7.4, font: fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(moeda(linha.simulcast), { x: colunas[4], y: y + 10, size: 7.4, font: fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(cortar(`${moeda(linha.producao)} + ${moeda(linha.direitos_total)}`, 28), { x: colunas[5], y: y + 10, size: 7.1, font: fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(moeda(linha.total_comercial), { x: colunas[6], y: y + 10, size: 7.4, font: negrito, color: rgb(0.14, 0.1, 0.22) })
  })

  const especiais = linhas.filter((linha) => linha.periodo_especial_nome)
  if (especiais.length > 0) {
    const descricoes = [...new Set(especiais.map((linha) => `${linha.periodo_especial_nome} +${linha.periodo_especial_percentual}%`))]
    pagina.drawText(`* ${cortar(descricoes.join(' | '), 110)}`, {
      x: MARGEM,
      y: 113,
      size: 7,
      font: fonte,
      color: rgb(0.48, 0.18, 0.95),
    })
  }
}

function escreverTotais(params: {
  pagina: PDFPage
  fonte: PDFFont
  negrito: PDFFont
  resumo: ResumoFinanceiroDaProposta
}) {
  const { pagina, fonte, negrito, resumo } = params

  pagina.drawRectangle({
    x: MARGEM,
    y: 56,
    width: 508,
    height: 46,
    color: rgb(0.95, 0.93, 1),
  })
  pagina.drawText('TOTAL COMERCIAL', {
    x: MARGEM + 14,
    y: 83,
    size: 8.5,
    font: negrito,
    color: rgb(0.35, 0.17, 0.68),
  })
  pagina.drawText(moeda(resumo.total_comercial), {
    x: MARGEM + 14,
    y: 65,
    size: 16,
    font: negrito,
    color: rgb(0.48, 0.18, 0.95),
  })

  const x = 570
  pagina.drawText(`Produção: ${moeda(resumo.producao)}`, { x, y: 89, size: 8.3, font: fonte, color: rgb(0.35, 0.31, 0.4) })
  pagina.drawText(`Direitos e conexos: ${moeda(resumo.direitos_total)}`, { x, y: 73, size: 8.3, font: fonte, color: rgb(0.35, 0.31, 0.4) })
  pagina.drawText(`Total geral: ${moeda(resumo.total_geral)}`, { x, y: 56, size: 9.2, font: negrito, color: rgb(0.14, 0.1, 0.22) })
}

async function adicionarResumoComercial(params: {
  pdf: PDFDocument
  fonte: PDFFont
  negrito: PDFFont
  fundo?: SlideDoModeloDeProposta
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
}) {
  const porPagina = 8
  const totalPaginas = Math.max(1, Math.ceil(params.resumo.linhas.length / porPagina))

  for (let indice = 0; indice < totalPaginas; indice += 1) {
    const pagina = await novaPaginaDeValor(params.pdf, params.fundo)
    escreverCabecalhoValor({
      pagina,
      fonte: params.fonte,
      negrito: params.negrito,
      marcaNome: params.marcaNome,
      clienteNome: params.clienteNome,
      programaNome: params.programaNome,
      modalidade: params.modalidade,
      resumo: params.resumo,
      paginaAtual: indice + 1,
      totalPaginas,
    })
    escreverTabelaDeDatas({
      pagina,
      fonte: params.fonte,
      negrito: params.negrito,
      resumo: params.resumo,
      inicio: indice * porPagina,
      fim: (indice + 1) * porPagina,
    })
    escreverTotais({ pagina, fonte: params.fonte, negrito: params.negrito, resumo: params.resumo })
  }
}

async function adicionarSlides(
  pdf: PDFDocument,
  slides: SlideDoModeloDeProposta[],
) {
  for (const slide of slides) await adicionarSlideImagem(pdf, slide)
}

export async function gerarPdfDaProposta(params: {
  propostaId: string
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
  slides?: SlideDoModeloDeProposta[]
  modoTeste?: boolean
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const slides = params.slides ?? []

  await adicionarSlides(pdf, slidesDaSecao(slides, 'capa'))
  await adicionarSlides(pdf, slidesDaSecao(slides, 'conteudo'))

  if (params.resumo.incluir_digital) {
    await adicionarSlides(pdf, slidesDaSecao(slides, 'digital'))
  }

  if (params.resumo.incluir_redes_sociais) {
    await adicionarSlides(pdf, slidesDaSecao(slides, 'redes_sociais'))
  }

  await adicionarResumoComercial({
    pdf,
    fonte,
    negrito,
    fundo: slidesDaSecao(slides, 'valor')[0],
    marcaNome: params.marcaNome,
    clienteNome: params.clienteNome,
    programaNome: params.programaNome,
    modalidade: params.modalidade,
    resumo: params.resumo,
  })

  await adicionarSlides(pdf, slidesDaSecao(slides, 'observacoes'))
  await adicionarSlides(pdf, slidesDaSecao(slides, 'contracapa'))

  if (params.modoTeste) {
    for (const pagina of pdf.getPages()) {
      pagina.drawText('PREVIA - TESTE', {
        x: LARGURA - 132,
        y: 14,
        size: 8,
        font: negrito,
        color: rgb(0.48, 0.18, 0.95),
        opacity: 0.75,
      })
    }
  }

  pdf.setTitle(`Proposta - ${params.marcaNome ?? params.clienteNome} - ${params.programaNome}`)
  pdf.setSubject(params.modoTeste ? 'Prévia do modelo de proposta' : 'Proposta comercial')
  pdf.setCreator('Chatbot 2.0')

  return pdf.save()
}
