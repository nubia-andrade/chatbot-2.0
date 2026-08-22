import { redirect } from 'next/navigation'
import { obterSessao } from '@/lib/sessao-servidor'
import { ShellGloboSlots } from '@/components/layout/ShellGloboSlots'

/** Toda rota deste grupo depende da sessão de quem está logado. */
export const dynamic = 'force-dynamic'

/** Shell autenticado do Globo Slots. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao()

  if (!sessao) redirect('/login')

  return (
    <ShellGloboSlots nome={sessao.nome} perfis={sessao.perfis} secoes={sessao.secoes}>
      {children}
    </ShellGloboSlots>
  )
}
