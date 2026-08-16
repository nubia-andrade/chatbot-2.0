import { listarDatasBloqueadas } from '@/lib/dados/datas-bloqueadas'
import { CalendarioDeBloqueios } from '@/components/programas/CalendarioDeBloqueios'

/**
 * Aba Datas bloqueadas — Task 10 monta a rota; Task 11 traz o calendário
 * mensal (`CalendarioDeBloqueios`) que lista, bloqueia e desbloqueia datas,
 * sempre com motivo.
 *
 * A guarda de acesso já é do layout (`[id]/layout.tsx`) — chegar aqui já
 * significa que a pessoa pode ver e editar este programa.
 */
export default async function PaginaDeDatasBloqueadas({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const datas = await listarDatasBloqueadas(id)

  return <CalendarioDeBloqueios programaId={id} bloqueiosIniciais={datas} />
}
