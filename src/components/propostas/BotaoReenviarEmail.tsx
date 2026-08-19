'use client'

import { useState, useTransition } from 'react'
import { reenviarPropostaPorEmail } from '@/lib/acoes/reenviar-proposta'

export function BotaoReenviarEmail({ propostaId }: { propostaId: string }) {
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [pendente, iniciarTransicao] = useTransition()

  function reenviar() {
    setErro(null)
    setSucesso(false)
    iniciarTransicao(async () => {
      const retorno = await reenviarPropostaPorEmail(propostaId)
      if (retorno.erro) {
        setErro(retorno.erro)
        return
      }
      setSucesso(true)
      window.setTimeout(() => window.location.reload(), 700)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={reenviar}
        disabled={pendente}
        className="rounded-[9px] border border-[var(--borda-forte)] bg-white px-3.5 py-2 text-[11.5px] font-bold text-[var(--texto-2)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendente ? 'Reenviando…' : 'Reenviar e-mail'}
      </button>
      {erro && <p className="max-w-[220px] text-right text-[10px] leading-[1.4] text-[var(--concorrencia-texto)]">{erro}</p>}
      {sucesso && <p className="text-[10px] font-semibold text-[var(--disponivel-texto)]">E-mail reenviado.</p>}
    </div>
  )
}
