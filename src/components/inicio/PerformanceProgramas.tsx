'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { GraficoEvolucaoComercial } from './GraficoEvolucaoComercial'
import type {
  ItemRankingExecutivo,
  MetricasPerformance,
  PerformanceInicio,
  PropostaRecente,
} from '@/lib/dados/performance'
import type { StatusNegociacao } from '@/lib/dados/propostas'

type DadosProgramas = NonNullable<PerformanceInicio['programas']>

type VisaoSelecionada = {
  programaId: string
  programaNome: string
  metricasMes: MetricasPerformance
  evolucao12Meses: DadosProgramas['evolucao12Meses']
  ranking: ItemRankingExecutivo[]
  recentes: PropostaRecente[]
}

type CriterioRanking = 'quantidade' | 'vendido'

const TODOS = '__todos__'

const STATUS: Record<StatusNegociacao, string> = {
  em_negociacao: 'Em negociação',
  fechada: 'Fechada',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
  substituida: 'Substituída',
}

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)
}

function dataCurta(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(valor))
}

export function PerformanceProgramas({ dados }: { dados: DadosProgramas }) {
  const [programaSelecionado, setProgramaSelecionado] = useState(TODOS)

  const visao = useMemo<VisaoSelecionada>(() => {
    if (programaSelecionado === TODOS) {
      return {
        programaId: TODOS,
        programaNome: 'Todos os programas',
        metricasMes: dados.metricasMes,
        evolucao12Meses: dados.evolucao12Meses,
        ranking: dados.ranking,
        recentes: dados.recentes,
      }
    }

    const programa = dados.porPrograma.find((item) => item.programaId === programaSelecionado)
    if (!programa) {
      return {
        programaId: TODOS,
        programaNome: 'Todos os programas',
        metricasMes: dados.metricasMes,
        evolucao12Meses: dados.evolucao12Meses,
        ranking: dados.ranking,
        recentes: dados.recentes,
      }
    }

    return programa
  }, [dados, programaSelecionado])

  const individual = visao.programaId !== TODOS

  return (
    <section className="flex flex-col gap-4 border-t border-[var(--borda)] pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--roxo)]">Meus programas</p>
          <h2 className="mt-1 text-[19px] font-bold text-[var(--texto)]">Performance dos programas</h2>
          <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">
            {individual
              ? `Visão individual de ${visao.programaNome} · somente a versão vigente de cada proposta.`
              : 'Visão consolidada dos programas sob sua responsabilidade · somente a versão vigente de cada proposta.'}
          </p>
        </div>

        <label className="grid min-w-[250px] gap-1">
          <span className="text-[9.5px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">Programa</span>
          <select
            value={programaSelecionado}
            onChange={(evento) => setProgramaSelecionado(evento.target.value)}
            className="h-10 rounded-[10px] border border-[var(--borda-forte)] bg-white px-3 text-[12px] font-semibold text-[var(--texto)] outline-none focus:border-[var(--roxo)]"
          >
            <option value={TODOS}>Todos os programas</option>
            {dados.porPrograma.map((programa) => (
              <option key={programa.programaId} value={programa.programaId}>{programa.programaNome}</option>
            ))}
          </select>
        </label>
      </div>

      <GradeMetricas metricas={visao.metricasMes} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(300px,.72fr)] xl:items-start">
        <GraficoEvolucaoComercial
          titulo={individual ? `Evolução · ${visao.programaNome}` : 'Evolução comercial dos programas'}
          subtitulo="Ofertado x Vendido pela data de criação da proposta."
          pontos={visao.evolucao12Meses}
        />
        <RankingExecutivos ranking={visao.ranking} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Funil metricas={visao.metricasMes} />
        <Composicao metricas={visao.metricasMes} />
      </div>

      {!individual && <ProgramasPorValor programas={dados.porPrograma} />}

      <ListaRecentes
        titulo={individual ? `Propostas recentes · ${visao.programaNome}` : 'Propostas recentes dos programas'}
        propostas={visao.recentes}
      />
    </section>
  )
}

function GradeMetricas({ metricas }: { metricas: MetricasPerformance }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metrica rotulo="Propostas no mês" valor={String(metricas.propostas)} apoio={`${metricas.emNegociacao} em negociação`} />
      <Metrica rotulo="Valor comercial proposto" valor={moeda(metricas.valorProposto)} apoio={`${metricas.clientes} anunciantes`} />
      <Metrica rotulo="Valor fechado" valor={moeda(metricas.valorFechado)} apoio={`${metricas.fechadas} fechada${metricas.fechadas === 1 ? '' : 's'}`} />
      <Metrica rotulo="Taxa de conversão" valor={metricas.conversao === null ? '—' : `${metricas.conversao}%`} apoio={metricas.conversao === null ? 'Aguardando negociações decididas' : 'Fechadas ÷ fechadas + perdidas'} />
    </div>
  )
}

function Metrica({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio: string }) {
  return (
    <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">{rotulo}</p>
      <p className="mt-2 text-[22px] font-bold text-[var(--texto)]">{valor}</p>
      <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">{apoio}</p>
    </div>
  )
}

function RankingExecutivos({ ranking }: { ranking: ItemRankingExecutivo[] }) {
  const [criterio, setCriterio] = useState<CriterioRanking>('quantidade')

  const ordenados = useMemo(() => [...ranking].sort((a, b) => {
    if (criterio === 'quantidade') {
      const quantidade = b.metricas.propostas - a.metricas.propostas
      if (quantidade !== 0) return quantidade
      const ofertado = b.metricas.valorProposto - a.metricas.valorProposto
      if (ofertado !== 0) return ofertado
      const vendido = b.metricas.valorFechado - a.metricas.valorFechado
      if (vendido !== 0) return vendido
      return a.nome.localeCompare(b.nome, 'pt-BR')
    }

    const vendido = b.metricas.valorFechado - a.metricas.valorFechado
    if (vendido !== 0) return vendido
    const ofertado = b.metricas.valorProposto - a.metricas.valorProposto
    if (ofertado !== 0) return ofertado
    const quantidade = b.metricas.propostas - a.metricas.propostas
    if (quantidade !== 0) return quantidade
    return a.nome.localeCompare(b.nome, 'pt-BR')
  }).slice(0, 5), [ranking, criterio])

  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--texto)]">Ranking de executivos</h3>
          <p className="mt-0.5 text-[9.5px] text-[var(--texto-3)]">
            {criterio === 'quantidade'
              ? 'Mês atual · maiores usuários por propostas geradas'
              : 'Mês atual · maior valor vendido'}
          </p>
        </div>

        <div className="inline-flex rounded-[8px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-0.5" aria-label="Critério do ranking">
          <button
            type="button"
            onClick={() => setCriterio('quantidade')}
            aria-pressed={criterio === 'quantidade'}
            className={`rounded-[6px] px-2 py-1 text-[9px] font-bold transition ${criterio === 'quantidade' ? 'bg-white text-[var(--roxo)] shadow-sm' : 'text-[var(--texto-3)] hover:text-[var(--texto-2)]'}`}
          >
            Mais propostas
          </button>
          <button
            type="button"
            onClick={() => setCriterio('vendido')}
            aria-pressed={criterio === 'vendido'}
            className={`rounded-[6px] px-2 py-1 text-[9px] font-bold transition ${criterio === 'vendido' ? 'bg-white text-[var(--roxo)] shadow-sm' : 'text-[var(--texto-3)] hover:text-[var(--texto-2)]'}`}
          >
            Mais vendido
          </button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-[var(--borda)]">
        {ordenados.length === 0 ? (
          <Vazio texto="Ainda não há propostas neste recorte." />
        ) : ordenados.map((item, indice) => (
          <div key={item.usuarioId} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9.5px] font-bold ${indice === 0 ? 'bg-[#F3E8FF] text-[var(--roxo)]' : 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'}`}>
              {indice + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-[var(--texto)]">{item.nome}</p>
              <p className="mt-0.5 text-[9.5px] text-[var(--texto-3)]">
                {criterio === 'quantidade'
                  ? `Ofertado ${moeda(item.metricas.valorProposto)} · vendido ${moeda(item.metricas.valorFechado)}`
                  : `${item.metricas.propostas} proposta${item.metricas.propostas === 1 ? '' : 's'} · ofertado ${moeda(item.metricas.valorProposto)}`}
              </p>
            </div>
            <div className="text-right">
              {criterio === 'quantidade' ? (
                <>
                  <p className="text-[9px] uppercase text-[var(--texto-3)]">Propostas</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--texto)]">{item.metricas.propostas}</p>
                  <p className="mt-0.5 text-[9px] font-semibold text-[var(--roxo)]">{item.metricas.conversao === null ? '—' : `${item.metricas.conversao}% conv.`}</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] uppercase text-[var(--texto-3)]">Vendido</p>
                  <p className="mt-0.5 text-[11px] font-bold text-[var(--texto)]">{moeda(item.metricas.valorFechado)}</p>
                  <p className="mt-0.5 text-[9px] font-semibold text-[var(--roxo)]">{item.metricas.conversao === null ? '—' : `${item.metricas.conversao}% conv.`}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Funil({ metricas }: { metricas: MetricasPerformance }) {
  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
      <h3 className="text-[13px] font-bold text-[var(--texto)]">Andamento comercial</h3>
      <div className="mt-3 grid gap-2">
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
      <div className="flex items-center justify-between gap-3 text-[10px]">
        <span className="font-semibold text-[var(--texto-2)]">{rotulo}</span>
        <strong className="text-[var(--texto)]">{valor} · {percentual}%</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--superficie-suave)]">
        <div className="h-full rounded-full bg-[var(--roxo)]" style={{ width: `${percentual}%`, opacity: 0.66 }} />
      </div>
    </div>
  )
}

function Composicao({ metricas }: { metricas: MetricasPerformance }) {
  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
      <h3 className="text-[13px] font-bold text-[var(--texto)]">Composição das propostas</h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <MiniMetrica rotulo="Com Digital" valor={`${metricas.percentualDigital}%`} />
        <MiniMetrica rotulo="Com Redes" valor={`${metricas.percentualRedes}%`} />
        <MiniMetrica rotulo="Nacionais" valor={String(metricas.nacionais)} />
        <MiniMetrica rotulo="Regionais" valor={String(metricas.regionais)} />
      </div>
    </section>
  )
}

function MiniMetrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-[9px] bg-[var(--superficie-suave)] p-2.5"><p className="text-[9px] font-bold uppercase text-[var(--texto-3)]">{rotulo}</p><p className="mt-1 text-[15px] font-bold text-[var(--texto)]">{valor}</p></div>
}

function ProgramasPorValor({ programas }: { programas: DadosProgramas['porPrograma'] }) {
  const ordenados = [...programas]
    .filter((programa) => programa.metricasMes.propostas > 0)
    .sort((a, b) => b.metricasMes.valorProposto - a.metricasMes.valorProposto)
    .slice(0, 8)

  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-bold text-[var(--texto)]">Programas por valor proposto</h3>
        <span className="text-[10.5px] text-[var(--texto-3)]">Mês atual</span>
      </div>
      <div className="mt-4 divide-y divide-[var(--borda)]">
        {ordenados.length === 0 ? (
          <Vazio texto="Ainda não há propostas dos seus programas neste mês." />
        ) : ordenados.map((programa) => (
          <div key={programa.programaId} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px_90px] sm:items-center">
            <div>
              <p className="text-[12.5px] font-bold text-[var(--texto)]">{programa.programaNome}</p>
              <p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">{programa.metricasMes.propostas} proposta{programa.metricasMes.propostas === 1 ? '' : 's'} · {programa.metricasMes.clientes} anunciante{programa.metricasMes.clientes === 1 ? '' : 's'}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase text-[var(--texto-3)]">Proposto</p>
              <p className="mt-0.5 text-[12px] font-bold text-[var(--texto)]">{moeda(programa.metricasMes.valorProposto)}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase text-[var(--texto-3)]">Conversão</p>
              <p className="mt-0.5 text-[12px] font-bold text-[var(--roxo)]">{programa.metricasMes.conversao === null ? '—' : `${programa.metricasMes.conversao}%`}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
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

function Vazio({ texto }: { texto: string }) {
  return <p className="py-4 text-center text-[10.5px] text-[var(--texto-3)]">{texto}</p>
}

function classeStatus(status: StatusNegociacao): string {
  if (status === 'fechada') return 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]'
  if (status === 'perdida') return 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]'
  if (status === 'cancelada' || status === 'substituida') return 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'
  return 'bg-[#FFF4E5] text-[#8A5700]'
}