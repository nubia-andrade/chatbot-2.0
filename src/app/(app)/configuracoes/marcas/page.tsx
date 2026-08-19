import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarGovernancaGlobal } from '@/lib/dominio/perfis'
import {
  buscarRelacionamentosMarcas,
  listarAnunciantesTakePendentes,
} from '@/lib/dados/marcas-take'
import { listarVinculosManuaisDeMarca } from '@/lib/dados/marcas-manuais'
import { PainelDeMarcasPendentes } from '@/components/configuracoes/PainelDeMarcasPendentes'
import { PainelDeRelacionamentosDeMarcas } from '@/components/configuracoes/PainelDeRelacionamentosDeMarcas'
import { PainelDeMarcaManual } from '@/components/configuracoes/PainelDeMarcaManual'

export default async function PaginaMarcasEAnunciantes() {
  const sessao = await obterSessao()

  if (!sessao || !podeAdministrarGovernancaGlobal(sessao.perfis)) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-8">
        <h1 className="text-[24px] font-bold text-[var(--texto)]">Marcas e anunciantes</h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">Somente Proprietário pode administrar a governança global de marcas.</p>
      </section>
    )
  }

  const [pendentes, relacionamentos, manuais] = await Promise.all([
    listarAnunciantesTakePendentes(),
    buscarRelacionamentosMarcas('', 50),
    listarVinculosManuaisDeMarca(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[var(--roxo)]">Governança de dados</p>
        <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]">Marcas e anunciantes</h1>
        <p className="mt-2 max-w-[900px] text-[13px] leading-[1.55] text-[var(--texto-3)]">
          Gerencie tanto os relacionamentos aprendidos pelo Globo Take quanto marcas cadastradas manualmente. Marcas incluídas por executivos ficam disponíveis imediatamente, entram como pendentes de revisão e são consolidadas no relatório diário de governança.
        </p>
      </header>

      <PainelDeMarcaManual iniciais={manuais} />

      <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3 text-[12px] leading-[1.5] text-[var(--texto-2)]">
        A Nova Consulta usa primeiro o vínculo manual explícito da marca, quando existir. Para marcas observadas no Globo Take, usa a correção específica da relação e, na ausência dela, o relacionamento padrão do anunciante da API.
      </div>

      <PainelDeRelacionamentosDeMarcas iniciais={relacionamentos} />

      <div className="border-t border-[var(--borda)] pt-7">
        <div className="mb-4">
          <h2 className="text-[17px] font-bold text-[var(--texto)]">Relacionamentos pendentes</h2>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--texto-3)]">
            Quando o nome do anunciante do Take não encontra um único cliente seguro na carteira, confirme o relacionamento aqui. Depois disso suas marcas passam a aparecer na Nova Consulta.
          </p>
        </div>
        <PainelDeMarcasPendentes pendentes={pendentes} />
      </div>
    </div>
  )
}
