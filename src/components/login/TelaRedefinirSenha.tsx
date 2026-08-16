'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarClienteNavegador } from '@/lib/supabase/cliente-navegador'
import { problemaDaSenha } from '@/lib/dominio/senha'
import { redefinirSenha } from '@/lib/acoes/senha'
import { PainelApresentacao } from './PainelApresentacao'
import { FormularioRedefinirSenha } from './FormularioRedefinirSenha'

/**
 * Tela pública "Redefinir senha" — para onde `/esqueci-senha` manda o link
 * do e-mail. A rota está fora do grupo `(app)`, então não passa pela guarda
 * que exige sessão (ver `src/app/(app)/layout.tsx`).
 *
 * ## Como o token chega aqui
 *
 * O projeto usa `@supabase/ssr`, que fixa `flowType: 'pkce'` tanto no
 * cliente de navegador quanto no de servidor (não dá para trocar por opção —
 * ver `createBrowserClient.js`/`createServerClient.js` do pacote). Por isso
 * o link do e-mail sempre chega como `?code=...` na query string (fluxo
 * PKCE), nunca como fragmento `#access_token=...` (fluxo implícito) — e se
 * algum dia chegasse assim, o próprio supabase-js recusaria por não bater
 * com o `flowType` configurado.
 *
 * A troca do código pela sessão é automática: o `supabase-js` (por trás de
 * `criarClienteNavegador`) lê a URL sozinho ao inicializar, graças a
 * `detectSessionInUrl` (ligado por padrão no navegador). Não é preciso
 * chamar `exchangeCodeForSession` à mão — só aguardar
 * `supabase.auth.initialize()`, que devolve `{ error }` quando o código é
 * inválido ou expirado (ex.: `otp_expired`) e dispara o evento
 * `PASSWORD_RECOVERY` quando dá certo.
 *
 * Se a pessoa cair aqui sem `code` nem `error` na URL (por exemplo, digitou
 * o endereço à mão), não há nada para processar — tratado como link
 * inválido, sem tentar prosseguir com um formulário sem sessão por trás.
 */

type Estado =
  | { tipo: 'verificando' }
  | { tipo: 'invalido'; motivo: string }
  | { tipo: 'pronto' }

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  otp_expired:
    'Este link de redefinição expirou. Peça um novo link para trocar a senha.',
  access_denied:
    'Este link de redefinição não é mais válido. Peça um novo link para trocar a senha.',
}

const MENSAGEM_PADRAO_INVALIDO =
  'Este link de redefinição é inválido ou já foi usado. Peça um novo link para trocar a senha.'

function mensagemParaCodigo(codigo: string | undefined): string {
  return (codigo && MENSAGENS_POR_CODIGO[codigo]) || MENSAGEM_PADRAO_INVALIDO
}

/** Extrai `{ error, code }` de um erro de inicialização do supabase-js, quando presente. */
function codigoDoErro(erro: unknown): string | undefined {
  if (typeof erro !== 'object' || erro === null) return undefined
  const detalhes = (erro as { details?: { code?: string } }).details
  return detalhes?.code
}

/** Lê `error`/`error_code` tanto da query string quanto do fragmento da URL. */
function erroNaUrl(): string | undefined {
  const busca = new URLSearchParams(window.location.search)
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const codigo = busca.get('error_code') ?? fragmento.get('error_code')
  const generico = busca.get('error') ?? fragmento.get('error')
  return codigo ?? generico ?? undefined
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

    // As checagens síncronas (erro na URL, ausência de `code`) também ficam
    // dentro do `.then()` — chamar `setEstado` direto no corpo do efeito, em
    // vez de numa continuação assíncrona, é o que o lint de hooks proíbe
    // (cascata de renders). `initialize()` é seguro de chamar sempre: sem
    // `code`/`error` na URL ele só tenta recuperar sessão existente do
    // armazenamento e resolve com `{ error: null }`.
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

    return () => {
      cancelado = true
    }
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

    router.replace('/inicio')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 sm:p-8">
      <div className="grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[16px] bg-[var(--superficie)] shadow-[var(--sombra-janela)] lg:grid-cols-[52%_48%]">
        <PainelApresentacao />

        {estado.tipo === 'verificando' && (
          <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
            <p className="text-[14px] text-[var(--texto-3)]">Verificando o link…</p>
          </div>
        )}

        {estado.tipo === 'invalido' && (
          <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
            <h2
              className="text-[26px] font-bold text-[var(--texto)]"
              style={{ fontFamily: 'var(--fonte-titulo)' }}
            >
              Link indisponível
            </h2>
            <p role="alert" className="mt-4 text-[14px] text-[var(--texto-2)]">
              {estado.motivo}
            </p>
            <Link
              href="/esqueci-senha"
              className="mt-8 inline-block h-[52px] rounded-[12px] px-5 text-center text-[15px] font-bold leading-[52px] text-white"
              style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
            >
              Pedir novo link
            </Link>
          </div>
        )}

        {estado.tipo === 'pronto' && (
          <FormularioRedefinirSenha
            senhaNova={senhaNova}
            senhaRepetida={senhaRepetida}
            erro={erroSenha}
            gravando={gravando}
            aoMudarSenhaNova={(valor) => {
              setSenhaNova(valor)
              setErroSenha(null)
            }}
            aoMudarSenhaRepetida={(valor) => {
              setSenhaRepetida(valor)
              setErroSenha(null)
            }}
            aoGravar={aoGravar}
          />
        )}
      </div>
    </main>
  )
}
