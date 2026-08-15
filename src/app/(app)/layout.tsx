import { redirect } from 'next/navigation'
import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { BarraLateral } from '@/components/layout/BarraLateral'

/**
 * Toda rota deste grupo depende da sessão de quem está logado — não faz
 * sentido pré-gerar nada em tempo de build. Sem isso, o `next build` tenta
 * renderizar estas páginas de forma estática e quebra: não há requisição
 * (nem cookies de sessão) fora do momento em que alguém de fato pede a
 * página.
 */
export const dynamic = 'force-dynamic'

/**
 * Shell de todas as rotas autenticadas (grupo `(app)`).
 *
 * Guarda de rota: roda no servidor, antes de qualquer página do grupo ser
 * montada. Sem sessão válida — `obterSessao()` devolve null —, manda para
 * `/login` e não chega a renderizar nada daqui pra baixo.
 *
 * `redirect()` do Next.js lança (tipo de retorno `never`), então depois do
 * `if` o TypeScript já sabe que `sessao` não é nula.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao()

  if (!sessao) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-[var(--canvas)]">
      <BarraLateral
        nome={sessao.nome}
        perfil={sessao.perfil}
        podeAdministrar={podeAdministrar(sessao)}
      />
      <main className="flex-1 overflow-auto p-10">{children}</main>
    </div>
  )
}
