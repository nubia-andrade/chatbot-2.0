'use client'

/**
 * Entrar e sair, do lado do navegador.
 *
 * A autorização (quem pode ver o quê, dado o `perfil` de `perfil_usuario`) é
 * responsabilidade de `sessao-servidor.ts` e das políticas de RLS no banco —
 * aqui só se prova que a senha confere (Supabase Auth, `auth.users`).
 */

import { criarClienteNavegador } from './supabase/cliente-navegador'

/** Mensagem única para credencial inválida, sem revelar qual campo errou. */
const ERRO_CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.'
const ERRO_INESPERADO = 'Não foi possível entrar. Tente novamente em instantes.'

export async function entrar(
  email: string,
  senha: string,
): Promise<{ erro: string | null }> {
  const supabase = criarClienteNavegador()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  })

  if (!error) return { erro: null }

  // "invalid_credentials" cobre tanto e-mail inexistente quanto senha errada
  // — o Supabase não distingue os dois de propósito, para não revelar quais
  // e-mails têm conta.
  if (error.code === 'invalid_credentials' || error.status === 400) {
    return { erro: ERRO_CREDENCIAL_INVALIDA }
  }

  return { erro: ERRO_INESPERADO }
}

export async function sair(): Promise<void> {
  const supabase = criarClienteNavegador()
  await supabase.auth.signOut()
}
