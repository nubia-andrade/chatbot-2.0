'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarClienteNavegador } from '@/lib/supabase/cliente-navegador'
import { problemaDaSenha } from '@/lib/dominio/senha'
import { redefinirSenha } from '@/lib/acoes/senha'
import { PainelApresentacao } from './PainelApresentacao'
import { FormularioRedefinirSenha } from './FormularioRedefinirSenha'

type Estado =
  | { tipo: 'verificando' }
  | { tipo: 'invalido'; motivo: string }
  | { tipo: 'pronto' }

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  otp_expired: 'Este link de redefinição expirou. Peça um novo link para trocar a senha.',
  access_denied: 'Este link de redefinição não é mais válido. Peça um novo link para trocar a senha.',
}

const MENSAGEM_PADRAO_INVALIDO = 'Este link de redefinição é inválido ou já foi usado. Peça um novo link para trocar a senha.'

function mensagemParaCodigo(codigo: string | undefined): string {
  return (codigo && MENSAGENS_POR_CODIGO[codigo]) || MENSAGEM_PADRAO_INVALIDO
}

function codigoDoErro(erro: unknown): string | undefined {
  if (typeof erro !== 'object' || erro === null) return undefined
  return (erro as { details?: { code?: string } }).details?.code
}

function erroNaUrl(): string | undefined {
  const busca = new URLSearchParams(window.location.search)
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return busca.get('error_code') ?? fragmento.get('error_code') ?? busca.get('error') ?? fragmento.get('error') ?? undefined
}

function temCodigoNaUrl(): boolean {
  return new URLSearchParams(window.location.search).has('code')
}

export function TelaRedefinirSenha() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ tipo: 'verificando' })
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaRepetida, setSenhaRepetida] = useState('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    let cancelado = false
    const supabase = criarClienteNavegador()
    const codigoDeErro = erroNaUrl()
    const tinhaCodigo = temCodigoNaUrl()

    supabase.auth.initialize().then(({ error }) => {
      if (cancelado) return
      if (codigoDeErro) {
        setEstado({ tipo: 'invalido', motivo: mensagemParaCodigo(codigoDeErro) })
        return
      }
      if (!tinhaCodigo) {
        setEstado({ tipo: 'invalido', motivo: MENSAGEM_PADRAO_INVALIDO })
        return
      }
      if (error) {
        setEstado({ tipo: 'invalido', motivo: mensagemParaCodigo(codigoDoErro(error)) })
        return
      }
      setEstado({ tipo: 'pronto' })
    })

    return () => { cancelado = true }
  }, [])

  async function aoGravar() {
    if (gravando) return

    const problema = problemaDaSenha(senhaNova, senhaRepetida)
    if (problema) {
      setErroSenha(problema)
      return
    }

    setGravando(true)
    setErroSenha(null)
    const resultado = await redefinirSenha(senhaNova, senhaRepetida)

    if (resultado.erro) {
      setErroSenha(resultado.erro)
      setGravando(false)
      return
    }

    router.replace('/oportunidades')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eceef1] p-4 sm:p-8">
      <div className="grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[22px] bg-white shadow-[0_26px_70px_-32px_rgba(20,22,26,.45)] lg:grid-cols-[52%_48%]">
        <PainelApresentacao />

        {estado.tipo === 'verificando' && (
          <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
            <p className="text-[14px] text-[#8a909a]">Verificando o link…</p>
          </div>
        )}

        {estado.tipo === 'invalido' && (
          <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#ff5a3c]">Globo Slots</p>
            <h2 className="vitrine-pop mt-2 text-[27px] font-extrabold text-[#14161a]">Link indisponível</h2>
            <p role="alert" className="mt-4 text-[14px] text-[#5a606a]">{estado.motivo}</p>
            <Link href="/esqueci-senha" className="vitrine-pop mt-8 inline-block h-[52px] rounded-[14px] bg-[#14161a] px-5 text-center text-[15px] font-bold leading-[52px] text-white">Pedir novo link</Link>
          </div>
        )}

        {estado.tipo === 'pronto' && (
          <FormularioRedefinirSenha
            senhaNova={senhaNova}
            senhaRepetida={senhaRepetida}
            erro={erroSenha}
            gravando={gravando}
            aoMudarSenhaNova={(valor) => { setSenhaNova(valor); setErroSenha(null) }}
            aoMudarSenhaRepetida={(valor) => { setSenhaRepetida(valor); setErroSenha(null) }}
            aoGravar={aoGravar}
          />
        )}
      </div>
    </main>
  )
}
