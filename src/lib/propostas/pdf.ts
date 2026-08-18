import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { ResumoFinanceiroDaProposta } from '../dominio/resumo-financeiro'
import { descreverAcaoDaProposta } from '../dominio/texto-proposta'
import {
  slidesDaSecao,
  type SlideDoModeloDeProposta,
} from '../dominio/modelo-proposta'

const LARGURA = 960
const ALTURA = 540
const ROSA = rgb(0.96, 0.04, 0.42)
const TEXTO = rgb(0.22, 0.19, 0.23)
const CINZA = rgb(0.57, 0.55, 0.59)
const LINHA = rgb(0.88, 0.87, 0.89)

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
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
  if (fundo) return adicionarSlideImagem(pdf, fundo)

  const pagina = pdf.addPage([LARGURA, ALTURA])
  pagina.drawRectangle({ x: 0, y: 0, width: LARGURA, height: ALTURA, color: rgb(1, 0.02, 0.47) })
  pagina.drawRectangle({ x: 54, y: 58, width: 365, height: 410, color: rgb(1, 1, 1) })
  pagina.drawRectangle({ x: 452, y: 92, width: 430, height: 350, color: rgb(1, 1, 1) })
  return pagina
}

function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, larguraMaxima: number): string[] {
  const paragrafos = texto.replace(/\s+/g, ' ').trim().split('\n')
  const linhas: string[] = []

  for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(' ').filter(Boolean)
    let atual = ''
    for (const palavra of palavras) {
      const candidata = atual ? `${atual} ${palavra}` : palavra
      if (fonte.widthOfTextAtSize(candidata, tamanho) <= larguraMaxima) {
        atual = candidata
      } else {
        if (atual) linhas.push(atual)
        atual = palavra
      }
    }
    if (atual) linhas.push(atual)
  }

  return linhas
}

function escreverBloco(params: {
  pagina: PDFPage
  texto: string
  fonte: PDFFont
  tamanho: number
  x: number
  y: number
  largura: number
  entrelinhas?: number
  maxLinhas?: number
  cor?: ReturnType<typeof rgb>
}): number {
  const entrelinhas = params.entrelinhas ?? params.tamanho * 1.35
  const linhas = quebrarLinhas(params.texto, params.fonte, params.tamanho, params.largura)
  const maxLinhas = params.maxLinhas ?? linhas.length
  const visiveis = linhas.slice(0, maxLinhas)

  if (linhas.length > maxLinhas && visiveis.length > 0) {
    const ultima = visiveis.length - 1
    const base = visiveis[ultima]
    let reduzida = base
    while (reduzida.length > 0 && params.fonte.widthOfTextAtSize(`${reduzida}…`, params.tamanho) > params.largura) {
      reduzida = reduzida.slice(0, -1)
    }
    visiveis[ultima] = `${reduzida.trimEnd()}…`
  }

  visiveis.forEach((linha, indice) => {
    params.pagina.drawText(linha, {
      x: params.x,
      y: params.y - indice * entrelinhas,
      size: params.tamanho,
      font: params.fonte,
      color: params.cor ?? TEXTO,
    })
  })

  return params.y - visiveis.length * entrelinhas
}

function rotulo(pagina: PDFPage, fonte: PDFFont, texto: string, x: number, y: number) {
  pagina.drawText(texto.toUpperCase(), {
    x,
    y,
    size: 8.5,
    font: fonte,
    color: CINZA,
  })
}

function linhaDeValor(params: {
  pagina: PDFPage
  fonte: PDFFont
  negrito: PDFFont
  rotulo: string
  valor: number
  y: number
  destaque?: boolean
}) {
  const fonteRotulo = params.destaque ? params.negrito : params.fonte
  const fonteValor = params.destaque ? params.negrito : params.fonte
  const tamanho = params.destaque ? 12 : 10.5
  const valor = moeda(params.valor)

  params.pagina.drawText(params.rotulo, {
    x: 515,
    y: params.y,
    size: tamanho,
    font: fonteRotulo,
    color: params.destaque ? TEXTO : CINZA,
  })
  params.pagina.drawText(valor, {
    x: 834 - fonteValor.widthOfTextAtSize(valor, tamanho),
    y: params.y,
    size: tamanho,
    font: fonteValor,
    color: ROSA,
  })

  params.pagina.drawLine({
    start: { x: 515, y: params.y - 8 },
    end: { x: 834, y: params.y - 8 },
    thickness: 0.6,
    color: LINHA,
  })
}

function condicoesEspeciais(resumo: ResumoFinanceiroDaProposta): string[] {
  const mapa = new Map<string, string>()
  for (const linha of resumo.linhas) {
    if (!linha.periodo_especial_nome) continue
    const chave = `${linha.periodo_especial_nome}|${linha.periodo_especial_percentual}|${linha.periodo_especial_texto ?? ''}`
    const texto = linha.periodo_especial_texto?.trim()
      || `${linha.periodo_especial_nome} · +${linha.periodo_especial_percentual}% sobre a mídia`
    mapa.set(chave, texto)
  }
  return [...mapa.values()]
}

async function adicionarPropostaComercial(params: {
  pdf: PDFDocument
  fonte: PDFFont
  negrito: PDFFont
  fundo?: SlideDoModeloDeProposta
  marcaNome: string | null
  clienteNome: string
  programaNome: string
  objetivo: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
}) {
  const pagina = await novaPaginaDeValor(params.pdf, params.fundo)
  const cliente = params.marcaNome ?? params.clienteNome
  const textoAcao = descreverAcaoDaProposta({
    programaNome: params.programaNome,
    modalidade: params.modalidade,
    itens: params.resumo.linhas.map((linha) => ({
      data: linha.data,
      quantidade: linha.quantidade,
      pracas: linha.pracas,
    })),
    incluirDigital: params.resumo.incluir_digital,
    incluirRedesSociais: params.resumo.incluir_redes_sociais,
  })

  // Coluna esquerda — contexto comercial. Produto é snapshot para histórico,
  // mas não é impresso por decisão da área.
  rotulo(pagina, params.fonte, 'Cliente', 90, 360)
  escreverBloco({
    pagina,
    texto: cliente,
    fonte: params.negrito,
    tamanho: 14,
    x: 90,
    y: 340,
    largura: 285,
    maxLinhas: 2,
    cor: ROSA,
  })

  rotulo(pagina, params.fonte, 'Conteúdo', 90, 300)
  const depoisConteudo = escreverBloco({
    pagina,
    texto: textoAcao,
    fonte: params.fonte,
    tamanho: 11.5,
    x: 90,
    y: 278,
    largura: 292,
    entrelinhas: 16,
    maxLinhas: 6,
    cor: ROSA,
  })

  const yObjetivo = Math.min(190, depoisConteudo - 18)
  rotulo(pagina, params.fonte, 'Objetivo', 90, yObjetivo)
  escreverBloco({
    pagina,
    texto: params.objetivo,
    fonte: params.fonte,
    tamanho: 10.8,
    x: 90,
    y: yObjetivo - 20,
    largura: 292,
    entrelinhas: 15,
    maxLinhas: 7,
    cor: ROSA,
  })

  // Coluna direita — investimento consolidado. Sem tabela por data.
  pagina.drawText('PROPOSTA COMERCIAL', {
    x: 515,
    y: 382,
    size: 17,
    font: params.negrito,
    color: ROSA,
  })

  let y = 342
  const passo = 30
  linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Mídia', valor: params.resumo.midia_tv, y })
  y -= passo

  if (params.resumo.incluir_digital) {
    linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Digital', valor: params.resumo.midia_digital, y })
    y -= passo
  }
  if (params.resumo.incluir_redes_sociais) {
    linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Redes Sociais', valor: params.resumo.redes_sociais, y })
    y -= passo
  }

  linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Globoplay Simulcast', valor: params.resumo.simulcast, y })
  y -= passo
  linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Total', valor: params.resumo.total_comercial, y, destaque: true })
  y -= 38

  linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Direitos e Conexos', valor: params.resumo.direitos_tv, y })
  y -= 26
  if (params.resumo.incluir_digital) {
    linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Direitos e Conexos Digital', valor: params.resumo.direitos_digital, y })
    y -= 26
  }
  linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Custo de Produção', valor: params.resumo.producao_tv, y })
  y -= 26
  if (params.resumo.incluir_digital) {
    linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Custo de Produção Digital', valor: params.resumo.producao_digital, y })
    y -= 26
  }
  if (params.resumo.incluir_redes_sociais && params.resumo.producao_redes_sociais > 0) {
    linhaDeValor({ pagina, fonte: params.fonte, negrito: params.negrito, rotulo: 'Produção Redes Sociais', valor: params.resumo.producao_redes_sociais, y })
    y -= 26
  }

  const condicoes = condicoesEspeciais(params.resumo)
  if (condicoes.length > 0) {
    pagina.drawText('CONDIÇÃO ESPECIAL', {
      x: 515,
      y: 76,
      size: 7.5,
      font: params.negrito,
      color: ROSA,
    })
    escreverBloco({
      pagina,
      texto: condicoes.join(' · '),
      fonte: params.fonte,
      tamanho: 8.2,
      x: 515,
      y: 62,
      largura: 320,
      entrelinhas: 11,
      maxLinhas: 2,
      cor: TEXTO,
    })
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
  objetivo: string
  modalidade: 'nacional' | 'regional'
  resumo: ResumoFinanceiroDaProposta
  slides?: SlideDoModeloDeProposta[]
  modoTeste?: boolean
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  // A Globotipo Corporativa será incorporada quando o arquivo licenciado for
  // disponibilizado. Até lá, o PDF usa Helvetica sem fingir ser a fonte corporativa.
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

  await adicionarPropostaComercial({
    pdf,
    fonte,
    negrito,
    fundo: slidesDaSecao(slides, 'valor')[0],
    marcaNome: params.marcaNome,
    clienteNome: params.clienteNome,
    programaNome: params.programaNome,
    objetivo: params.objetivo,
    modalidade: params.modalidade,
    resumo: params.resumo,
  })

  await adicionarSlides(pdf, slidesDaSecao(slides, 'observacoes'))
  await adicionarSlides(pdf, slidesDaSecao(slides, 'contracapa'))

  if (params.modoTeste) {
    for (const pagina of pdf.getPages()) {
      pagina.drawText('PRÉVIA - TESTE', {
        x: LARGURA - 122,
        y: 12,
        size: 7.5,
        font: negrito,
        color: ROSA,
        opacity: 0.78,
      })
    }
  }

  pdf.setTitle(`Proposta - ${params.marcaNome ?? params.clienteNome} - ${params.programaNome}`)
  pdf.setSubject(params.modoTeste ? 'Prévia do modelo de proposta' : 'Proposta comercial')
  pdf.setCreator('Chatbot 2.0')

  return pdf.save()
}
