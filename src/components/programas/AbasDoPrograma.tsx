'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Aba = {
  rotulo: string
  href: string
  contagem?: number
}

type Props = {
  programaId: string
  aceitaRegional: boolean
  contagemDatas: number
  contagemDatasEspeciais: number
  contagemRestricoes: number
  contagemRegional: number
}

export function AbasDoPrograma({
  programaId,
  aceitaRegional,
  contagemDatas,
  contagemDatasEspeciais,
  contagemRestricoes,
  contagemRegional,
}: Props) {
  const pathname = usePathname()
  const base = `/configuracoes/programas/${programaId}`
  const abas: Aba[] = [{ rotulo: 'Cadastro', href: base }]

  if (aceitaRegional) {
    abas.push({ rotulo: 'Regional', href: `${base}/regional`, contagem: contagemRegional })
  }

  abas.push(
    { rotulo: 'Datas bloqueadas', href: `${base}/datas`, contagem: contagemDatas },
    { rotulo: 'Datas especiais', href: `${base}/datas-especiais`, contagem: contagemDatasEspeciais },
    { rotulo: 'Restrições', href: `${base}/restricoes`, contagem: contagemRestricoes },
    { rotulo: 'Modelo de propostas', href: `${base}/modelo` },
    { rotulo: 'E-mail', href: `${base}/email` },
  )

  return (
    <nav aria-label="Abas do programa" className="flex flex-wrap gap-1 border-b border-[var(--borda)]">
      {abas.map((aba) => {
        const ativa = pathname === aba.href
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className="flex items-center gap-1.5 px-4 py-3 text-[13.5px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
            style={{
              color: ativa ? 'var(--roxo)' : 'var(--texto-3)',
              borderBottom: ativa ? '2px solid var(--roxo)' : '2px solid transparent',
            }}
          >
            {aba.rotulo}
            {typeof aba.contagem === 'number' && aba.contagem > 0 && (
              <span className="text-[12px] font-semibold" style={{ color: 'inherit', opacity: 0.75 }}>
                · {aba.contagem}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
