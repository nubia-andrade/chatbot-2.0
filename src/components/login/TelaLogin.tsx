'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { entrar } from '@/lib/autenticacao'
import { MarcaGloboSlots } from '@/components/layout/MarcaGloboSlots'
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
    <main className="min-h-screen bg-white text-[#14161a]">
      <header className="border-b border-[#eceef1] bg-white">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <MarcaGloboSlots href="/login" />
          <span className="hidden text-[12px] font-medium text-[#737983] sm:block">Plataforma comercial Globo</span>
        </div>
      </header>

      <section className="bg-[#f6f7f8] px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mx-auto grid w-full max-w-[1240px] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] lg:items-stretch">
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
      </section>

      <footer className="bg-white px-5 py-5 text-center text-[10.5px] text-[#9298a1]">
        Globo Slots · Oportunidades, disponibilidade e propostas comerciais
      </footer>
    </main>
  )
}
