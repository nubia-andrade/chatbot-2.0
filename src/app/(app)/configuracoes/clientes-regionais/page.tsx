import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarGovernancaGlobal } from '@/lib/dominio/perfis'
import { listarClientesElegiveis } from '@/lib/dados/clientes-regionais'
import { PainelDeClientesRegionais } from '@/components/configuracoes/PainelDeClientesRegionais'

/** Configuração global: somente Proprietário. */
export default async function PaginaDeClientesRegionais() {
  const sessao = await obterSessao()

  if (!sessao || !podeAdministrarGovernancaGlobal(sessao.perfis)) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-10">
        <h1 className="text-[26px] font-bold" style={{ fontFamily: 'var(--fonte-titulo)' }}>Clientes regionais</h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">Somente Proprietário pode alterar a elegibilidade regional global.</p>
      </section>
    )
  }

  const { clientes, total } = await listarClientesElegiveis(1, '')

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Governança de dados</p>
        <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>Clientes regionais</h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">Quem pode comprar ação regional. A elegibilidade é global e vale para todos os programas que aceitam Regional.</p>
      </header>

      <PainelDeClientesRegionais clientesIniciais={clientes} totalInicial={total} />
    </div>
  )
}
