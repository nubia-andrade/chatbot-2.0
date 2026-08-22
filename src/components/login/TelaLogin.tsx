'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { entrar } from '@/lib/autenticacao'
import { PainelApresentacao } from './PainelApresentacao'
import { FormularioEntrada } from './FormularioEntrada'

export function TelaLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function aoEntrar() {
    if (entrando) return
    setEntrando(true)
    setErro(null)

    const resultado = await entrar(email, senha)
    if (resultado.erro) {
      setErro(resultado.erro)
      setEntrando(false)
      return
    }

    router.replace('/oportunidades')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eceef1] p-4 sm:p-8">
      <div className="grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[22px] bg-white shadow-[0_26px_70px_-32px_rgba(20,22,26,.45)] lg:grid-cols-[52%_48%]">
        <PainelApresentacao />
        <FormularioEntrada
          email={email}
          senha={senha}
          erro={erro}
          entrando={entrando}
          aoMudarEmail={(valor) => { setEmail(valor); setErro(null) }}
          aoMudarSenha={(valor) => { setSenha(valor); setErro(null) }}
          aoEntrar={aoEntrar}
        />
      </div>
    </main>
  )
}
