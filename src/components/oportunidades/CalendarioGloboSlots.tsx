'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OportunidadePublicada } from '@/lib/dados/oportunidades'

type Modo = 'grade' | 'agenda'
const PALETA = [
  { cor: '#ff5a3c', gradiente: 'linear-gradient(150deg,#ff8a3c,#ff3d6e)' },
  { cor: '#7c3aed', gradiente: 'linear-gradient(150deg,#8b5cf6,#4f46e5)' },
  { cor: '#1e90ff', gradiente: 'linear-gradient(150deg,#22d3ee,#2563eb)' },
  { cor: '#f5a623', gradiente: 'linear-gradient(150deg,#fbbf24,#f97316)' },
  { cor: '#10b981', gradiente: 'linear-gradient(150deg,#34d399,#059669)' },
  { cor: '#ec4899', gradiente: 'linear-gradient(150deg,#f472b6,#db2777)' },
] as const
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

function temaPara(texto: string) {
  let soma = 0
  for (const char of texto) soma = (soma + char.charCodeAt(0)) % PALETA.length
  return PALETA[soma]
}
function slotVisual(livres: number) {
  if (livres <= 0) return { bg: '#eef0f2', fg: '#8a909a', borda: '#dfe2e7', texto: 'esgotado' }
  if (livres === 1) return { bg: '#ffe9e2', fg: '#c23a20', borda: '#ff5a3c', texto: '1 slot' }
  return { bg: '#fff', fg: '#14161a', borda: '#14161a', texto: `${livres} slots` }
}
function isoDoDia(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
function inicioDe(evento: OportunidadePublicada) {
  return evento.tipoExibicao === 'periodo' ? evento.dataInicio ?? evento.dataISO : evento.dataISO
}
function fimDe(evento: OportunidadePublicada) {
  return evento.tipoExibicao === 'periodo' ? evento.dataFim ?? evento.dataISO : evento.dataISO
}
function ocorreEm(evento: OportunidadePublicada, data: string) {
  return data >= inicioDe(evento) && data <= fimDe(evento)
}
function dataPtCurta(iso: string) {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${String(dia).padStart(2, '0')} ${MESES[mes - 1].slice(0, 3).toUpperCase()}`
}
function rotuloExibicao(evento: OportunidadePublicada) {
  return evento.tipoExibicao === 'periodo'
    ? `${dataPtCurta(inicioDe(evento))} – ${dataPtCurta(fimDe(evento))}`
    : dataPtCurta(evento.dataISO)
}

export function CalendarioGloboSlots({ oportunidades }: { oportunidades: OportunidadePublicada[] }) {
  const router = useRouter()
  const agora = new Date()
  const [modo, setModo] = useState<Modo>('grade')
  const [mesAtual, setMesAtual] = useState(new Date(agora.getFullYear(), agora.getMonth(), 1))
  const [diaSelecionado, setDiaSelecionado] = useState(agora.getDate())

  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const inicioMes = isoDoDia(ano, mes, 1)
  const fimMes = isoDoDia(ano, mes, totalDias)

  const eventosDoMes = oportunidades.filter((evento) => inicioDe(evento) <= fimMes && fimDe(evento) >= inicioMes)
  const dataSelecionada = isoDoDia(ano, mes, Math.min(diaSelecionado, totalDias))
  const agenda = eventosDoMes.filter((evento) => ocorreEm(evento, dataSelecionada))

  function trocarMes(delta: number) {
    setMesAtual(new Date(ano, mes + delta, 1))
    setDiaSelecionado(1)
  }

  const celulas = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: totalDias }, (_, indice) => indice + 1),
  ]

  return (
    <div className="relative mx-auto max-w-[1180px] px-5 pb-[70px] pt-[28px] sm:px-7">
      <div className="vitrine-pop pointer-events-none absolute right-[14px] top-0 hidden select-none text-[105px] font-extrabold leading-[.8] tracking-[-5px] text-[rgba(20,22,26,.03)] lg:block">{MESES[mes].toLocaleLowerCase('pt-BR')}</div>
      <div className="relative flex flex-wrap items-center gap-3.5">
        <div><p className="globo-slots-gradient-text text-[11px] font-semibold uppercase tracking-[1.7px]">Planejamento de oportunidades</p><h1 className="vitrine-pop mt-1 text-[30px] font-extrabold tracking-[-1px]">{MESES[mes]} {ano}</h1></div>
        <div className="ml-1 flex gap-1.5"><button type="button" onClick={() => trocarMes(-1)} className="vitrine-chip flex h-[34px] w-[34px] items-center justify-center p-0 text-[20px]">‹</button><button type="button" onClick={() => trocarMes(1)} className="vitrine-chip flex h-[34px] w-[34px] items-center justify-center p-0 text-[20px]">›</button></div>
        <div className="ml-auto flex gap-1 rounded-full bg-white p-1"><button type="button" onClick={() => setModo('grade')} className={`rounded-full px-4 py-2 text-[12px] font-bold ${modo === 'grade' ? 'bg-[#14161a] text-white' : 'text-[#6b7280]'}`}>Grade</button><button type="button" onClick={() => setModo('agenda')} className={`rounded-full px-4 py-2 text-[12px] font-bold ${modo === 'agenda' ? 'bg-[#14161a] text-white' : 'text-[#6b7280]'}`}>Agenda</button></div>
      </div>

      {modo === 'agenda' ? (
        <section className="relative mt-6 rounded-[20px] bg-white p-5 shadow-[0_6px_22px_-16px_rgba(20,22,26,.4)]">
          <div><h2 className="vitrine-pop text-[18px] font-bold">Agenda do mês</h2><p className="mt-1 text-[12px] font-semibold text-[#9aa0a8]">{eventosDoMes.length} oportunidades publicadas</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {eventosDoMes.length === 0 && <p className="col-span-full py-10 text-center text-[13px] text-[#9aa0a8]">Nenhuma oportunidade ativa neste mês.</p>}
            {[...eventosDoMes].sort((a, b) => inicioDe(a).localeCompare(inicioDe(b))).map((evento) => <AgendaItem key={evento.id} evento={evento} aoAbrir={() => router.push(`/oportunidades?evento=${evento.id}`)} />)}
          </div>
        </section>
      ) : (
        <div className="relative mt-6 grid items-start gap-[26px] lg:grid-cols-[1.55fr_1fr]">
          <section className="rounded-[20px] bg-white p-5 shadow-[0_6px_22px_-16px_rgba(20,22,26,.4)]">
            <div className="mb-2.5 grid grid-cols-7 gap-2">{DIAS.map((dia) => <div key={dia} className="text-center text-[11px] font-bold tracking-[1px] text-[#c1c5cc]">{dia}</div>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {celulas.map((dia, indice) => {
                if (dia === null) return <div key={`v-${indice}`} className="aspect-square" />
                const data = isoDoDia(ano, mes, dia)
                const doDia = eventosDoMes.filter((evento) => ocorreEm(evento, data))
                const selecionado = dia === diaSelecionado
                return <button type="button" key={dia} onClick={() => setDiaSelecionado(dia)} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] transition-transform active:scale-95" style={{ borderColor: selecionado ? '#14161a' : doDia.length ? '#eceef1' : '#f3f4f6', background: selecionado ? '#14161a' : '#fff' }}><span className="vitrine-pop text-[14px] font-bold" style={{ color: selecionado ? '#fff' : doDia.length ? '#14161a' : '#c1c5cc' }}>{dia}</span><span className="flex h-1.5 gap-[3px]">{doDia.slice(0, 3).map((evento) => <i key={evento.id} className="h-1.5 w-1.5 rounded-full" style={{ background: temaPara(evento.programaId).cor }} />)}</span></button>
              })}
            </div>
          </section>
          <aside><h2 className="vitrine-pop text-[18px] font-bold">{tituloDia(ano, mes, diaSelecionado)}</h2><p className="mt-0.5 text-[13px] font-semibold text-[#9aa0a8]">{agenda.length} {agenda.length === 1 ? 'oportunidade neste dia' : 'oportunidades neste dia'}</p><div className="mt-4 flex flex-col gap-3">{agenda.length === 0 && <div className="rounded-[16px] border border-dashed border-[#d7dae0] bg-white/55 px-5 py-8 text-center text-[12px] text-[#9aa0a8]">Selecione outro dia para ver as oportunidades.</div>}{agenda.map((evento) => <AgendaItem key={evento.id} evento={evento} aoAbrir={() => router.push(`/oportunidades?evento=${evento.id}`)} />)}</div></aside>
        </div>
      )}
    </div>
  )
}

function AgendaItem({ evento, aoAbrir }: { evento: OportunidadePublicada; aoAbrir: () => void }) {
  const tema = temaPara(evento.programaId)
  const slot = slotVisual(evento.slotsLivres)
  return <button type="button" onClick={aoAbrir} className="vitrine-card flex items-center gap-3 rounded-[16px] bg-white p-[11px] text-left shadow-[0_5px_18px_-14px_rgba(20,22,26,.4)]"><span className="h-[58px] w-[58px] shrink-0 rounded-[12px] bg-cover bg-center" style={{ background: evento.imagem ? undefined : tema.gradiente, backgroundImage: evento.imagem ? `url(${evento.imagem})` : undefined }} /><span className="min-w-0 flex-1"><span className="vitrine-pop block text-[14px] font-bold leading-[1.2]">{evento.titulo}</span><span className="mt-1 block text-[12px] font-semibold text-[#9aa0a8]">{rotuloExibicao(evento)} · {evento.programaNome} · {evento.formatoNome}</span></span>{evento.inventarioAplicavel ? <span className="vitrine-pop rounded-[9px] border-[1.5px] px-[9px] py-[5px] text-[10.5px] font-bold" style={{ background: slot.bg, color: slot.fg, borderColor: slot.borda }}>{slot.texto}</span> : <span className="vitrine-pop rounded-[9px] border border-[#d7dae0] bg-[#f7f8fa] px-[9px] py-[5px] text-[10.5px] font-bold text-[#5a606a]">período</span>}</button>
}
function tituloDia(ano: number, mes: number, dia: number) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ano, mes, dia)).replace('.', '')
}
