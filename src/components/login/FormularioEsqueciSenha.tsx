'use client'

import Link from 'next/link'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'

type Props = {
  email: string
  enviando: boolean
  erro: string | null
  enviado: boolean
  aoMudarEmail: (valor: string) => void
  aoEnviar: () => void
}

/**
 * O lado direito de `/esqueci-senha` (48% da largura no desktop), no mesmo
 * molde de `FormularioEntrada`.
 *
 * Depois de enviar, o formulário some e dá lugar à mensagem neutra — não tem
 * sentido deixar a pessoa reenviar em loop, e a mensagem já diz o que fazer
 * a seguir.
 */
export function FormularioEsqueciSenha({
  email,
  enviando,
  erro,
  enviado,
  aoMudarEmail,
  aoEnviar,
}: Props) {
  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
      <h2
        className="text-[26px] font-bold text-[var(--texto)]"
        style={{ fontFamily: 'var(--fonte-titulo)' }}
      >
        Esqueci minha senha
      </h2>
      <p className="mt-2 mb-8 text-[14px] text-[var(--texto-3)]">
        Informe seu e-mail corporativo. Se houver conta cadastrada, enviamos um
        link para trocar a senha.
      </p>

      {enviado ? (
        <div
          role="status"
          className="rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] p-4 text-[14px] text-[var(--texto)]"
        >
          Se houver conta com esse e-mail, enviamos o link para redefinir a
          senha. Confira sua caixa de entrada (e o spam).
        </div>
      ) : (
        <form
          method="post"
          noValidate
          className="flex flex-col gap-[18px]"
          onSubmit={(evento) => {
            evento.preventDefault()
            aoEnviar()
          }}
        >
          <div>
            <label
              htmlFor="email"
              className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]"
            >
              E-mail corporativo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(evento) => aoMudarEmail(evento.target.value)}
              placeholder="nome@empresa.com.br"
              aria-invalid={erro !== null}
              className="h-[50px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-4 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
            />
          </div>

          {erro && (
            <p role="alert" className="text-[13px] font-semibold text-[var(--concorrencia)]">
              {erro}
            </p>
          )}

          <BotaoDeGravacao gravando={enviando} className="h-[52px] text-[15px]">
            Enviar link de redefinição
          </BotaoDeGravacao>
        </form>
      )}

      <Link
        href="/login"
        className="mt-8 text-[12px] font-semibold text-[var(--roxo)] hover:text-[var(--roxo-hover)]"
      >
        Voltar para o login
      </Link>
    </div>
  )
}
