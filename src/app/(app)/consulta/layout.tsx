'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  PASSOS,
  ProvedorDaConsulta,
  useConsulta,
} from '@/components/consulta/ProvedorDaConsulta'
import { Stepper } from '@/components/consulta/Stepper'

/**
 * Shell do wizard de consulta — Task 9.
 *
 * Client Component porque o cabeçalho ("Etapa N de 7") e o stepper
 * precisam saber em qual passo a pessoa está agora, e um layout de
 * servidor não vê o caminho atual em navegações subsequentes
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`,
 * seção "Pathname" — a solução recomendada é ler `usePathname` num Client
 * Component, o mesmo padrão de `AbasDoPrograma.tsx`).
 *
 * Envolve todo o grupo de rotas com `<ProvedorDaConsulta>` para que as seis
 * páginas de passo (Tasks 10 a 14) e este próprio cabeçalho compartilhem o
 * mesmo estado, espelhado no `sessionStorage` da aba.
 */
export default function LayoutConsulta({ children }: { children: ReactNode }) {
  return (
    <ProvedorDaConsulta>
      <CabecalhoEConteudo>{children}</CabecalhoEConteudo>
    </ProvedorDaConsulta>
  )
}

function CabecalhoEConteudo({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { estado } = useConsulta()

  const passoAtual = pathname.split('/').filter(Boolean).pop() ?? 'cliente'
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
            Etapa {etapa} de 7
          </p>
        </div>

        <Stepper passoAtual={passoAtual} estado={estado} />
      </header>

      {children}
    </div>
  )
}
