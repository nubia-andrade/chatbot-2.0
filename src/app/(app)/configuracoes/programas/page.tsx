import Link from 'next/link'
import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'
import { listarProgramas } from '@/lib/dados/programas'
import { GradeDeProgramas } from '@/components/programas/GradeDeProgramas'

export default async function PaginaDeProgramas() {
  const sessao = await obterSessao()

  if (!podeAdministrar(sessao)) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-10">
        <h1 className="text-[26px] font-bold" style={{ fontFamily: 'var(--fonte-titulo)' }}>Programas</h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">Você não tem permissão para ver esta página.</p>
      </section>
    )
  }

  const todos = await listarProgramas()
  const proprietario = Boolean(sessao && temPerfil(sessao.perfis, 'proprietario'))
  const programas = proprietario
    ? todos
    : todos.filter((programa) => sessao?.programasVinculados.includes(programa.id))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="globo-slots-gradient-text text-[10.5px] font-bold uppercase tracking-[.08em]">Programas e proposta</p>
          <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>Programas</h1>
          <p className="mt-1 text-[13px] text-[var(--texto-3)]">
            {proprietario
              ? 'Cadastro e regras dos programas que entram no cálculo de ocupação e nas propostas.'
              : 'Somente os programas sob sua responsabilidade aparecem nesta visão.'}
          </p>
        </div>

        {proprietario && (
          <Link
            href="/configuracoes/programas/novo"
            className="h-[44px] rounded-[12px] px-5 text-[13.5px] font-bold leading-[44px] text-white"
            style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
          >
            Novo programa
          </Link>
        )}
      </header>

      {programas.length === 0 && !proprietario ? (
        <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie)] p-8 text-center">
          <p className="text-[13px] font-bold text-[var(--texto)]">Nenhum programa vinculado ao seu perfil</p>
          <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Peça ao Proprietário para associar os programas que você administra em Perfis e acessos.</p>
        </div>
      ) : (
        <GradeDeProgramas
          programas={programas}
          perfis={sessao?.perfis ?? []}
          programasVinculados={sessao?.programasVinculados ?? []}
        />
      )}
    </div>
  )
}
