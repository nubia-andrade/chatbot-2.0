'use client'

import Link from 'next/link'

type Props = {
  email: string
  senha: string
  erro: string | null
  entrando: boolean
  aoMudarEmail: (valor: string) => void
  aoMudarSenha: (valor: string) => void
  aoEntrar: () => void
}

export function FormularioEntrada({ email, senha, erro, entrando, aoMudarEmail, aoMudarSenha, aoEntrar }: Props) {
  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
      <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[#ff5a3c]">Globo Slots</p>
      <h2 className="vitrine-pop mt-2 text-[28px] font-extrabold tracking-[-.5px] text-[#14161a]">Entrar</h2>
      <p className="mb-8 mt-2 text-[14px] text-[#6b7280]">Acesse com sua conta corporativa.</p>

      <form method="post" noValidate className="flex flex-col gap-[18px]" onSubmit={(evento) => { evento.preventDefault(); aoEntrar() }}>
        <div>
          <label htmlFor="email" className="mb-[7px] block text-[12px] font-semibold text-[#5a606a]">E-mail corporativo</label>
          <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(evento) => aoMudarEmail(evento.target.value)} placeholder="nome@empresa.com.br" aria-invalid={erro !== null} className="vitrine-input h-[50px]" />
        </div>

        <div>
          <label htmlFor="senha" className="mb-[7px] block text-[12px] font-semibold text-[#5a606a]">Senha</label>
          <input id="senha" name="senha" type="password" autoComplete="current-password" value={senha} onChange={(evento) => aoMudarSenha(evento.target.value)} placeholder="••••••••••" aria-invalid={erro !== null} className="vitrine-input h-[50px]" />
        </div>

        <div className="flex justify-end"><Link href="/esqueci-senha" className="text-[12px] font-bold text-[#14161a] hover:underline">Esqueci minha senha</Link></div>
        {erro && <p role="alert" className="text-[13px] font-semibold text-[#BE123C]">{erro}</p>}

        <button type="submit" disabled={entrando} className="vitrine-pop h-[52px] rounded-[14px] bg-[#14161a] text-[15px] font-bold text-white shadow-[0_14px_28px_-18px_rgba(20,22,26,.55)] enabled:cursor-pointer disabled:opacity-70">
          {entrando ? 'Entrando…' : 'Entrar no Globo Slots'}
        </button>
      </form>
    </div>
  )
}
