'use client'

type Props = {
  email: string
  senha: string
  erro: string | null
  entrando: boolean
  aoMudarEmail: (valor: string) => void
  aoMudarSenha: (valor: string) => void
  aoEntrar: () => void
}

/**
 * O lado direito da tela de login (48% da largura no desktop): o formulário.
 */
export function FormularioEntrada({
  email,
  senha,
  erro,
  entrando,
  aoMudarEmail,
  aoMudarSenha,
  aoEntrar,
}: Props) {
  return (
    <div className="flex flex-col justify-center px-8 py-12 sm:px-16 sm:py-14">
      <h2
        className="text-[26px] font-bold text-[var(--texto)]"
        style={{ fontFamily: 'var(--fonte-titulo)' }}
      >
        Entrar
      </h2>
      <p className="mt-2 mb-8 text-[14px] text-[var(--texto-3)]">
        Acesse com sua conta corporativa.
      </p>

      {/*
        `method="post"` é o cinto de segurança para quando o JavaScript não
        carrega: sem quem atenda o `onSubmit`, o navegador envia o formulário
        sozinho, e o padrão do HTML é GET — que poria a senha na barra de
        endereço e nos logs do servidor.
      */}
      <form
        method="post"
        noValidate
        className="flex flex-col gap-[18px]"
        onSubmit={(evento) => {
          evento.preventDefault()
          aoEntrar()
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
            value={email}
            onChange={(evento) => aoMudarEmail(evento.target.value)}
            placeholder="nome@empresa.com.br"
            aria-invalid={erro !== null}
            className="h-[50px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-4 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
        </div>

        <div>
          <label
            htmlFor="senha"
            className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]"
          >
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => aoMudarSenha(evento.target.value)}
            placeholder="••••••••••"
            aria-invalid={erro !== null}
            className="h-[50px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-4 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
        </div>

        <div className="flex justify-end">
          {/*
            Recuperação de senha ainda não tem fluxo — a tela mostra a
            intenção sem prometer um link que não leva a lugar nenhum.
          */}
          <span className="cursor-default text-[12px] font-semibold text-[var(--roxo)]">
            Esqueci minha senha
          </span>
        </div>

        {erro && (
          <p role="alert" className="text-[13px] font-semibold text-[var(--concorrencia)]">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="h-[52px] rounded-[12px] text-[15px] font-bold text-white enabled:cursor-pointer disabled:opacity-70"
          style={{ fontFamily: 'var(--fonte-titulo)', background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        {/*
          "Entrar com SSO corporativo" fica de fora desta entrega: a decisão
          de quando e como integrar SSO corporativo é da spec, não desta
          tarefa (Task 8). O espaço abaixo do botão "Entrar" é onde esse
          botão vai entrar quando a spec definir o provedor.
        */}
      </form>
    </div>
  )
}
