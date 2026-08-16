import Link from 'next/link'
import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { listarProgramas } from '@/lib/dados/programas'
import { GradeDeProgramas } from '@/components/programas/GradeDeProgramas'

/**
 * Lista de programas, em grade de cartões — Task 9.
 *
 * De propósito, repete a checagem de `podeAdministrar` que já decide se
 * "Configurações" aparece na barra lateral (`BarraLateral.tsx`): esconder o
 * link é conveniência de interface, quem protege de verdade os dados é o
 * RLS do banco (`supabase/schema.sql` e `supabase/schema-entrega-2.sql`).
 * Quem forçar esta URL sem permissão vê o aviso abaixo, não a lista.
 */
export default async function PaginaDeProgramas() {
  const sessao = await obterSessao()

  if (!podeAdministrar(sessao)) {
    return (
      <section
        style={{
          background: 'var(--superficie)',
          borderRadius: 'var(--raio-janela)',
          padding: '40px',
          border: '1px solid var(--borda)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 26, fontWeight: 700 }}>
          Programas
        </h1>
        <p style={{ color: 'var(--concorrencia)', marginTop: 8 }}>
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  const programas = await listarProgramas()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="text-[26px] font-bold text-[var(--texto)]"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            Programas
          </h1>
          <p className="mt-1 text-[13px] text-[var(--texto-3)]">
            Cadastro dos programas que entram no cálculo de ocupação e nas propostas.
          </p>
        </div>

        <Link
          href="/configuracoes/programas/novo"
          className="h-[44px] rounded-[12px] px-5 text-[13.5px] font-bold leading-[44px] text-white"
          style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
        >
          Novo programa
        </Link>
      </header>

      <GradeDeProgramas
        programas={programas}
        perfis={sessao?.perfis ?? []}
        programasVinculados={sessao?.programasVinculados ?? []}
      />
    </div>
  )
}
