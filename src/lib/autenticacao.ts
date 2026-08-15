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
const ERRO_MUITAS_TENTATIVAS =
  'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
const ERRO_DADOS_INCOMPLETOS = 'Preencha um e-mail válido e a senha.'
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

  // Bloqueio por excesso de tentativas. Precisa vir ANTES do tratamento de
  // credencial: dizer "e-mail ou senha incorretos" a quem foi barrado por
  // tentar demais manda a pessoa conferir uma senha que provavelmente está
  // certa. O limite é por origem da requisição, não por conta, então esta
  // mensagem não revela se o e-mail existe.
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return { erro: ERRO_MUITAS_TENTATIVAS }
  }

  // E-mail malformado ou campo em branco — problema no que foi digitado,
  // não na conta. Também não revela nada sobre quem tem cadastro.
  if (error.code === 'validation_failed' || error.code === 'email_address_invalid') {
    return { erro: ERRO_DADOS_INCOMPLETOS }
  }

  // "invalid_credentials" cobre tanto e-mail inexistente quanto senha errada
  // — o Supabase não distingue os dois de propósito, para não revelar quais
  // e-mails têm conta. Os demais 400 caem aqui pelo mesmo motivo: casos como
  // conta não confirmada ou banida SÃO distinguíveis, mas responder isso
  // confirmaria que o e-mail tem cadastro e permitiria enumerar contas.
  if (error.code === 'invalid_credentials' || error.status === 400) {
    return { erro: ERRO_CREDENCIAL_INVALIDA }
  }

  return { erro: ERRO_INESPERADO }
}

export async function sair(): Promise<void> {
  const supabase = criarClienteNavegador()
  await supabase.auth.signOut()
}
