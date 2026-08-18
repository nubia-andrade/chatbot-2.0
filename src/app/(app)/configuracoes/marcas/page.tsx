import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarProgramas } from '@/lib/dominio/perfis'
import {
  buscarRelacionamentosMarcas,
  listarAnunciantesTakePendentes,
} from '@/lib/dados/marcas-take'
import { PainelDeMarcasPendentes } from '@/components/configuracoes/PainelDeMarcasPendentes'
import { PainelDeRelacionamentosDeMarcas } from '@/components/configuracoes/PainelDeRelacionamentosDeMarcas'

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

  const [pendentes, relacionamentos] = await Promise.all([
    listarAnunciantesTakePendentes(),
    buscarRelacionamentosMarcas('', 50),
  ])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[var(--roxo)]">Governança de dados</p>
        <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]">Marcas e anunciantes</h1>
        <p className="mt-2 max-w-[820px] text-[13px] leading-[1.55] text-[var(--texto-3)]">
          Consulte e corrija como cada marca do Globo Take se relaciona com o anunciante oficial da carteira. Relacionamentos automáticos continuam sendo o padrão, mas uma correção manual pode ser aplicada a uma marca específica sem afetar as demais marcas do mesmo anunciante.
        </p>
      </header>

      <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3 text-[12px] leading-[1.5] text-[var(--texto-2)]">
        A Nova Consulta sempre usa o anunciante efetivo exibido nesta página: primeiro uma correção manual da marca, quando existir; caso contrário, o relacionamento padrão do anunciante vindo do Globo Take.
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
