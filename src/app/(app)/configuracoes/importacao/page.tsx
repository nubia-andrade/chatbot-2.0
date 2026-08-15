import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { resumoDaImportacao } from '@/lib/dados/importacao'
import { PainelDeImportacao } from '@/components/importacao/PainelDeImportacao'

/**
 * Painel de acompanhamento da importação — Task 12.
 *
 * De propósito, repete a checagem de `podeAdministrar` que já decide se
 * "Configurações" aparece na barra lateral (`BarraLateral.tsx`) e que a
 * lista de programas (Task 11) também repete: esconder o link é
 * conveniência de interface, quem protege de verdade os dados é o RLS do
 * banco (`supabase/schema.sql`).
 */
export default async function PaginaDeImportacao() {
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
          Importação
        </h1>
        <p style={{ color: 'var(--concorrencia)', marginTop: 8 }}>
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  const resumo = await resumoDaImportacao()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="text-[26px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Importação
        </h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Estado do snapshot de vendas trazido da API do Globo Take.
        </p>
      </header>

      <PainelDeImportacao resumo={resumo} />
    </div>
  )
}
