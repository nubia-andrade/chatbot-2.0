import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { ResumoFinanceiroDaProposta } from '../dominio/resumo-financeiro'
import type { SlideDoModeloDeProposta } from '../dados/modelo-proposta'

const LARGURA = 960
const ALTURA = 540
const MARGEM = 48

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function cortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, Math.max(0, maximo - 1))}…`
}

async function adicionarSlideImagem(
  pdf: PDFDocument,
  slide: SlideDoModeloDeProposta,
  indice: number,
): Promise<void> {
  let resposta: Response
  try {
    resposta = await fetch(slide.imagem_url, { cache: 'no-store' })
  } catch {
    throw new Error(`Não foi possível carregar a imagem do slide ${indice + 1}.`)
  }
  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar a imagem do slide ${indice + 1}.`)
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer())
  const tipo = resposta.headers.get('content-type')?.toLowerCase() ?? ''
  const imagem = tipo.includes('png') || slide.imagem_url.toLowerCase().includes('.png')
    ? await pdf.embedPng(bytes)
    : await pdf.embedJpg(bytes)

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
}

function titulo(
  pagina: ReturnType<PDFDocument['addPage']>,
  negrito: PDFFont,
  texto: string,
  subtitulo?: string,
) {
  pagina.drawText(texto, {
    x: MARGEM,
    y: ALTURA - 72,
    size: 25,
    font: negrito,
    color: rgb(0.14, 0.1, 0.22),
  })
  if (subtitulo) {
    pagina.drawText(subtitulo, {
      x: MARGEM,
      y: ALTURA - 94,
      size: 10,
      font: negrito,
      color: rgb(0.46, 0.36, 0.72),
    })
  }
  pagina.drawRectangle({
    x: MARGEM,
    y: ALTURA - 108,
    width: 54,
    height: 4,
    color: rgb(0.48, 0.18, 0.95),
  })
}

function etiqueta(
  pagina: ReturnType<PDFDocument['addPage']>,
  fonte: PDFFont,
  negrito: PDFFont,
  x: number,
  y: number,
  rotulo: string,
  valor: string,
  largura = 190,
) {
  pagina.drawRectangle({
    x,
    y: y - 50,
    width: largura,
    height: 50,
    color: rgb(0.975, 0.97, 0.99),
    borderColor: rgb(0.9, 0.88, 0.94),
    borderWidth: 1,
  })
  pagina.drawText(rotulo.toUpperCase(), {
    x: x + 12,
    y: y - 17,
    size: 7.5,
    font: negrito,
    color: rgb(0.47, 0.44, 0.53),
  })
  pagina.drawText(cortar(valor, 34), {
    x: x + 12,
    y: y - 36,
    size: 10.5,
    font: fonte,
    color: rgb(0.14, 0.1, 0.22),
  })
}

function adicionarPaginaDeDatas(params: {
  pdf: PDFDocument
  fonte: PDFFont
  negrito: PDFFont
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
  inicio: number
  fim: number
  numero: number
  totalPaginas: number
}) {
  const pagina = params.pdf.addPage([LARGURA, ALTURA])
  pagina.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: rgb(1, 1, 1) })
  titulo(
    pagina,
    params.negrito,
    params.numero === 1 ? 'Resumo da proposta' : 'Datas da proposta',
    `${params.programaNome} · ${params.modalidade === 'regional' ? 'Regional' : 'Nacional'}`,
  )

  if (params.numero === 1) {
    etiqueta(pagina, params.fonte, params.negrito, MARGEM, 390, 'Marca', params.marcaNome ?? '—', 250)
    etiqueta(pagina, params.fonte, params.negrito, 314, 390, 'Anunciante', params.clienteNome, 250)
    etiqueta(pagina, params.fonte, params.negrito, 580, 390, 'Entregas adicionais', [
      params.resumo.incluir_digital ? 'Digital' : null,
      params.resumo.incluir_redes_sociais ? 'Redes sociais' : null,
    ].filter(Boolean).join(' + ') || 'Somente TV', 300)
  }

  const topoTabela = params.numero === 1 ? 315 : 390
  const linhas = params.resumo.linhas.slice(params.inicio, params.fim)
  pagina.drawRectangle({
    x: MARGEM,
    y: topoTabela - 30,
    width: LARGURA - MARGEM * 2,
    height: 30,
    color: rgb(0.16, 0.13, 0.21),
  })

  const colunas = [MARGEM + 12, 190, 360, 500, 650, 805]
  const cabecalhos = ['Data', 'TV', 'Digital / Redes', 'Simulcast', 'Produção + Direitos', 'Total comercial']
  cabecalhos.forEach((cabecalho, i) => {
    pagina.drawText(cabecalho, { x: colunas[i], y: topoTabela - 20, size: 8, font: params.negrito, color: rgb(1, 1, 1) })
  })

  linhas.forEach((linha, i) => {
    const y = topoTabela - 30 - (i + 1) * 48
    if (i % 2 === 0) {
      pagina.drawRectangle({ x: MARGEM, y, width: LARGURA - MARGEM * 2, height: 48, color: rgb(0.985, 0.982, 0.992) })
    }
    pagina.drawText(dataBr(linha.data), { x: colunas[0], y: y + 27, size: 9, font: params.negrito, color: rgb(0.14, 0.1, 0.22) })
    if (linha.periodo_especial_nome) {
      pagina.drawText(cortar(`${linha.periodo_especial_nome} +${linha.periodo_especial_percentual}%`, 24), { x: colunas[0], y: y + 13, size: 7, font: params.fonte, color: rgb(0.48, 0.18, 0.95) })
    }
    pagina.drawText(moeda(linha.midia_tv), { x: colunas[1], y: y + 23, size: 8.5, font: params.fonte, color: rgb(0.14, 0.1, 0.22) })
    const adicionais = [
      params.resumo.incluir_digital ? `Dig. ${moeda(linha.midia_digital)}` : null,
      params.resumo.incluir_redes_sociais ? `Redes ${moeda(linha.redes_sociais)}` : null,
    ].filter(Boolean)
    pagina.drawText(cortar(adicionais.join(' | ') || '—', 34), { x: colunas[2], y: y + 23, size: 8, font: params.fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(moeda(linha.simulcast), { x: colunas[3], y: y + 23, size: 8.5, font: params.fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(cortar(`${moeda(linha.producao)} + ${moeda(linha.direitos_total)}`, 25), { x: colunas[4], y: y + 23, size: 8, font: params.fonte, color: rgb(0.14, 0.1, 0.22) })
    pagina.drawText(moeda(linha.total_comercial), { x: colunas[5], y: y + 23, size: 8.5, font: params.negrito, color: rgb(0.14, 0.1, 0.22) })
  })

  pagina.drawText(`${params.numero}/${params.totalPaginas}`, {
    x: LARGURA - 75,
    y: 24,
    size: 8,
    font: params.fonte,
    color: rgb(0.55, 0.52, 0.6),
  })
}

function adicionarPaginaFinanceira(params: {
  pdf: PDFDocument
  fonte: PDFFont
  negrito: PDFFont
  resumo: ResumoFinanceiroDaProposta
  propostaId: string
}) {
  const pagina = params.pdf.addPage([LARGURA, ALTURA])
  pagina.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: rgb(1, 1, 1) })
  titulo(pagina, params.negrito, 'Investimento', `Proposta ${params.propostaId.slice(0, 8).toUpperCase()}`)

  const cards: Array<[string, number]> = [
    ['Mídia TV', params.resumo.midia_tv],
    ['Simulcast', params.resumo.simulcast],
  ]
  if (params.resumo.incluir_digital) cards.splice(1, 0, ['Mídia Digital', params.resumo.midia_digital])
  if (params.resumo.incluir_redes_sociais) cards.splice(cards.length - 1, 0, ['Redes sociais', params.resumo.redes_sociais])

  const larguraCard = 200
  cards.slice(0, 4).forEach(([rotulo, valor], indice) => {
    const x = MARGEM + indice * 214
    pagina.drawRectangle({ x, y: 338, width: larguraCard, height: 72, color: rgb(0.975, 0.97, 0.99), borderColor: rgb(0.9, 0.88, 0.94), borderWidth: 1 })
    pagina.drawText(rotulo.toUpperCase(), { x: x + 14, y: 385, size: 8, font: params.negrito, color: rgb(0.47, 0.44, 0.53) })
    pagina.drawText(moeda(valor), { x: x + 14, y: 358, size: 15, font: params.negrito, color: rgb(0.14, 0.1, 0.22) })
  })

  pagina.drawRectangle({ x: MARGEM, y: 252, width: LARGURA - MARGEM * 2, height: 64, color: rgb(0.95, 0.925, 1) })
  pagina.drawText('TOTAL COMERCIAL', { x: MARGEM + 18, y: 278, size: 10, font: params.negrito, color: rgb(0.35, 0.17, 0.68) })
  const total = moeda(params.resumo.total_comercial)
  pagina.drawText(total, { x: LARGURA - MARGEM - 18 - params.negrito.widthOfTextAtSize(total, 22), y: 270, size: 22, font: params.negrito, color: rgb(0.48, 0.18, 0.95) })

  etiqueta(pagina, params.fonte, params.negrito, MARGEM, 218, 'Produção TV', moeda(params.resumo.producao_tv), 200)
  etiqueta(pagina, params.fonte, params.negrito, 262, 218, 'Produção Digital', params.resumo.incluir_digital ? moeda(params.resumo.producao_digital) : 'Não incluída', 200)
  etiqueta(pagina, params.fonte, params.negrito, 476, 218, 'Produção Redes', params.resumo.incluir_redes_sociais ? moeda(params.resumo.producao_redes_sociais) : 'Não incluída', 200)
  etiqueta(pagina, params.fonte, params.negrito, 690, 218, 'Direitos e conexos', moeda(params.resumo.direitos_total), 202)

  pagina.drawText('Total geral para registro', { x: MARGEM, y: 96, size: 9, font: params.fonte, color: rgb(0.48, 0.46, 0.53) })
  pagina.drawText(moeda(params.resumo.total_geral), { x: MARGEM, y: 65, size: 18, font: params.negrito, color: rgb(0.14, 0.1, 0.22) })
  pagina.drawText('Produção e Direitos/Conexos são apresentados separadamente do Total Comercial.', { x: MARGEM, y: 38, size: 8, font: params.fonte, color: rgb(0.55, 0.52, 0.6) })
}

export async function gerarPdfDaProposta(params: {
  propostaId: string
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
  slides?: SlideDoModeloDeProposta[]
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  for (let i = 0; i < (params.slides ?? []).length; i += 1) {
    await adicionarSlideImagem(pdf, params.slides![i], i)
  }

  const porPagina = 5
  const paginasDeDatas = Math.max(1, Math.ceil(params.resumo.linhas.length / porPagina))
  for (let pagina = 0; pagina < paginasDeDatas; pagina += 1) {
    adicionarPaginaDeDatas({
      pdf,
      fonte,
      negrito,
      marcaNome: params.marcaNome,
      clienteNome: params.clienteNome,
      programaNome: params.programaNome,
      modalidade: params.modalidade,
      resumo: params.resumo,
      inicio: pagina * porPagina,
      fim: (pagina + 1) * porPagina,
      numero: pagina + 1,
      totalPaginas: paginasDeDatas,
    })
  }

  adicionarPaginaFinanceira({ pdf, fonte, negrito, resumo: params.resumo, propostaId: params.propostaId })
  return pdf.save()
}
