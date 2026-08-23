'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { excluirOportunidade } from '@/lib/acoes/excluir-oportunidade'

type OportunidadeExcluivel = {
  id: string
  programaId: string
  titulo: string
}

type Props = {
  oportunidades: OportunidadeExcluivel[]
  programasPermitidos: string[]
}

export function ExcluirOportunidadeFlutuante({ oportunidades, programasPermitidos }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventoId = searchParams.get('evento')
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const oportunidade = useMemo(
    () => oportunidades.find((item) => item.id === eventoId) ?? null,
    [eventoId, oportunidades],
  )

  const podeExcluir = Boolean(oportunidade && programasPermitidos.includes(oportunidade.programaId))
  if (!podeExcluir || !oportunidade) return null

  async function confirmarExclusao() {
    if (excluindo) return
    const oportunidadeAtual = oportunidade
    if (!oportunidadeAtual) return
    const confirmado = window.confirm(
      `Excluir a oportunidade “${oportunidadeAtual.titulo}”?\n\nEla será removida de Oportunidades e do Calendário. Esta ação não pode ser desfeita.`,
    )
    if (!confirmado) return

    setErro(null)
    setExcluindo(true)
    const resultado = await excluirOportunidade(oportunidadeAtual.id)
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível excluir a oportunidade.')
      setExcluindo(false)
      return
    }

    router.push('/oportunidades')
    router.refresh()
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex max-w-[340px] flex-col items-end gap-2">
      {erro && <div className="rounded-[12px] border border-[#fecdd3] bg-white px-4 py-3 text-[12px] font-semibold text-[#be123c] shadow-lg">{erro}</div>}
      <button
        type="button"
        onClick={confirmarExclusao}
        disabled={excluindo}
        className="vitrine-pop rounded-full border border-[#fecaca] bg-white px-4 py-2.5 text-[12px] font-bold text-[#b91c1c] shadow-[0_8px_22px_-14px_rgba(20,22,26,.45)] hover:border-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {excluindo ? 'Excluindo…' : 'Excluir oportunidade'}
      </button>
    </div>
  )
}
