'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decidirAprovacao } from '@/lib/acoes/aprovacoes'
import type { PropostaParaAprovacao } from '@/lib/dados/aprovacoes'
import { deveExibirClienteComMarca, nomePrincipalDaProposta } from '@/lib/dominio/exibicao-marca-cliente'

type Filtro = 'pendentes' | 'decididas' | 'todas'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}
function dataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}
function dataCurta(valor: string): string {
  const [ano, mes, dia] = valor.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function PainelDeAprovacoes({ propostas }: { propostas: PropostaParaAprovacao[] }) {
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [programa, setPrograma] = useState('todos')
  const programas = useMemo(() => [...new Set(propostas.map((p) => p.programa_nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [propostas])
  const visiveis = propostas.filter((p) => {
    if (programa !== 'todos' && p.programa_nome !== programa) return false
    if (filtro === 'pendentes') return p.aprovacao_status === 'pendente'
    if (filtro === 'decididas') return p.aprovacao_status === 'aprovada' || p.aprovacao_status === 'rejeitada'
    return true
  })
  const pendentes = propostas.filter((p) => p.aprovacao_status === 'pendente').length

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <Indicador rotulo="Pendentes" valor={String(pendentes)} destaque />
        <Indicador rotulo="Aprovadas" valor={String(propostas.filter((p) => p.aprovacao_status === 'aprovada').length)} />
        <Indicador rotulo="Rejeitadas" valor={String(propostas.filter((p) => p.aprovacao_status === 'rejeitada').length)} />
      </section>

      <section className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {([['pendentes', 'Pendentes'], ['decididas', 'Decididas'], ['todas', 'Todas']] as [Filtro, string][]).map(([valor, rotulo]) => (
            <button key={valor} type="button" onClick={() => setFiltro(valor)} className={`rounded-full px-3.5 py-2 text-[11px] font-bold ${filtro === valor ? 'bg-[#F3E8FF] text-[var(--roxo)]' : 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'}`}>{rotulo}</button>
          ))}
        </div>
        <label className="grid min-w-[220px] gap-1">
          <span className="text-[9px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">Programa</span>
          <select value={programa} onChange={(e) => setPrograma(e.target.value)} className="h-10 rounded-[10px] border border-[var(--borda-forte)] bg-white px-3 text-[11.5px] font-semibold outline-none focus:border-[var(--roxo)]">
            <option value="todos">Todos os programas</option>
            {programas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </section>

      {visiveis.length === 0 ? (
        <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-white p-10 text-center">
          <p className="text-[14px] font-bold text-[var(--texto)]">Nenhuma proposta neste recorte</p>
          <p className="mt-1 text-[12px] text-[var(--texto-3)]">Quando um programa com fluxo de aprovação receber uma proposta, ela aparecerá aqui.</p>
        </div>
      ) : visiveis.map((p) => <CardAprovacao key={p.id} proposta={p} />)}
    </div>
  )
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-[var(--raio-card)] border p-4 ${destaque ? 'border-[#E9D5FF] bg-[#FAF5FF]' : 'border-[var(--borda)] bg-white'}`}><p className="text-[9.5px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">{rotulo}</p><p className={`mt-1 text-[24px] font-extrabold ${destaque ? 'text-[var(--roxo)]' : 'text-[var(--texto)]'}`}>{valor}</p></div>
}

function CardAprovacao({ proposta: p }: { proposta: PropostaParaAprovacao }) {
  const router = useRouter()
  const [modoRejeicao, setModoRejeicao] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [processando, iniciar] = useTransition()
  const pendente = p.aprovacao_status === 'pendente'
  const marca = nomePrincipalDaProposta(p.marca_nome, p.cliente_nome)
  const exibirCliente = deveExibirClienteComMarca(p.marca_nome, p.cliente_nome)

  function decidir(decisao: 'aprovar' | 'rejeitar') {
    if (decisao === 'rejeitar' && !justificativa.trim()) return setErro('Informe a justificativa antes de rejeitar.')
    setErro(null); setMensagem(null)
    iniciar(async () => {
      const retorno = await decidirAprovacao({ propostaId: p.id, decisao, justificativa })
      if (retorno.erro) return setErro(retorno.erro)
      setMensagem(retorno.status === 'aprovada' ? 'Proposta aprovada. O PDF foi liberado ao executivo.' : 'Proposta rejeitada. O executivo recebeu a justificativa.')
      if (retorno.emailErro) setMensagem((atual) => `${atual} ${retorno.emailErro}`)
      router.refresh()
    })
  }

  return (
    <article className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold ${p.aprovacao_status === 'pendente' ? 'bg-[#FFF4E5] text-[#8A5700]' : p.aprovacao_status === 'aprovada' ? 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]' : 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]'}`}>{p.aprovacao_status === 'pendente' ? 'Pendente' : p.aprovacao_status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}</span>
            <span className="text-[10px] font-bold uppercase tracking-[.06em] text-[var(--roxo)]">{p.programa_nome}</span>
          </div>
          <h2 className="mt-2 text-[17px] font-bold text-[var(--texto)]">{marca}</h2>
          <p className="mt-1 text-[11px] text-[var(--texto-3)]">{exibirCliente && <>{p.cliente_nome} · </>}{p.modalidade === 'regional' ? 'Regional' : 'Nacional'} · enviada por <strong>{p.executivo_nome ?? 'Executivo'}</strong> em {dataHora(p.criado_em)}</p>
        </div>
        <div className="text-right"><p className="text-[9.5px] uppercase text-[var(--texto-3)]">Total comercial</p><p className="mt-1 text-[19px] font-extrabold text-[var(--texto)]">{moeda(p.valor_total_comercial)}</p></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
        <div className="rounded-[10px] bg-[var(--superficie-suave)] p-4"><p className="text-[9.5px] font-bold uppercase text-[var(--texto-3)]">Produto</p><p className="mt-1 text-[12.5px] font-semibold">{p.produto}</p><p className="mt-4 text-[9.5px] font-bold uppercase text-[var(--texto-3)]">Objetivo</p><p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--texto-2)]">{p.objetivo}</p></div>
        <div className="rounded-[10px] bg-[var(--superficie-suave)] p-4"><p className="text-[9.5px] font-bold uppercase text-[var(--texto-3)]">Exibição</p><div className="mt-2 flex flex-wrap gap-1.5">{p.itens.map((item) => <span key={item.data} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--texto-2)]">{dataCurta(item.data)}{item.pracas.length ? ` · ${item.pracas.join('/')}` : ''}</span>)}</div>{p.aprovacao_justificativa && <><p className="mt-4 text-[9.5px] font-bold uppercase text-[var(--concorrencia-texto)]">Justificativa</p><p className="mt-1 text-[11.5px] leading-[1.5]">{p.aprovacao_justificativa}</p></>}</div>
        <div className="flex flex-col gap-2">{p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center rounded-[10px] border border-[var(--borda-forte)] bg-white text-[11px] font-bold text-[var(--roxo)]">Visualizar PDF</a>}{p.aprovacao_solicitada_em && <p className="text-[9.5px] text-[var(--texto-3)]">Solicitada em {dataHora(p.aprovacao_solicitada_em)}</p>}</div>
      </div>

      {pendente && (
        <div className="mt-5 border-t border-[var(--borda)] pt-4">
          {!modoRejeicao ? (
            <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={processando} onClick={() => setModoRejeicao(true)} className="rounded-[10px] border border-[#F3B7C9] bg-white px-5 py-2.5 text-[12px] font-bold text-[#B42355] disabled:opacity-50">Rejeitar</button><button type="button" disabled={processando} onClick={() => decidir('aprovar')} className="rounded-[10px] px-5 py-2.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: 'var(--marca)' }}>{processando ? 'Processando…' : 'Aprovar proposta'}</button></div>
          ) : (
            <div className="ml-auto max-w-[620px] rounded-[12px] border border-[#F3B7C9] bg-[#FFF8FA] p-4"><label className="grid gap-1.5"><span className="text-[11.5px] font-bold text-[var(--texto)]">Justificativa da rejeição</span><textarea value={justificativa} onChange={(e) => { setJustificativa(e.target.value); setErro(null) }} rows={3} maxLength={600} placeholder="Explique objetivamente o que precisa ser ajustado para a próxima versão." className="resize-y rounded-[9px] border border-[#E8B7C6] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#D12C62]" /></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setModoRejeicao(false)} className="px-3 py-2 text-[11px] font-bold text-[var(--texto-3)]">Cancelar</button><button type="button" disabled={processando || !justificativa.trim()} onClick={() => decidir('rejeitar')} className="rounded-[9px] bg-[#C6255B] px-4 py-2 text-[11px] font-bold text-white disabled:opacity-45">{processando ? 'Processando…' : 'Confirmar rejeição'}</button></div></div>
          )}
        </div>
      )}

      {erro && <p role="alert" className="mt-3 text-[11px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}
      {mensagem && <p className="mt-3 text-[11px] font-semibold text-[var(--disponivel-texto)]">{mensagem}</p>}
    </article>
  )
}
