/**
 * Validação da senha nova, no fluxo de redefinição de senha.
 *
 * Função pura, sem banco nem tela — a mesma regra roda na tela (feedback
 * imediato, por conveniência) e no servidor (a que vale de verdade, antes de
 * gravar), então precisa viver num lugar só. Ver `src/app/redefinir-senha`.
 */

export const TAMANHO_MINIMO = 8

export const MOTIVOS_SENHA = {
  vazia: 'Digite a senha nova.',
  curta: `A senha precisa ter ao menos ${TAMANHO_MINIMO} caracteres.`,
  naoConfere: 'As duas senhas digitadas não são iguais.',
} as const

/**
 * O que impede gravar a senha nova, ou `null` quando ela pode ser gravada.
 *
 * Ordem importa: uma senha vazia já é curta demais, mas a mensagem "digite a
 * senha" é mais direta do que "mínimo de 8 caracteres" para quem só não
 * preencheu o campo ainda.
 */
export function problemaDaSenha(nova: string, repetida: string): string | null {
  if (nova.length === 0) return MOTIVOS_SENHA.vazia
  if (nova.length < TAMANHO_MINIMO) return MOTIVOS_SENHA.curta
  if (nova !== repetida) return MOTIVOS_SENHA.naoConfere
  return null
}
