import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarGovernancaGlobal } from '@/lib/dominio/perfis'
import { resumoDaImportacao } from '@/lib/dados/importacao'
import { PainelDeImportacao } from '@/components/importacao/PainelDeImportacao'

/** Snapshot global do Globo Take: somente Proprietário. */
export default async function PaginaDeImportacao() {
  const sessao = await obterSessao()

  if (!sessao || !podeAdministrarGovernancaGlobal(sessao.perfis)) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-10">
        <h1 className="text-[26px] font-bold" style={{ fontFamily: 'var(--fonte-titulo)' }}>Importação Globo Take</h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">Somente Proprietário pode administrar a fonte global de vendas.</p>
      </section>
    )
  }

  const resumo = await resumoDaImportacao()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Governança de dados</p>
        <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>Importação Globo Take</h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">Estado do snapshot de vendas trazido da API do Globo Take.</p>
      </header>

      <PainelDeImportacao resumo={resumo} />
    </div>
  )
}
