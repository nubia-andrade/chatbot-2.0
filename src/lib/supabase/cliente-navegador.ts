'use client'

/**
 * Cliente do Supabase para usar DENTRO do navegador (componentes 'use client').
 *
 * Guarda a sessão num cookie, e não na memória da aba — é isso que permite o
 * servidor saber quem está logado antes de mandar a página.
 */

import { createBrowserClient } from '@supabase/ssr'
import { lerVariaveis } from './variaveis'

export function criarClienteNavegador() {
  const { url, chave } = lerVariaveis()
  return createBrowserClient(url, chave)
}
