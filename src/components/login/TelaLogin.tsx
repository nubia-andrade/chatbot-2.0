'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { entrar } from '@/lib/autenticacao'
import { PainelApresentacao } from './PainelApresentacao'
import { FormularioEntrada } from './FormularioEntrada'

/**
 * A tela 1a do handoff: painel de marca à esquerda (52%), formulário de
 * entrada à direita (48%).
 */
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

    // A rota /inicio nasce na Task 9. Quem decide a seção de destino é o
    // servidor, olhando o perfil em `perfil_usuario` — por isso o redireciono
    // é seguido de um refresh, para o servidor remontar a árvore já sabendo
    // da sessão nova.
    router.replace('/inicio')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 sm:p-8">
      <div className="grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[16px] bg-[var(--superficie)] shadow-[var(--sombra-janela)] lg:grid-cols-[52%_48%]">
        <PainelApresentacao />
        <FormularioEntrada
          email={email}
          senha={senha}
          erro={erro}
          entrando={entrando}
          aoMudarEmail={(valor) => {
            setEmail(valor)
            setErro(null)
          }}
          aoMudarSenha={(valor) => {
            setSenha(valor)
            setErro(null)
          }}
          aoEntrar={aoEntrar}
        />
      </div>
    </main>
  )
}
