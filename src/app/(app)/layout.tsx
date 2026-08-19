import { redirect } from 'next/navigation'
import { obterSessao } from '@/lib/sessao-servidor'
import { BarraLateral } from '@/components/layout/BarraLateral'

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
    <div className="flex min-h-screen bg-[var(--canvas)]">
      <BarraLateral
        nome={sessao.nome}
        perfis={sessao.perfis}
        secoes={sessao.secoes}
      />
      <main className="min-w-0 flex-1 overflow-auto px-4 pb-24 pt-20 sm:px-6 md:p-10">{children}</main>
    </div>
  )
}
