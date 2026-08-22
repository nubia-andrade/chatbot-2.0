import { redirect } from 'next/navigation'
import { obterSessao } from '@/lib/sessao-servidor'
import { EstruturaApp } from '@/components/layout/EstruturaApp'

/**
 * Toda rota deste grupo depende da sessão de quem está logado — não faz
 * sentido pré-gerar nada em tempo de build. Sem isso, o `next build` tenta
 * renderizar estas páginas de forma estática e quebra: não há requisição
 * (nem cookies de sessão) fora do momento em que alguém de fato pede a
 * página.
 */
export const dynamic = 'force-dynamic'

/** Shell de todas as rotas autenticadas. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao()

  if (!sessao) {
    redirect('/login')
  }

  return (
    <EstruturaApp nome={sessao.nome} perfis={sessao.perfis} secoes={sessao.secoes}>
      {children}
    </EstruturaApp>
  )
}
