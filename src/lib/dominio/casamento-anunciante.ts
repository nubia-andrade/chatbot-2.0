import { normalizarNome } from './texto'

/**
 * Casa o `anunciante` de `acoes_vendidas` — texto livre digitado do outro
 * lado da API do Globo Take — com um cliente da carteira, para descobrir o
 * setor e a indústria de quem já comprou uma data. Sem isso, a regra de
 * concorrência (R14) não roda no nacional.
 *
 * Medido contra o banco real em 16/08/2026 (246 ações, 15.519 clientes):
 *
 *   nome normalizado (acento e caixa) .... 48 de 246 — 19,5%
 *   nome reduzido (esta função) .......... 206 de 246 — 83,7%
 *
 * A área informou que a base de clientes do Globo Take será ajustada; a
 * cobertura deve subir. Enquanto não sobe, quem não casa NÃO BLOQUEIA a data
 * — só avisa que a concorrência não foi verificada. Bloquear por precaução
 * esconderia disponibilidade real por causa de grafia de cadastro.
 */

export type ClienteClassificado = {
  nome: string
  setor: string | null
  industria: string | null
}

/** `null` no valor marca chave AMBÍGUA: homônimos com classificação divergente. */
export type IndiceDeAnunciantes = Map<string, ClienteClassificado | null>

/**
 * Formas societárias e qualificadores geográficos — ruído puro para
 * identificar de que MARCA se trata. "AMBEV S.A" e "AMBEV" são a mesma
 * empresa; "DO BRASIL" não distingue ninguém.
 */
const RUIDO =
  /\b(S\s*[/.]?\s*A|SA|LTDA|ME|EPP|EIRELI|CIA|COMPANHIA|DO BRASIL|BRASIL|BR|COMERCIO|INDUSTRIA|PARTICIPACOES|HOLDING)\b/g

/**
 * O nome sem o que não identifica a marca: o `*` que a API acrescenta, o
 * conteúdo entre parênteses (costuma ser a marca fantasia, não a razão
 * social que a carteira guarda), a pontuação e as formas societárias.
 *
 * Devolve string vazia quando não sobra nada — e vazio nunca casa com nada,
 * garantido por `classificarAnunciante`.
 */
export function reduzirNomeDeAnunciante(nome: string | null | undefined): string {
  return normalizarNome(nome)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\*/g, ' ')
    .replace(RUIDO, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Índice da carteira por nome reduzido. Chave cujos homônimos DISCORDAM na
 * classificação vira `null`: dois clientes diferentes viraram o mesmo nome
 * curto, e sem saber qual é não dá para afirmar o setor do concorrente.
 * Homônimos que concordam seguem úteis — a resposta é a mesma de qualquer
 * jeito.
 */
export function indexarAnunciantes(clientes: ClienteClassificado[]): IndiceDeAnunciantes {
  const indice: IndiceDeAnunciantes = new Map()

  for (const cliente of clientes) {
    const chave = reduzirNomeDeAnunciante(cliente.nome)
    if (chave === '') continue

    if (!indice.has(chave)) {
      indice.set(chave, cliente)
      continue
    }

    const existente = indice.get(chave)
    if (existente === null) continue
    if (existente!.setor !== cliente.setor || existente!.industria !== cliente.industria) {
      indice.set(chave, null)
    }
  }

  return indice
}

/** O cliente da carteira correspondente, ou `null` — ausente, sem marca, ou ambíguo. */
export function classificarAnunciante(
  nome: string | null | undefined,
  indice: IndiceDeAnunciantes,
): ClienteClassificado | null {
  const chave = reduzirNomeDeAnunciante(nome)
  if (chave === '') return null
  return indice.get(chave) ?? null
}
