import { listarRestricoes, listarValoresDeRestricao } from '@/lib/dados/restricoes'
import { PainelDeRestricoes } from '@/components/programas/PainelDeRestricoes'

/**
 * Aba Restrições: cadastro por anunciante específico, por setor + indústria
 * ou pela Segmentação SE própria da Carteira.
 */
export default async function PaginaDeRestricoes({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [restricoes, valores] = await Promise.all([
    listarRestricoes(id),
    listarValoresDeRestricao(),
  ])

  return (
    <PainelDeRestricoes
      programaId={id}
      restricoesIniciais={restricoes}
      setores={valores.setores}
      industrias={valores.industrias}
      segmentacoesSe={valores.segmentacoesSe}
    />
  )
}
