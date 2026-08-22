'use client'

import { usePathname } from 'next/navigation'
import type { Perfil, SecaoApp } from '@/lib/dominio/perfis'
import { TopoGlobal } from './TopoGlobal'

type Props = {
  nome: string
  perfis: Perfil[]
  secoes: SecaoApp[]
  children: React.ReactNode
}

export function ShellGloboSlots({ nome, perfis, secoes, children }: Props) {
  const pathname = usePathname()
  const telaImersiva = pathname === '/oportunidades'
    || pathname.startsWith('/oportunidades/')
    || pathname === '/calendario'
    || pathname === '/vitrine'

  return (
    <div className="min-h-screen bg-[#eceef1] text-[#14161a]">
      <TopoGlobal nome={nome} perfis={perfis} secoes={secoes} />
      <main className={telaImersiva ? 'min-w-0' : 'mx-auto min-w-0 max-w-[1440px] px-5 pb-16 pt-8 sm:px-7 lg:px-9'}>
        {children}
      </main>
    </div>
  )
}
