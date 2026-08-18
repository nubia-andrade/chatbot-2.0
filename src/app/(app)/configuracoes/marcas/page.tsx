import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarProgramas } from '@/lib/dominio/perfis'
import { listarAnunciantesTakePendentes } from '@/lib/dados/marcas-take'
import { PainelDeMarcasPendentes } from '@/components/configuracoes/PainelDeMarcasPendentes'

export default async function PaginaMarcasEAnunciantes() {
  const sessao = await obterSessao()

  if (!sessao || !podeAdministrarProgramas(sessao.perfis)) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-8">
        <h1 className="text-[24px] font-bold text-[var(--texto)]">Marcas e anunciantes</h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  const pendentes = await listarAnunciantesTakePendentes()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[var(--roxo)]">Governança de dados</p>
        <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]">Marcas e anunciantes</h1>
        <p className="mt-2 max-w-[760px] text-[13px] leading-[1.55] text-[var(--texto-3)]">
          O Globo Take ensina quais marcas aparecem sob cada anunciante. Quando o nome do Take não casa de forma inequívoca com a carteira, confirme o relacionamento uma única vez aqui. Depois disso todas as marcas desse anunciante ficam disponíveis na Nova Consulta.
        </p>
      </header>

      <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3 text-[12px] leading-[1.5] text-[var(--texto-2)]">
        Casamentos automáticos só acontecem quando existe exatamente um cliente com o mesmo nome normalizado. Nomes diferentes, abreviações e casos ambíguos ficam pendentes para evitar relacionar uma marca ao anunciante errado.
      </div>

      <PainelDeMarcasPendentes pendentes={pendentes} />
    </div>
  )
}
