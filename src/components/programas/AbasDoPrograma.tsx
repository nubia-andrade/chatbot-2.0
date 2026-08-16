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

/**
 * As abas da área do programa — Task 10.
 *
 * Componente cliente porque a aba ativa depende do caminho atual
 * (`usePathname`), que só um Client Component enxerga atualizado a cada
 * navegação — o layout que envolve as abas não re-renderiza sozinho
 * (`node_modules/next/dist/docs/.../layout.md`, seção "Pathname").
 *
 * A aba Regional só aparece quando o programa aceita regional
 * (`programa.aceita_regional`); a aba Modelo de propostas aparece sempre,
 * mas desabilitada — a spec decidiu mostrar em vez de esconder, para que o
 * consultor saiba que a funcionalidade existe e chega na próxima entrega.
 *
 * Esconder uma aba é conveniência de interface, não proteção: quem digitar
 * a URL de uma aba sem o vínculo certo esbarra na guarda do layout
 * (`notFound()`), não nesta lista.
 */
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

  // Ordem pedida pela área: Regional vem logo depois do Cadastro, porque é a
  // continuação natural da configuração do programa — quem acabou de definir
  // dias e slots segue para praças e preços. Datas bloqueadas, Datas
  // especiais e Restrições são ajustes posteriores, feitos ao longo do
  // tempo. Datas especiais vem logo depois de Datas bloqueadas por pedido
  // da área — são conceitos vizinhos (bloqueio impede a venda, data
  // especial muda o preço) e ficam lado a lado para não se confundirem.
  const abas: Aba[] = [{ rotulo: 'Cadastro', href: base }]

  if (aceitaRegional) {
    abas.push({ rotulo: 'Regional', href: `${base}/regional`, contagem: contagemRegional })
  }

  abas.push(
    { rotulo: 'Datas bloqueadas', href: `${base}/datas`, contagem: contagemDatas },
    {
      rotulo: 'Datas especiais',
      href: `${base}/datas-especiais`,
      contagem: contagemDatasEspeciais,
    },
    { rotulo: 'Restrições', href: `${base}/restricoes`, contagem: contagemRestricoes },
  )

  return (
    <nav
      aria-label="Abas do programa"
      className="flex flex-wrap gap-1 border-b border-[var(--borda)]"
    >
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

      <span
        aria-disabled="true"
        title="Disponível na próxima entrega"
        className="flex cursor-not-allowed items-center gap-2 px-4 py-3 text-[13.5px] font-bold text-[var(--placeholder)]"
      >
        Modelo de propostas
        <span
          className="rounded-full px-2 py-[2px] text-[10.5px] font-bold"
          style={{ background: 'var(--superficie-suave)', color: 'var(--texto-3)' }}
        >
          Disponível na próxima entrega
        </span>
      </span>
    </nav>
  )
}
