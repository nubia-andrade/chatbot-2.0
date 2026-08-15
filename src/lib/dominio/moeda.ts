/**
 * Campos de dinheiro no formato brasileiro: ponto como separador de milhar,
 * vírgula como separador decimal — o oposto da convenção JavaScript/SQL.
 *
 * O bug que motivou este módulo: o formulário de programa usava `Number()`
 * direto no texto digitado. Quem digitou "8.300,00" (oito mil e trezentos
 * reais) recebeu 8.3 gravado no banco — o ponto foi lido como separador
 * decimal e a vírgula quebrou o parse antes mesmo disso. Errar a ordem de
 * grandeza por mil num custo que alimenta o valor da proposta é grave, daí a
 * função pura e testada em vez de uma conversão solta no componente.
 *
 * `paraNumero` é TOLERANTE de propósito: aceita o que a pessoa digitou em
 * qualquer um dos formatos comuns, sem exigir máscara. `formatarMoeda` é a
 * volta — sempre no padrão brasileiro, sempre com duas casas.
 */

/**
 * Texto digitado pela pessoa → número em reais, ou `null` quando o campo
 * está vazio ou o texto não é reconhecível como dinheiro.
 *
 * Formatos aceitos: "8300", "8.300", "8300,00", "8.300,00", "R$ 8.300,00".
 */
export function paraNumero(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null

  const limpo = texto
    .trim()
    .replace(/^R\$\s*/i, '')
    .trim()

  if (limpo === '') return null
  if (!/^-?[\d.,]+$/.test(limpo)) return null

  const temPonto = limpo.includes('.')
  const temVirgula = limpo.includes(',')

  let normalizado: string

  if (temPonto && temVirgula) {
    // Ambos presentes: o separador mais à direita é o decimal; o outro é milhar.
    const ultimoPonto = limpo.lastIndexOf('.')
    const ultimaVirgula = limpo.lastIndexOf(',')
    if (ultimaVirgula > ultimoPonto) {
      // "8.300,00" — ponto é milhar, vírgula é decimal.
      normalizado = limpo.replace(/\./g, '').replace(',', '.')
    } else {
      // "8,300.00" (formato americano, tolerado) — vírgula é milhar, ponto é decimal.
      normalizado = limpo.replace(/,/g, '')
    }
  } else if (temVirgula) {
    // Só vírgula: é o separador decimal brasileiro. Vírgulas extras (raras)
    // seriam milhar; só a última importa como decimal.
    const partes = limpo.split(',')
    const decimais = partes.pop()
    normalizado = `${partes.join('')}.${decimais}`
  } else if (temPonto) {
    // Só ponto: ambíguo entre milhar ("8.300" = 8300) e decimal ("8.30" = 8,30).
    // A convenção brasileira de milhar sempre agrupa em blocos de 3 dígitos —
    // por isso um bloco final de exatamente 3 dígitos é tratado como milhar.
    const partes = limpo.split('.')
    const ultimoBloco = partes[partes.length - 1]
    if (partes.length > 1 && ultimoBloco.length === 3) {
      normalizado = partes.join('')
    } else {
      normalizado = limpo
    }
  } else {
    normalizado = limpo
  }

  const valor = Number(normalizado)
  return Number.isNaN(valor) ? null : valor
}

/**
 * Número → texto no padrão brasileiro, sempre com duas casas decimais.
 * `null`/`undefined` viram texto vazio — "não informado", não "R$ 0,00".
 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
