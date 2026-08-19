import Link from 'next/link'
import { carregarPerformanceInicio, type MetricasPerformance, type PropostaRecente } from '@/lib/dados/performance'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'
import type { StatusNegociacao } from '@/lib/dados/propostas'
import { GraficoEvolucaoComercial } from '@/components/inicio/GraficoEvolucaoComercial'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor)
}

function dataCurta(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(valor))
}

const STATUS: Record<StatusNegociacao, string> = {
  em_negociacao: 'Em negociação',
  fechada: 'Fechada',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
  substituida: 'Substituída',
}

export default async function PaginaInicio() {
  const [sessao, performance] = await Promise.all([
    obterSessao(),
    carregarPerformanceInicio(),
  ])

  if (!sessao) return null

  const podeConsultar = temPerfil(sessao.perfis, 'executivo')
    || temPerfil(sessao.perfis, 'executivo_regional')
    || temPerfil(sessao.perfis, 'proprietario')

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.09em] text-[var(--roxo)]">Visão de trabalho</p>
          <h1 className="mt-1 text-[28px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
            Olá, {primeiroNome(sessao.nome)}.
          </h1>
          <p className="mt-1 text-[13px] text-[var(--texto-3)]">
            {performance.programas
              ? 'Acompanhe a demanda dos programas sob sua responsabilidade e o andamento comercial das propostas.'
              : 'Acompanhe suas propostas e continue suas negociações a partir daqui.'}
          </p>
        </div>
        {podeConsultar && (
          <Link
            href="/consulta"
            className="rounded-[11px] px-5 py-3 text-[12.5px] font-bold text-white"
            style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
          >
            + Nova consulta
          </Link>
        )}
      </header>

      {!performance.schemaDisponivel && (
        <section className="rounded-[var(--raio-card)] border border-[#F1D3A6] bg-[#FFF8EC] p-4">
          <p className="text-[12.5px] font-bold text-[#8A5700]">Acompanhamento comercial ainda não habilitado</p>
          <p className="mt-1 text-[11.5px] text-[var(--texto-2)]">Execute <strong>supabase/schema-entrega-5-acompanhamento-performance.sql</strong> no Supabase para liberar status, conversão e versionamento.</p>
        </section>
      )}

      {performance.executivo && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--roxo)]">Minha atividade</p>
              <h2 className="mt-1 text-[19px] font-bold text-[var(--texto)]">Meu mês comercial</h2>
            </div>
            <Link href="/propostas" className="text-[11.5px] font-bold text-[var(--roxo)]">Ver todas as minhas propostas →</Link>
          </div>

          <GradeMetricas metricas={performance.executivo.metricasMes} modo="executivo" />

          <GraficoEvolucaoComercial
            titulo="Evolução da minha performance"
            subtitulo="Ofertado x Vendido pela data de criação da proposta."
            pontos={performance.executivo.evolucao12Meses}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
            <ListaRecentes titulo="Minhas propostas recentes" propostas={performance.executivo.recentes} />
            <Funil metricas={performance.executivo.metricasMes} />
          </div>
        </section>
      )}

      {performance.programas && (
        <section className="flex flex-col gap-4 border-t border-[var(--borda)] pt-7">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--roxo)]">Meus programas</p>
            <h2 className="mt-1 text-[19px] font-bold text-[var(--texto)]">Performance dos programas</h2>
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Indicadores do mês atual considerando somente a versão vigente de cada proposta.</p>
          </div>

          <GradeMetricas metricas={performance.programas.metricasMes} modo="programa" />

          <GraficoEvolucaoComercial
            titulo="Evolução comercial dos programas"
            subtitulo="Ofertado x Vendido das propostas dos programas sob sua responsabilidade."
            pontos={performance.programas.evolucao12Meses}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-bold text-[var(--texto)]">Programas por valor proposto</h3>
                <span className="text-[10.5px] text-[var(--texto-3)]">Mês atual</span>
              </div>
              <div className="mt-4 divide-y divide-[var(--borda)]">
                {performance.programas.porPrograma.length === 0 ? (
                  <Vazio texto="Ainda não há propostas dos seus programas neste mês." />
                ) : performance.programas.porPrograma.slice(0, 8).map((programa) => (
                  <div key={programa.programaId ?? programa.programaNome} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px_90px] sm:items-center">
                    <div>
                      <p className="text-[12.5px] font-bold text-[var(--texto)]">{programa.programaNome}</p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">{programa.metricas.propostas} proposta{programa.metricas.propostas === 1 ? '' : 's'} · {programa.metricas.clientes} anunciante{programa.metricas.clientes === 1 ? '' : 's'}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[10px] uppercase text-[var(--texto-3)]">Proposto</p>
                      <p className="mt-0.5 text-[12px] font-bold text-[var(--texto)]">{moeda(programa.metricas.valorProposto)}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[10px] uppercase text-[var(--texto-3)]">Conversão</p>
                      <p className="mt-0.5 text-[12px] font-bold text-[var(--roxo)]">{programa.metricas.conversao === null ? '—' : `${programa.metricas.conversao}%`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-4">
              <Funil metricas={performance.programas.metricasMes} />
              <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
                <h3 className="text-[14px] font-bold text-[var(--texto)]">Composição das propostas</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetrica rotulo="Com Digital" valor={`${performance.programas.metricasMes.percentualDigital}%`} />
                  <MiniMetrica rotulo="Com Redes" valor={`${performance.programas.metricasMes.percentualRedes}%`} />
                  <MiniMetrica rotulo="Nacionais" valor={String(performance.programas.metricasMes.nacionais)} />
                  <MiniMetrica rotulo="Regionais" valor={String(performance.programas.metricasMes.regionais)} />
                </div>
              </section>
            </div>
          </div>

          <ListaRecentes titulo="Propostas recentes dos programas" propostas={performance.programas.recentes} />
        </section>
      )}
    </div>
  )
}

function GradeMetricas({ metricas, modo }: { metricas: MetricasPerformance; modo: 'executivo' | 'programa' }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metrica rotulo="Propostas no mês" valor={String(metricas.propostas)} apoio={`${metricas.emNegociacao} em negociação`} />
      <Metrica rotulo="Valor comercial proposto" valor={moeda(metricas.valorProposto)} apoio={`${metricas.clientes} anunciantes`} />
      <Metrica rotulo="Valor fechado" valor={moeda(metricas.valorFechado)} apoio={`${metricas.fechadas} fechada${metricas.fechadas === 1 ? '' : 's'}`} />
      <Metrica rotulo="Taxa de conversão" valor={metricas.conversao === null ? '—' : `${metricas.conversao}%`} apoio={metricas.conversao === null ? 'Aguardando negociações decididas' : 'Fechadas ÷ fechadas + perdidas'} destaque={modo === 'executivo'} />
    </div>
  )
}

function Metrica({ rotulo, valor, apoio, destaque = false }: { rotulo: string; valor: string; apoio: string; destaque?: boolean }) {
  return (
    <div className={`rounded-[var(--raio-card)] border p-4 ${destaque ? 'border-[#DDD6FE] bg-[#FAF8FF]' : 'border-[var(--borda)] bg-[var(--superficie)]'}`}>
      <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">{rotulo}</p>
      <p className={`mt-2 text-[22px] font-bold ${destaque ? 'text-[var(--roxo)]' : 'text-[var(--texto)]'}`}>{valor}</p>
      <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">{apoio}</p>
    </div>
  )
}

function ListaRecentes({ titulo, propostas }: { titulo: string; propostas: PropostaRecente[] }) {
  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-bold text-[var(--texto)]">{titulo}</h3>
        <Link href="/propostas" className="text-[10.5px] font-bold text-[var(--roxo)]">Abrir propostas →</Link>
      </div>
      <div className="mt-3 divide-y divide-[var(--borda)]">
        {propostas.length === 0 ? <Vazio texto="Nenhuma proposta disponível ainda." /> : propostas.map((proposta) => (
          <div key={proposta.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12.5px] font-bold text-[var(--texto)]">{proposta.marca} · {proposta.programa}</p>
                <span className="rounded-full bg-[var(--superficie-suave)] px-2 py-0.5 text-[9px] font-bold text-[var(--texto-3)]">v{proposta.versao}</span>
              </div>
              <p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">{proposta.cliente} · {dataCurta(proposta.criadoEm)}</p>
            </div>
            <p className="text-[11.5px] font-bold text-[var(--texto)] sm:text-right">{moeda(proposta.valor)}</p>
            <span className={`justify-self-start rounded-full px-2.5 py-1 text-[9.5px] font-bold sm:justify-self-end ${classeStatus(proposta.status)}`}>{STATUS[proposta.status]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Funil({ metricas }: { metricas: MetricasPerformance }) {
  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
      <h3 className="text-[14px] font-bold text-[var(--texto)]">Andamento comercial</h3>
      <div className="mt-4 grid gap-2">
        <LinhaFunil rotulo="Em negociação" valor={metricas.emNegociacao} total={metricas.propostas} />
        <LinhaFunil rotulo="Fechadas" valor={metricas.fechadas} total={metricas.propostas} />
        <LinhaFunil rotulo="Perdidas" valor={metricas.perdidas} total={metricas.propostas} />
        <LinhaFunil rotulo="Canceladas" valor={metricas.canceladas} total={metricas.propostas} />
      </div>
    </section>
  )
}

function LinhaFunil({ rotulo, valor, total }: { rotulo: string; valor: number; total: number }) {
  const percentual = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10.5px]">
        <span className="font-semibold text-[var(--texto-2)]">{rotulo}</span>
        <strong className="text-[var(--texto)]">{valor} · {percentual}%</strong>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--superficie-suave)]">
        <div className="h-full rounded-full bg-[var(--roxo)]" style={{ width: `${percentual}%`, opacity: 0.72 }} />
      </div>
    </div>
  )
}

function MiniMetrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-[10px] bg-[var(--superficie-suave)] p-3"><p className="text-[9.5px] font-bold uppercase text-[var(--texto-3)]">{rotulo}</p><p className="mt-1 text-[16px] font-bold text-[var(--texto)]">{valor}</p></div>
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-5 text-center text-[11.5px] text-[var(--texto-3)]">{texto}</p>
}

function classeStatus(status: StatusNegociacao): string {
  if (status === 'fechada') return 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]'
  if (status === 'perdida') return 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]'
  if (status === 'cancelada' || status === 'substituida') return 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'
  return 'bg-[#FFF4E5] text-[#8A5700]'
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || 'Olá'
}
