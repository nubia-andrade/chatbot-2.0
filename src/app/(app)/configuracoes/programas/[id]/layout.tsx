import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarProgramas, podeEditarPrograma } from '@/lib/dominio/perfis'
import { obterPrograma } from '@/lib/dados/programas'
import { contarDatasBloqueadas } from '@/lib/dados/datas-bloqueadas'
import { contarRestricoes } from '@/lib/dados/restricoes'
import { contarAcoesRegionais } from '@/lib/dados/acoes-regionais'
import { CabecalhoDoPrograma } from '@/components/programas/CabecalhoDoPrograma'
import { AbasDoPrograma } from '@/components/programas/AbasDoPrograma'

/**
 * Área do programa — Task 10.
 *
 * Carrega o programa uma única vez (via `obterPrograma`, envolvida em
 * `cache()` para não repetir a consulta quando `page.tsx` também precisar
 * dele) e decide se a pessoa entra. A guarda é `podeEditarPrograma` (Task 2):
 * proprietário edita tudo, consultor só os programas a que está vinculado.
 * Nega com `notFound()`, não com "sem permissão" — um consultor que abra
 * pela URL o programa de outro não deve nem saber que ele existe.
 *
 * `/configuracoes/programas/novo` cai nesta mesma rota `[id]` (`novo` não é
 * um id de verdade). Antes de o programa existir não há o que mostrar nas
 * abas — datas bloqueadas, restrições e regional dependem de um
 * `programa_id` real, como o editor de apelidos já dependia (Task 11
 * original). Para "novo" a checagem é a permissão ampla de administrar
 * programas, a mesma que protege o INSERT no banco (policy "insercao
 * administrador"), e a área de abas nem aparece — só o formulário.
 */
export default async function LayoutDoPrograma({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await obterSessao()

  if (id === 'novo') {
    if (!sessao || !podeAdministrarProgramas(sessao.perfis)) {
      notFound()
    }
    return <div className="flex flex-col gap-6">{children}</div>
  }

  const programa = await obterPrograma(id)
  if (!programa) notFound()

  if (!sessao || !podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programa.id)) {
    notFound()
  }

  const [contagemDatas, contagemRestricoes, contagemRegional] = await Promise.all([
    contarDatasBloqueadas(programa.id),
    contarRestricoes(programa.id),
    programa.aceita_regional ? contarAcoesRegionais(programa.id) : Promise.resolve(0),
  ])

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDoPrograma programa={programa} />
      <AbasDoPrograma
        programaId={programa.id}
        aceitaRegional={programa.aceita_regional}
        contagemDatas={contagemDatas}
        contagemRestricoes={contagemRestricoes}
        contagemRegional={contagemRegional}
      />
      {children}
    </div>
  )
}
