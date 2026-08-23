import Link from 'next/link'
import { carregarPerformanceInicio, type ItemAtencaoPerformance, type MetricasPerformance, type PropostaRecente } from '@/lib/dados/performance'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'
import type { StatusNegociacao } from '@/lib/dados/propostas'
import { GraficoEvolucaoComercial } from '@/components/inicio/GraficoEvolucaoComercial'
import { PerformanceProgramas } from '@/components/inicio/PerformanceProgramas'

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

export default async function PaginaDesempenho() {
  const [sessao, performance] = await Promise.all([obterSessao(), carregarPerformanceInicio()])
  if (!sessao) return null

  const podeConsultar = temPerfil(sessao.perfis, 'executivo')
    || temPerfil(sessao.perfis, 'executivo_regional')
    || temPerfil(sessao.perfis, 'proprietario')

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="globo-slots-gradient-text text-[11px] font-bold uppercase tracking-[.12em]">Desempenho comercial</p>
          <h1 className="vitrine-pop mt-1 text-[30px] font-extrabold tracking-[-.8px] text-[#14161a]">Olá, {primeiroNome(sessao.nome)}.</h1>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            {performance.programas
              ? 'Acompanhe a demanda dos programas sob sua responsabilidade e o andamento comercial das propostas.'
              : 'Acompanhe suas propostas e continue suas negociações a partir daqui.'}
          </p>
        </div>
        {podeConsultar && <Link href="/consulta" className="vitrine-pop rounded-full bg-[#14161a] px-5 py-3 text-[12.5px] font-bold text-white">+ Nova consulta</Link>}
      </header>

      {!performance.schemaDisponivel && (
        <section className="rounded-[16px] border border-[#F1D3A6] bg-[#FFF8EC] p-4">
          <p className="text-[12.5px] font-bold text-[#8A5700]">Acompanhamento comercial ainda não habilitado</p>
          <p className="mt-1 text-[11.5px] text-[#5a606a]">Execute <strong>supabase/schema-entrega-5-filtro-ranking-programas.sql</strong> no Supabase para liberar o ranking de executivos.</p>
        </section>
      )}

      {performance.executivo && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="globo-slots-gradient-text text-[10.5px] font-bold uppercase tracking-[.07em]">Minha atividade</p><h2 className="vitrine-pop mt-1 text-[20px] font-bold text-[#14161a]">Meu mês comercial</h2></div>
            <Link href="/propostas" className="text-[11.5px] font-bold text-[#14161a]">Ver todas as minhas propostas →</Link>
          </div>
          <GradeMetricas metricas={performance.executivo.metricasMes} modo="executivo" />
          <BlocoAtencao itens={performance.executivo.atencoes} titulo="Atenção necessária" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)] xl:items-start">
            <GraficoEvolucaoComercial titulo="Evolução da minha performance" subtitulo="Ofertado x Vendido pela data de criação da proposta." pontos={performance.executivo.evolucao12Meses} />
            <Funil metricas={performance.executivo.metricasMes} />
          </div>
          <ListaRecentes titulo="Minhas propostas recentes" propostas={performance.executivo.recentes} />
        </section>
      )}

      {performance.programas && <PerformanceProgramas dados={performance.programas} />}
    </div>
  )
}

function GradeMetricas({ metricas, modo }: { metricas: MetricasPerformance; modo: 'executivo' | 'programa' }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metrica rotulo="Propostas no mês" valor={String(metricas.propostas)} apoio={`${metricas.emNegociacao} em negociação`} /><Metrica rotulo="Valor comercial proposto" valor={moeda(metricas.valorProposto)} apoio={`${metricas.clientes} anunciantes`} /><Metrica rotulo="Valor fechado" valor={moeda(metricas.valorFechado)} apoio={`${metricas.fechadas} fechada${metricas.fechadas === 1 ? '' : 's'}`} /><Metrica rotulo="Taxa de conversão" valor={metricas.conversao === null ? '—' : `${metricas.conversao}%`} apoio={metricas.conversao === null ? 'Aguardando negociações decididas' : 'Fechadas ÷ fechadas + perdidas'} destaque={modo === 'executivo'} /></div>
}

function Metrica({ rotulo, valor, apoio, destaque = false }: { rotulo: string; valor: string; apoio: string; destaque?: boolean }) {
  return <div className={`rounded-[18px] border p-4 ${destaque ? 'border-[#ffd8ce] bg-[#fff9f7]' : 'border-[#e6e8ec] bg-white'}`}><p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#9aa0a8]">{rotulo}</p><p className={`vitrine-pop mt-2 text-[22px] font-bold ${destaque ? 'text-[#ff5a3c]' : 'text-[#14161a]'}`}>{valor}</p><p className="mt-1 text-[10.5px] text-[#9aa0a8]">{apoio}</p></div>
}

export function BlocoAtencao({ itens, titulo }: { itens: ItemAtencaoPerformance[]; titulo: string }) {
  return <section className="rounded-[18px] border border-[#e6e8ec] bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="vitrine-pop text-[13px] font-bold text-[#14161a]">{titulo}</h3><Link href="/propostas" className="text-[10px] font-bold text-[#14161a]">Revisar propostas →</Link></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{itens.slice(0, 4).map((item, indice) => <div key={`${item.titulo}-${indice}`} className={`rounded-[12px] border px-3 py-2.5 ${item.tipo === 'alerta' ? 'border-[#F1D3A6] bg-[#FFF8EC]' : item.tipo === 'sucesso' ? 'border-[#CDEBDD] bg-[#F1FBF6]' : 'border-[#eceef1] bg-[#f8f9fa]'}`}><p className={`text-[10.5px] font-bold ${item.tipo === 'alerta' ? 'text-[#8A5700]' : item.tipo === 'sucesso' ? 'text-[#166534]' : 'text-[#14161a]'}`}>{item.titulo}</p><p className="mt-0.5 text-[9.8px] leading-[1.45] text-[#9aa0a8]">{item.detalhe}</p></div>)}</div></section>
}

function ListaRecentes({ titulo, propostas }: { titulo: string; propostas: PropostaRecente[] }) {
  return <section className="rounded-[18px] border border-[#e6e8ec] bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="vitrine-pop text-[14px] font-bold text-[#14161a]">{titulo}</h3><Link href="/propostas" className="text-[10.5px] font-bold text-[#14161a]">Abrir propostas →</Link></div><div className="mt-3 divide-y divide-[#eceef1]">{propostas.length === 0 ? <Vazio texto="Nenhuma proposta disponível ainda." /> : propostas.map((proposta) => <div key={proposta.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[12.5px] font-bold text-[#14161a]">{proposta.marca} · {proposta.programa}</p><span className="rounded-full bg-[#f5f6f7] px-2 py-0.5 text-[9px] font-bold text-[#9aa0a8]">v{proposta.versao}</span></div><p className="mt-0.5 text-[10.5px] text-[#9aa0a8]">{proposta.cliente} · {dataCurta(proposta.criadoEm)}</p></div><p className="text-[11.5px] font-bold text-[#14161a] sm:text-right">{moeda(proposta.valor)}</p><span className={`justify-self-start rounded-full px-2.5 py-1 text-[9.5px] font-bold sm:justify-self-end ${classeStatus(proposta.status)}`}>{STATUS[proposta.status]}</span></div>)}</div></section>
}

function Funil({ metricas }: { metricas: MetricasPerformance }) {
  return <section className="rounded-[18px] border border-[#e6e8ec] bg-white p-4"><h3 className="vitrine-pop text-[13px] font-bold text-[#14161a]">Andamento comercial</h3><div className="mt-3 grid gap-2"><LinhaFunil rotulo="Em negociação" valor={metricas.emNegociacao} total={metricas.propostas} /><LinhaFunil rotulo="Fechadas" valor={metricas.fechadas} total={metricas.propostas} /><LinhaFunil rotulo="Perdidas" valor={metricas.perdidas} total={metricas.propostas} /><LinhaFunil rotulo="Canceladas" valor={metricas.canceladas} total={metricas.propostas} /></div></section>
}

function LinhaFunil({ rotulo, valor, total }: { rotulo: string; valor: number; total: number }) {
  const percentual = total > 0 ? Math.round((valor / total) * 100) : 0
  return <div><div className="flex items-center justify-between gap-3 text-[10px]"><span className="font-semibold text-[#5a606a]">{rotulo}</span><strong className="text-[#14161a]">{valor} · {percentual}%</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f3f4f6]"><div className="h-full rounded-full bg-[#14161a]" style={{ width: `${percentual}%`, opacity: .72 }} /></div></div>
}

function Vazio({ texto }: { texto: string }) { return <p className="py-5 text-center text-[11.5px] text-[#9aa0a8]">{texto}</p> }
function classeStatus(status: StatusNegociacao): string { if (status === 'fechada') return 'bg-[#EAF7EF] text-[#166534]'; if (status === 'perdida') return 'bg-[#FDECEF] text-[#BE123C]'; if (status === 'cancelada' || status === 'substituida') return 'bg-[#f5f6f7] text-[#9aa0a8]'; return 'bg-[#FFF4E5] text-[#8A5700]' }
function primeiroNome(nome: string): string { return nome.trim().split(/\s+/)[0] || 'Olá' }
