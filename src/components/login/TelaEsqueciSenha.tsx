'use client'

import { useState } from 'react'
import { enviarLinkDeRedefinicao } from '@/lib/autenticacao'
import { PainelApresentacao } from './PainelApresentacao'
import { FormularioEsqueciSenha } from './FormularioEsqueciSenha'

const ERRO_EMAIL_EM_BRANCO = 'Digite seu e-mail.'

/**
 * Tela pública "Esqueci minha senha". Mesmo split 52/48 do login.
 *
 * A rota é `/esqueci-senha` — fora do grupo `(app)`, então não passa pela
 * guarda de rota que exige sessão (ver `src/app/(app)/layout.tsx`).
 */
export function TelaEsqueciSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function aoEnviar() {
    if (enviando) return

    if (email.trim() === '') {
      setErro(ERRO_EMAIL_EM_BRANCO)
      return
    }

    setEnviando(true)
    setErro(null)

    // Sem retorno de erro por design: a resposta é sempre a mesma mensagem
    // neutra, para não revelar se o e-mail tem conta. Ver
    // `enviarLinkDeRedefinicao`.
    await enviarLinkDeRedefinicao(email)

    setEnviando(false)
    setEnviado(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 sm:p-8">
      <div className="grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[16px] bg-[var(--superficie)] shadow-[var(--sombra-janela)] lg:grid-cols-[52%_48%]">
        <PainelApresentacao />
        <FormularioEsqueciSenha
          email={email}
          enviando={enviando}
          erro={erro}
          enviado={enviado}
          aoMudarEmail={(valor) => {
            setEmail(valor)
            setErro(null)
          }}
          aoEnviar={aoEnviar}
        />
      </div>
    </main>
  )
}
