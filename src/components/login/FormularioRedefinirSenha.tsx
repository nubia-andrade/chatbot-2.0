'use client'

import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'

type Props = {
  senhaNova: string
  senhaRepetida: string
  erro: string | null
  gravando: boolean
  aoMudarSenhaNova: (valor: string) => void
  aoMudarSenhaRepetida: (valor: string) => void
  aoGravar: () => void
}

/**
 * Formulário de senha nova, mostrado depois que o link de recuperação
 * estabelece uma sessão válida (ver `TelaRedefinirSenha`).
 */
export function FormularioRedefinirSenha({
  senhaNova,
  senhaRepetida,
  erro,
  gravando,
  aoMudarSenhaNova,
  aoMudarSenhaRepetida,
  aoGravar,
}: Props) {
  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
      <h2
        className="text-[26px] font-bold text-[var(--texto)]"
        style={{ fontFamily: 'var(--fonte-titulo)' }}
      >
        Defina sua senha nova
      </h2>
      <p className="mt-2 mb-8 text-[14px] text-[var(--texto-3)]">
        Escolha uma senha com pelo menos 8 caracteres.
      </p>

      <form
        method="post"
        noValidate
        className="flex flex-col gap-[18px]"
        onSubmit={(evento) => {
          evento.preventDefault()
          aoGravar()
        }}
      >
        <div>
          <label
            htmlFor="senha-nova"
            className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]"
          >
            Senha nova
          </label>
          <input
            id="senha-nova"
            name="senha-nova"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={senhaNova}
            onChange={(evento) => aoMudarSenhaNova(evento.target.value)}
            placeholder="••••••••••"
            aria-invalid={erro !== null}
            className="h-[50px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-4 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
        </div>

        <div>
          <label
            htmlFor="senha-repetida"
            className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]"
          >
            Repita a senha nova
          </label>
          <input
            id="senha-repetida"
            name="senha-repetida"
            type="password"
            autoComplete="new-password"
            value={senhaRepetida}
            onChange={(evento) => aoMudarSenhaRepetida(evento.target.value)}
            placeholder="••••••••••"
            aria-invalid={erro !== null}
            className="h-[50px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-4 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
        </div>

        {erro && (
          <p role="alert" className="text-[13px] font-semibold text-[var(--concorrencia)]">
            {erro}
          </p>
        )}

        <BotaoDeGravacao gravando={gravando} className="h-[52px] text-[15px]">
          Salvar senha nova
        </BotaoDeGravacao>
      </form>
    </div>
  )
}
