import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Roda antes de cada página (no Next 16 isto se chama proxy; até a versão 15
 * era o middleware). Renova o token de sessão do Supabase e regrava os
 * cookies — sem isto, a sessão expira e o usuário é deslogado do nada ao
 * navegar entre páginas.
 *
 * Não faz autorização aqui: a checagem de perfil fica nas páginas/layouts,
 * e a proteção de verdade é o RLS no banco.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Sem as variáveis configuradas não há sessão para renovar. Deixa passar:
  // quem mostra o erro explicativo é `lerVariaveis`, quando a página tentar
  // usar o Supabase.
  if (url && chave) {
    const supabase = createServerClient(url, chave, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesParaGravar) {
          for (const { name, value } of cookiesParaGravar) {
            request.cookies.set(name, value)
          }
          resposta = NextResponse.next({ request })
          for (const { name, value, options } of cookiesParaGravar) {
            resposta.cookies.set(name, value, options)
          }
        },
      },
    })

    // Esta chamada é o que renova o token — precisa acontecer aqui.
    await supabase.auth.getUser()
  }

  return resposta
}

export const config = {
  // Pula arquivos estáticos e imagens: eles não têm sessão para renovar.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
