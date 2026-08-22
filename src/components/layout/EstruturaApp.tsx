'use client'

import { usePathname } from 'next/navigation'
import { BarraLateral } from '@/components/layout/BarraLateral'
import type { Perfil, SecaoApp } from '@/lib/dominio/perfis'

type Props = {
  children: React.ReactNode
  nome: string
  perfis: Perfil[]
  secoes: SecaoApp[]
}

/**
 * Mantém o shell administrativo do Chatbot 2.0 nas rotas usuais e entrega
 * uma tela inteira à Vitrine, que possui navegação própria no handoff hi-fi.
 */
export function EstruturaApp({ children, nome, perfis, secoes }: Props) {
  const caminho = usePathname()
  const vitrine = caminho === '/vitrine' || caminho.startsWith('/vitrine/')

  return (
    <div className={`flex min-h-screen ${vitrine ? 'bg-[#eceef1]' : 'bg-[var(--canvas)]'}`}>
      {!vitrine && <BarraLateral nome={nome} perfis={perfis} secoes={secoes} />}
      <main className={vitrine ? 'min-w-0 flex-1 overflow-auto' : 'min-w-0 flex-1 overflow-auto px-4 pb-24 pt-20 sm:px-6 md:p-10'}>
        {children}
      </main>
    </div>
  )
}
