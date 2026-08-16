import { normalizarNome } from './texto'

/**
 * Elegibilidade de clientes para ações regionais — a marcação é do CLIENTE,
 * global: um cliente elegível pode comprar regional em QUALQUER programa que
 * aceite regional, não é configuração por programa
 * (`clientes.apto_regional`, `supabase/schema-clientes-regional.sql`).
 */

export type ClienteComElegibilidade = {
  apto_regional: boolean
}

/** A mesma pergunta em todo lugar que decide se um cliente pode entrar num wizard regional. */
export function podeComprarRegional(cliente: ClienteComElegibilidade): boolean {
  return cliente.apto_regional === true
}

/**
 * Normaliza um CNPJ para só dígitos, para comparar "12.345.678/0001-95" com
 * "12345678000195" como o mesmo cliente.
 *
 * Usada na importação em massa (Configurações → Clientes regionais): a
 * pessoa cola uma lista de CNPJs formatados de qualquer jeito — com ou sem
 * pontuação — e o casamento com a carteira precisa ignorar a formatação.
 */
export function normalizarCnpj(valor: string | null | undefined): string {
  if (!valor) return ''
  return valor.replace(/\D/g, '')
}

/**
 * Quebra o texto colado na caixa de importação em massa em uma lista de
 * CNPJs, um por linha. Ignora linhas em branco; não normaliza — quem compara
 * usa `normalizarCnpj` no valor original preservado (para mostrar de volta
 * ao usuário exatamente o que ele digitou, no relatório de "não encontrados").
 */
export function separarCnpjsColados(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '')
}

/**
 * O CNPJ só identifica um cliente quando tem os 14 dígitos de um CNPJ de
 * verdade E não é todo zero. Achado real na carteira ao recarregar o banco:
 * `00000000000000` é usado como CNPJ de sete clientes internacionais
 * DIFERENTES, sem CNPJ brasileiro — entre eles Amazon Music e Casa de
 * Apostas — porque a planilha precisa preencher a coluna com algo. Casar
 * clientes por esse "CNPJ" juntaria os sete num só, e como a elegibilidade
 * regional é um deles isolado (Casa de Apostas) e não os outros seis, o
 * cliente errado ganharia — ou perderia — acesso a ações regionais.
 *
 * Devolve os dígitos quando o CNPJ é útil, ou string vazia quando não é
 * (ausente, incompleto, ou todo zero) — string vazia nunca casa com CNPJ
 * vazio de outro cliente em `chaveDeCasamento`, porque a chave sempre inclui
 * o nome também.
 */
export function cnpjUtil(cnpj: string | null | undefined): string {
  const digitos = normalizarCnpj(cnpj)
  if (digitos.length !== 14) return ''
  if (/^0+$/.test(digitos)) return ''
  return digitos
}

export type ClienteParaCasamento = {
  cnpj: string | null | undefined
  nome: string
}

/**
 * Chave para casar uma linha da carteira (planilha) com um cliente já
 * gravado no banco, ao recarregar `clientes` sem apagar e reinserir —
 * apagar e reinserir trocaria os `id`s e quebraria toda referência
 * existente (`acoes_regionais.cliente_id`).
 *
 * CNPJ útil (`cnpjUtil`) + nome normalizado (`normalizarNome`, que ignora
 * acento e caixa). Sem CNPJ útil, a chave cai para só o nome — é o que
 * mantém os sete clientes internacionais de CNPJ `00000000000000`
 * separados entre si, porque cada um tem um nome diferente.
 *
 * Medido contra a carteira real (15.519 linhas, `dados/Carteira.xlsx`):
 * casar só por CNPJ colide 620 linhas; CNPJ útil + nome colide só 77 (e
 * nenhum desses grupos tem elegibilidade divergente) — a chave certa para
 * este casamento.
 */
export function chaveDeCasamento(cliente: ClienteParaCasamento): string {
  return `${cnpjUtil(cliente.cnpj)}|${normalizarNome(cliente.nome)}`
}

/**
 * Remove duplicatas de um lote antes de gravar, mantendo a primeira
 * ocorrência de cada `id` — necessário porque duas linhas da carteira podem
 * casar com o MESMO cliente existente (mesma `chaveDeCasamento`, ex.: a
 * carteira real repete 38 chaves de CNPJ útil + nome). Um upsert com o
 * mesmo `id` duas vezes no mesmo lote é rejeitado pelo Postgres ("ON
 * CONFLICT DO UPDATE command cannot affect row a second time"); itens sem
 * `id` (cliente novo, ainda sem casamento) nunca são tratados como
 * duplicata entre si, porque cada um vai gerar seu próprio `id` no insert.
 */
export function deduplicarPorId<T extends { id?: string }>(
  itens: T[],
): { itens: T[]; duplicadas: number } {
  const vistos = new Set<string>()
  const resultado: T[] = []
  let duplicadas = 0

  for (const item of itens) {
    if (!item.id) {
      resultado.push(item)
      continue
    }
    if (vistos.has(item.id)) {
      duplicadas++
      continue
    }
    vistos.add(item.id)
    resultado.push(item)
  }

  return { itens: resultado, duplicadas }
}
