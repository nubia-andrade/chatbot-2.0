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
