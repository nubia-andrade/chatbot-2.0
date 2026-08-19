'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  PASSOS,
  ProvedorDaConsulta,
  useConsulta,
} from '@/components/consulta/ProvedorDaConsulta'
import { Stepper } from '@/components/consulta/Stepper'

export function LayoutConsultaCliente({ children }: { children: ReactNode }) {
  return (
    <ProvedorDaConsulta>
      <CabecalhoEConteudo>{children}</CabecalhoEConteudo>
    </ProvedorDaConsulta>
  )
}

function CabecalhoEConteudo({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { estado } = useConsulta()

  const passoAtual = pathname === '/consulta'
    ? 'contexto'
    : pathname.endsWith('/resumo')
      ? 'resumo'
      : 'calendario'
  const indexAtual = PASSOS.findIndex((passo) => passo.slug === passoAtual)
  const etapa = indexAtual >= 0 ? indexAtual + 1 : 1

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1
            className="text-[22px] font-extrabold text-[var(--texto)]"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            Nova consulta
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-[var(--texto-3)]">
            Etapa {etapa} de {PASSOS.length}
          </p>
        </div>

        <Stepper passoAtual={passoAtual} estado={estado} />
      </header>

      {children}
    </div>
  )
}
