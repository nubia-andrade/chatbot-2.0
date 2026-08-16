import { listarRestricoes, listarValoresDeCategoria } from '@/lib/dados/restricoes'
import { PainelDeRestricoes } from '@/components/programas/PainelDeRestricoes'

/**
 * Aba Restrições — Task 10 monta a rota; Task 11 traz o cadastro (por
 * anunciante, por setor+indústria ou só por categoria, com busca na
 * carteira via `CampoDeBuscaDeCliente`) em `PainelDeRestricoes`.
 *
 * A guarda de acesso já é do layout (`[id]/layout.tsx`).
 */
export default async function PaginaDeRestricoes({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [restricoes, valores] = await Promise.all([
    listarRestricoes(id),
    listarValoresDeCategoria(),
  ])

  return (
    <PainelDeRestricoes
      programaId={id}
      restricoesIniciais={restricoes}
      setores={valores.setores}
      industrias={valores.industrias}
    />
  )
}
