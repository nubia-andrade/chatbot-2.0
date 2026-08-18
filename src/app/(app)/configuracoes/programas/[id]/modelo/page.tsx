import { EditorDeModeloDeProposta } from '@/components/programas/EditorDeModeloDeProposta'
import { listarSlidesDoModelo } from '@/lib/dados/modelo-proposta'

export default async function PaginaDeModeloDeProposta({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const slides = await listarSlidesDoModelo(id)

  return <EditorDeModeloDeProposta programaId={id} slides={slides} />
}
