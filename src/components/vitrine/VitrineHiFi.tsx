'use client'

import Link from 'next/link'
import { useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

type ProgramaDoApp = { id: string; nome: string }
type Props = { nomeUsuario: string; podePostar: boolean; programas: ProgramaDoApp[] }
type View = 'vitrine' | 'detail' | 'calendar' | 'post'
type Filtro = 'todas' | 'datas' | 'talentos' | 'sazonais'
type CalMode = 'grid' | 'agenda'

type ProgramaVisual = {
  id: string
  nome: string
  cor: string
  gradiente: string
}

type Oportunidade = {
  id: string
  programaId: string
  programaNome: string
  cor: string
  gradiente: string
  dataISO: string
  titulo: string
  likesBase: number
  slotsLivres: number
  slotsTotal: number
  tag: string
  autor: string
  imagem?: string | null
  minha?: boolean
}

const PALETA = [
  { cor: '#ff5a3c', gradiente: 'linear-gradient(150deg,#ff8a3c,#ff3d6e)' },
  { cor: '#7c3aed', gradiente: 'linear-gradient(150deg,#8b5cf6,#4f46e5)' },
  { cor: '#1e90ff', gradiente: 'linear-gradient(150deg,#22d3ee,#2563eb)' },
  { cor: '#f5a623', gradiente: 'linear-gradient(150deg,#fbbf24,#f97316)' },
  { cor: '#10b981', gradiente: 'linear-gradient(150deg,#34d399,#059669)' },
  { cor: '#ec4899', gradiente: 'linear-gradient(150deg,#f472b6,#db2777)' },
] as const

const PROGRAMAS_DEMO: ProgramaVisual[] = [
  { id: 'novelas', nome: 'Novelas', ...PALETA[0] },
  { id: 'big-brother', nome: 'Big Brother', ...PALETA[1] },
  { id: 'sportv', nome: 'SporTV', ...PALETA[2] },
  { id: 'domingao', nome: 'Domingão', ...PALETA[3] },
  { id: 'estreias', nome: 'Estreias', ...PALETA[4] },
  { id: 'especiais', nome: 'Especiais', ...PALETA[5] },
]

const DEMO: Oportunidade[] = [
  oportunidade('0', 0, '2026-05-10', 'Ação especial Dia das Mães', 24, 3, 5, 'Sazonal'),
  oportunidade('1', 1, '2026-11-29', 'Esquenta Black Friday no BBB', 61, 1, 6, 'Comercial'),
  oportunidade('2', 2, '2026-06-04', 'Participação de talento no intervalo', 12, 0, 4, 'Talento'),
  oportunidade('3', 3, '2026-06-12', 'Dia dos Namorados no palco', 8, 7, 10, 'Sazonal'),
  oportunidade('4', 4, '2026-08-15', 'Estreia da nova temporada', 33, 2, 5, 'Lançamento'),
  oportunidade('5', 5, '2026-09-30', 'Especial de aniversário', 19, 4, 8, 'Institucional'),
  oportunidade('6', 0, '2026-05-10', 'Homenagem às mães na novela', 41, 2, 4, 'Sazonal'),
  oportunidade('7', 2, '2026-09-07', 'Cobertura especial de corrida', 27, 5, 8, 'Evento'),
]

function oportunidade(id: string, programa: number, dataISO: string, titulo: string, likes: number, livres: number, total: number, tag: string): Oportunidade {
  const p = PROGRAMAS_DEMO[programa]
  return { id, programaId: p.id, programaNome: p.nome, cor: p.cor, gradiente: p.gradiente, dataISO, titulo, likesBase: likes, slotsLivres: livres, slotsTotal: total, tag, autor: 'Marina Souza' }
}

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

function dataCurta(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  void ano
  return `${String(dia).padStart(2, '0')} ${MESES_CURTOS[mes - 1]}`
}

function estiloSlot(livres: number) {
  if (livres <= 0) return { bg: '#eef0f2', fg: '#8a909a', borda: '#dfe2e7', texto: 'esgotado' }
  if (livres === 1) return { bg: '#ffe9e2', fg: '#c23a20', borda: '#ff5a3c', texto: '1 slot' }
  return { bg: '#ffffff', fg: '#14161a', borda: '#14161a', texto: `${livres} slots` }
}

function programaVisual(programa: ProgramaDoApp, indice: number): ProgramaVisual {
  const tema = PALETA[indice % PALETA.length]
  return { id: programa.id, nome: programa.nome, ...tema }
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

export function VitrineHiFi({ nomeUsuario, podePostar, programas }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('vitrine')
  const [detailId, setDetailId] = useState('0')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({})
  const [calMode, setCalMode] = useState<CalMode>('grid')
  const [mes, setMes] = useState(new Date(2026, 4, 1))
  const [diaSelecionado, setDiaSelecionado] = useState(10)
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>(DEMO)

  const programasPost = useMemo<ProgramaVisual[]>(() => {
    return programas.length > 0 ? programas.map(programaVisual) : PROGRAMAS_DEMO
  }, [programas])

  const [post, setPost] = useState({
    programaId: programas[0]?.id ?? PROGRAMAS_DEMO[0].id,
    dataISO: '2026-05-10',
    slots: 5,
    titulo: 'Ação especial Dia das Mães',
    imagem: null as string | null,
  })

  const atual = oportunidades.find((o) => o.id === detailId) ?? oportunidades[0]
  const filtradas = useMemo(() => {
    const lista = oportunidades.filter((o) => {
      if (filtro === 'datas') return o.tag === 'Sazonal' || o.tag === 'Comercial'
      if (filtro === 'talentos') return o.tag === 'Talento'
      if (filtro === 'sazonais') return o.tag === 'Sazonal'
      return true
    })
    return [...lista].sort((a, b) => b.slotsLivres - a.slotsLivres)
  }, [filtro, oportunidades])

  const programaDoPost = programasPost.find((p) => p.id === post.programaId) ?? programasPost[0]

  function abrir(o: Oportunidade) {
    setDetailId(o.id)
    setView('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function alternarCurtida(id: string) {
    setCurtidas((atual) => ({ ...atual, [id]: !atual[id] }))
  }

  function lerImagem(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setPost((p) => ({ ...p, imagem: typeof leitor.result === 'string' ? leitor.result : null }))
    leitor.readAsDataURL(arquivo)
  }

  function publicar() {
    if (!programaDoPost || !post.dataISO || !post.titulo.trim() || post.slots < 1) return
    const nova: Oportunidade = {
      id: `local-${Date.now()}`,
      programaId: programaDoPost.id,
      programaNome: programaDoPost.nome,
      cor: programaDoPost.cor,
      gradiente: programaDoPost.gradiente,
      dataISO: post.dataISO,
      titulo: post.titulo.trim(),
      likesBase: 0,
      slotsLivres: post.slots,
      slotsTotal: post.slots,
      tag: 'Sazonal',
      autor: nomeUsuario,
      imagem: post.imagem,
      minha: true,
    }
    setOportunidades((atuais) => [nova, ...atuais])
    setDetailId(nova.id)
    setView('vitrine')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#eceef1] text-[#14161a]" style={{ fontFamily: 'var(--fonte-corpo), system-ui, sans-serif' }}>
      <Topo
        view={view}
        nomeUsuario={nomeUsuario}
        podePostar={podePostar}
        aoVitrine={() => setView('vitrine')}
        aoCalendario={() => setView('calendar')}
        aoPostar={() => setView('post')}
      />

      {view === 'vitrine' && (
        <main className="relative mx-auto max-w-[1180px] px-5 pb-[70px] pt-[34px] sm:px-7">
          <div className="pointer-events-none absolute right-[14px] top-[6px] hidden select-none text-[150px] font-extrabold leading-[.8] tracking-[-6px] text-[rgba(20,22,26,.035)] lg:block vitrine-pop">2026</div>
          <section className="relative">
            <p className="text-[13px] font-semibold uppercase tracking-[2px] text-[#ff5a3c]">Oportunidades de ação</p>
            <h1 className="vitrine-pop mt-2 text-[38px] font-extrabold leading-[1.02] tracking-[-1.5px] sm:text-[44px]">A vitrine dos<br />programas do chat</h1>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.5] text-[#6b7280]">Consultores postam ações comemorativas, sazonais e participações de talentos. Curta, veja os slots livres e gere sua consulta.</p>
          </section>

          <div className="relative my-[22px] mt-7 flex flex-wrap items-center gap-[9px]">
            <Chip ativo={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas</Chip>
            <Chip ativo={filtro === 'datas'} onClick={() => setFiltro('datas')}>Datas comem.</Chip>
            <Chip ativo={filtro === 'talentos'} onClick={() => setFiltro('talentos')}>Talentos</Chip>
            <Chip ativo={filtro === 'sazonais'} onClick={() => setFiltro('sazonais')}>Sazonais</Chip>
            <span className="ml-auto text-[13px] font-semibold text-[#6b7280]">ordenar: mais slots ▾</span>
          </div>

          <div className="relative grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtradas.map((o) => <Card key={o.id} oportunidade={o} curtida={Boolean(curtidas[o.id])} aoAbrir={() => abrir(o)} aoCurtir={() => alternarCurtida(o.id)} />)}
          </div>
        </main>
      )}

      {view === 'detail' && atual && (
        <main className="mx-auto max-w-[920px] px-5 pb-[70px] pt-[22px] sm:px-7">
          <button type="button" onClick={() => setView('vitrine')} className="mb-[18px] inline-flex cursor-pointer items-center gap-2 text-[14px] font-semibold text-[#6b7280] transition-transform active:scale-95">← Voltar à vitrine</button>
          <div className="grid items-start gap-[34px] md:grid-cols-[.9fr_1.1fr]">
            <ImagemOportunidade oportunidade={atual} grande />
            <div className="pt-[6px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vitrine-pop rounded-full px-[11px] py-[5px] text-[12px] font-bold text-white" style={{ background: atual.cor }}>{atual.programaNome}</span>
                <Chip estatico>{atual.tag}</Chip>
              </div>
              <h1 className="vitrine-pop mt-4 text-[34px] font-extrabold leading-[1.05] tracking-[-1px]">{atual.titulo}</h1>
              <p className="mt-[14px] text-[15.5px] leading-[1.6] text-[#5a606a]">Ação de mídia alinhada à oportunidade do programa. Insira o cliente na narrativa com material exclusivo — merchandising, chamada e presença de talento conforme disponibilidade de slots.</p>

              <div className="my-[22px] flex flex-wrap items-center gap-[22px] rounded-2xl bg-white px-5 py-[18px] shadow-[0_6px_20px_-14px_rgba(20,22,26,.4)]">
                <Stat valor={String(atual.slotsLivres)} rotulo="slots livres" cor={atual.cor} />
                <span className="h-[38px] w-px bg-[#eceef1]" />
                <Stat valor={String(atual.likesBase + (curtidas[atual.id] ? 1 : 0))} rotulo="curtidas" />
                <button type="button" onClick={() => alternarCurtida(atual.id)} className="ml-auto rounded-full border-[1.5px] px-[18px] py-[11px] text-[14px] font-bold transition-transform active:scale-95" style={{ borderColor: curtidas[atual.id] ? '#14161a' : '#d7dae0', background: curtidas[atual.id] ? '#14161a' : '#fff', color: curtidas[atual.id] ? '#fff' : '#14161a' }}>♥ Curtir</button>
              </div>

              <button type="button" onClick={() => router.push(`/consulta?programa=${encodeURIComponent(atual.programaId)}&data=${atual.dataISO}`)} className="vitrine-pop w-full rounded-[14px] bg-[#14161a] p-4 text-[16px] font-bold text-white transition-transform active:scale-[.98]">Gerar consulta →</button>
              <div className="mt-[14px] flex items-center gap-[9px] text-[13px] font-medium text-[#9aa0a8]"><span className="h-[26px] w-[26px] rounded-full" style={{ background: 'linear-gradient(135deg,#f5a623,#ff5a3c)' }} />Postado por {atual.autor} · Consultora · há 2 dias</div>
            </div>
          </div>
        </main>
      )}

      {view === 'calendar' && (
        <Calendario
          oportunidades={oportunidades}
          mes={mes}
          setMes={setMes}
          diaSelecionado={diaSelecionado}
          setDiaSelecionado={setDiaSelecionado}
          modo={calMode}
          setModo={setCalMode}
          aoAbrir={abrir}
        />
      )}

      {view === 'post' && podePostar && programaDoPost && (
        <Postar
          post={post}
          setPost={setPost}
          programas={programasPost}
          programa={programaDoPost}
          aoArquivo={lerImagem}
          aoCancelar={() => setView('vitrine')}
          aoPublicar={publicar}
        />
      )}
    </div>
  )
}

function Topo({ view, nomeUsuario, podePostar, aoVitrine, aoCalendario, aoPostar }: { view: View; nomeUsuario: string; podePostar: boolean; aoVitrine: () => void; aoCalendario: () => void; aoPostar: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(20,22,26,.07)] bg-[rgba(236,238,241,.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-[14px] sm:gap-7 sm:px-7">
        <button type="button" onClick={aoVitrine} className="vitrine-pop text-[22px] font-extrabold tracking-[-.5px] transition-transform active:scale-95">vitrine<span className="text-[#ff5a3c]">.</span></button>
        <nav className="hidden items-center gap-[26px] md:flex">
          <Nav ativo={view === 'vitrine' || view === 'detail'} onClick={aoVitrine}>Vitrine</Nav>
          <Nav ativo={view === 'calendar'} onClick={aoCalendario}>Calendário</Nav>
          <Nav ativo={false} onClick={aoCalendario}>Datas especiais</Nav>
          <span className="px-[2px] py-[6px] text-[14px] font-semibold text-[#9aa0a8]">Minhas ações</span>
        </nav>
        <div className="ml-auto flex items-center gap-[14px]">
          {podePostar && <button type="button" onClick={aoPostar} className="vitrine-pop hidden items-center gap-[7px] rounded-full bg-[#14161a] px-[18px] py-[11px] text-[13.5px] font-bold text-white transition-transform active:scale-95 sm:flex">+ Postar ação</button>}
          <Link href="/inicio" title="Voltar ao Chatbot 2.0" className="vitrine-pop flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#1e90ff)] text-[13px] font-bold text-white">{iniciais(nomeUsuario)}</Link>
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto px-5 pb-3 md:hidden">
        <Nav ativo={view === 'vitrine' || view === 'detail'} onClick={aoVitrine}>Vitrine</Nav>
        <Nav ativo={view === 'calendar'} onClick={aoCalendario}>Calendário</Nav>
        {podePostar && <button type="button" onClick={aoPostar} className="ml-auto shrink-0 rounded-full bg-[#14161a] px-4 py-2 text-[12px] font-bold text-white">+ Postar</button>}
      </div>
    </header>
  )
}

function Nav({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`relative shrink-0 px-[2px] py-[6px] text-[14px] font-semibold transition-colors ${ativo ? 'text-[#14161a] after:absolute after:-bottom-[6px] after:left-0 after:right-0 after:h-[3px] after:rounded-full after:bg-[#14161a]' : 'text-[#6b7280] hover:text-[#14161a]'}`}>{children}</button>
}

function Chip({ ativo = false, estatico = false, onClick, children }: { ativo?: boolean; estatico?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button type="button" disabled={estatico} onClick={onClick} className={`rounded-full border-[1.5px] px-[15px] py-[7px] text-[13px] font-semibold transition-all ${ativo ? 'border-[#14161a] bg-[#14161a] text-white' : 'border-[#d7dae0] bg-white text-[#6b7280]'} ${estatico ? 'cursor-default' : 'hover:border-[#14161a] hover:text-[#14161a] active:scale-95'}`}>{children}</button>
}

function Card({ oportunidade: o, curtida, aoAbrir, aoCurtir }: { oportunidade: Oportunidade; curtida: boolean; aoAbrir: () => void; aoCurtir: () => void }) {
  return (
    <article onClick={aoAbrir} className="group cursor-pointer overflow-hidden rounded-[20px] bg-white shadow-[0_6px_20px_-12px_rgba(20,22,26,.3)] transition-all duration-200 hover:-translate-y-[6px] hover:shadow-[0_22px_40px_-18px_rgba(20,22,26,.35)]">
      <ImagemOportunidade oportunidade={o} />
      <div className="px-[14px] pb-[15px] pt-[14px]">
        <h2 className="vitrine-pop text-[15px] font-bold leading-[1.2] tracking-[-.3px]">{o.titulo}</h2>
        <p className="mt-[5px] text-[12.5px] font-medium text-[#9aa0a8]">{o.slotsLivres} de {o.slotsTotal} {o.slotsLivres === 1 ? 'livre' : 'livres'}</p>
        <div className="mt-[13px] flex items-center gap-[9px]">
          <button type="button" onClick={(e) => { e.stopPropagation(); aoCurtir() }} className="rounded-full border-[1.5px] px-3 py-[6px] text-[12.5px] font-bold transition-transform active:scale-95" style={{ borderColor: curtida ? '#14161a' : '#d7dae0', background: curtida ? '#14161a' : '#fff', color: curtida ? '#fff' : '#14161a' }}>♥ {o.likesBase + (curtida ? 1 : 0)}</button>
          <span className="ml-auto text-[12px] font-semibold text-[#c1c5cc]">{o.tag}</span>
        </div>
      </div>
    </article>
  )
}

function ImagemOportunidade({ oportunidade: o, grande = false }: { oportunidade: Oportunidade; grande?: boolean }) {
  const slot = estiloSlot(o.slotsLivres)
  return (
    <div className={`relative aspect-[3/4] overflow-hidden ${grande ? 'rounded-[22px] shadow-[0_26px_50px_-24px_rgba(20,22,26,.5)]' : ''}`} style={{ background: o.imagem ? undefined : o.gradiente, backgroundImage: o.imagem ? `url(${o.imagem})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {!o.imagem && <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/70">imagem do programa</div>}
      <div className="vitrine-pop absolute left-[11px] top-[11px] flex items-center gap-[6px] rounded-[9px] bg-[rgba(20,22,26,.55)] px-[9px] py-[5px] text-[11px] font-bold text-white backdrop-blur-sm"><span className="h-[7px] w-[7px] rounded-full" style={{ background: o.cor }} />{dataCurta(o.dataISO)} · {o.programaNome}</div>
      {!grande && <span className="vitrine-pop absolute bottom-[11px] right-[11px] rounded-[9px] border-[1.5px] px-[9px] py-[5px] text-[10.5px] font-bold" style={{ background: slot.bg, color: slot.fg, borderColor: slot.borda }}>{slot.texto}</span>}
    </div>
  )
}

function Stat({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return <div><div className="vitrine-pop text-[28px] font-extrabold leading-none" style={{ color: cor ?? '#14161a' }}>{valor}</div><div className="mt-[2px] text-[12px] font-semibold text-[#9aa0a8]">{rotulo}</div></div>
}

function Calendario({ oportunidades, mes, setMes, diaSelecionado, setDiaSelecionado, modo, setModo, aoAbrir }: { oportunidades: Oportunidade[]; mes: Date; setMes: (d: Date) => void; diaSelecionado: number; setDiaSelecionado: (d: number) => void; modo: CalMode; setModo: (m: CalMode) => void; aoAbrir: (o: Oportunidade) => void }) {
  const ano = mes.getFullYear(); const indiceMes = mes.getMonth()
  const totalDias = new Date(ano, indiceMes + 1, 0).getDate()
  const primeiroDia = new Date(ano, indiceMes, 1).getDay()
  const doMes = oportunidades.filter((o) => { const d = new Date(`${o.dataISO}T12:00:00`); return d.getFullYear() === ano && d.getMonth() === indiceMes })
  const doDia = doMes.filter((o) => Number(o.dataISO.slice(8, 10)) === diaSelecionado)
  const tituloDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ano, indiceMes, diaSelecionado)).replace('.', '')
  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)]

  function navegar(delta: number) { const nova = new Date(ano, indiceMes + delta, 1); setMes(nova); setDiaSelecionado(1) }

  return (
    <main className="relative mx-auto max-w-[1180px] px-5 pb-[70px] pt-[34px] sm:px-7">
      <div className="vitrine-pop pointer-events-none absolute right-[14px] top-0 hidden text-[120px] font-extrabold leading-[.8] tracking-[-5px] text-[rgba(20,22,26,.035)] lg:block">{MESES_LONGOS[indiceMes].toLowerCase()}</div>
      <div className="relative flex flex-wrap items-center gap-[14px]">
        <h1 className="vitrine-pop m-0 text-[32px] font-extrabold tracking-[-1px]">{MESES_LONGOS[indiceMes]} {ano}</h1>
        <div className="ml-[6px] flex gap-[6px]"><button type="button" onClick={() => navegar(-1)} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-[#d7dae0] bg-white font-bold text-[#6b7280] active:scale-95">‹</button><button type="button" onClick={() => navegar(1)} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-[#d7dae0] bg-white font-bold text-[#6b7280] active:scale-95">›</button></div>
        <div className="ml-auto flex gap-2 rounded-full bg-white p-1"><Chip ativo={modo === 'grid'} onClick={() => setModo('grid')}>Grade</Chip><Chip ativo={modo === 'agenda'} onClick={() => setModo('agenda')}>Agenda</Chip></div>
      </div>

      {modo === 'grid' ? (
        <div className="relative mt-6 grid items-start gap-[26px] lg:grid-cols-[1.55fr_1fr]">
          <div className="rounded-[20px] bg-white p-5 shadow-[0_6px_22px_-16px_rgba(20,22,26,.4)]">
            <div className="mb-[10px] grid grid-cols-7 gap-2">{DIAS.map((d) => <div key={d} className="text-center text-[11px] font-bold tracking-[1px] text-[#c1c5cc]">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-2">{celulas.map((dia, i) => {
              if (!dia) return <div key={`vazio-${i}`} className="aspect-square" />
              const eventos = doMes.filter((o) => Number(o.dataISO.slice(8, 10)) === dia).slice(0, 3)
              const selecionado = diaSelecionado === dia
              return <button key={dia} type="button" onClick={() => setDiaSelecionado(dia)} className={`flex aspect-square flex-col items-center justify-center gap-[5px] rounded-xl border-[1.5px] transition-transform active:scale-95 ${selecionado ? 'border-[#14161a] bg-[#14161a]' : eventos.length ? 'border-[#eceef1] bg-white' : 'border-[#f3f4f6] bg-white'}`}><span className={`vitrine-pop text-[14px] font-bold ${selecionado ? 'text-white' : eventos.length ? 'text-[#14161a]' : 'text-[#c1c5cc]'}`}>{dia}</span><span className="flex h-[6px] gap-[3px]">{eventos.map((e) => <i key={e.id} className="h-[6px] w-[6px] rounded-full" style={{ background: e.cor }} />)}</span></button>
            })}</div>
          </div>
          <Agenda titulo={tituloDia} itens={doDia} aoAbrir={aoAbrir} />
        </div>
      ) : (
        <div className="mt-6 max-w-[760px]"><Agenda titulo={`${MESES_LONGOS[indiceMes]} ${ano}`} itens={doMes} aoAbrir={aoAbrir} /></div>
      )}
    </main>
  )
}

function Agenda({ titulo, itens, aoAbrir }: { titulo: string; itens: Oportunidade[]; aoAbrir: (o: Oportunidade) => void }) {
  return <section><h2 className="vitrine-pop text-[18px] font-bold capitalize">{titulo}</h2><p className="mt-[2px] text-[13px] font-semibold text-[#9aa0a8]">{itens.length} {itens.length === 1 ? 'ação' : 'ações'} {titulo.includes('2026') ? 'neste mês' : 'neste dia'}</p><div className="mt-4 flex flex-col gap-3">{itens.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d7dae0] bg-white/50 p-7 text-center text-[13px] text-[#9aa0a8]">Nenhuma oportunidade nesta data.</div> : itens.map((o) => { const slot = estiloSlot(o.slotsLivres); return <button key={o.id} type="button" onClick={() => aoAbrir(o)} className="flex items-center gap-[13px] rounded-2xl bg-white p-[11px] text-left shadow-[0_5px_18px_-14px_rgba(20,22,26,.4)] transition-all hover:-translate-y-1"><span className="h-[58px] w-[58px] shrink-0 rounded-xl" style={{ background: o.gradiente }} /><span className="min-w-0 flex-1"><strong className="vitrine-pop block text-[14px] leading-[1.2]">{o.titulo}</strong><span className="mt-[3px] block text-[12px] font-semibold text-[#9aa0a8]">{o.slotsLivres} de {o.slotsTotal} livres</span></span><span className="vitrine-pop rounded-[9px] border-[1.5px] px-[9px] py-[5px] text-[10.5px] font-bold" style={{ background: slot.bg, color: slot.fg, borderColor: slot.borda }}>{slot.texto}</span></button> })}</div></section>
}

function Postar({ post, setPost, programas, programa, aoArquivo, aoCancelar, aoPublicar }: { post: { programaId: string; dataISO: string; slots: number; titulo: string; imagem: string | null }; setPost: React.Dispatch<React.SetStateAction<{ programaId: string; dataISO: string; slots: number; titulo: string; imagem: string | null }>>; programas: ProgramaVisual[]; programa: ProgramaVisual; aoArquivo: (e: ChangeEvent<HTMLInputElement>) => void; aoCancelar: () => void; aoPublicar: () => void }) {
  return <main className="mx-auto max-w-[960px] px-5 pb-[70px] pt-7 sm:px-7"><button type="button" onClick={aoCancelar} className="mb-4 inline-flex items-center gap-2 text-[14px] font-semibold text-[#6b7280] active:scale-95">← Cancelar</button><h1 className="vitrine-pop mb-6 text-[32px] font-extrabold tracking-[-1px]">Postar nova oportunidade</h1><div className="grid items-start gap-[38px] lg:grid-cols-[1.3fr_.7fr]">
    <div className="flex flex-col gap-5">
      <Campo rotulo="Imagem" complemento="(pequena / média · máx 1200px)"><label className="block cursor-pointer"><input type="file" accept="image/*" onChange={aoArquivo} className="hidden" /><div className="flex aspect-[16/7] flex-col items-center justify-center gap-[6px] rounded-2xl border-2 border-dashed border-[#c8ccd4] bg-white bg-cover bg-center" style={{ backgroundImage: post.imagem ? `url(${post.imagem})` : undefined }}><strong className="vitrine-pop text-[14px]" style={{ color: post.imagem ? '#fff' : '#9aa0a8' }}>{post.imagem ? 'Imagem carregada ✓' : 'Adicionar imagem'}</strong><span className="text-[12px]" style={{ color: post.imagem ? '#fff' : '#9aa0a8' }}>arraste ou clique para enviar</span></div></label></Campo>
      <Campo rotulo="Programa"><select value={post.programaId} onChange={(e) => setPost((p) => ({ ...p, programaId: e.target.value }))} className="w-full rounded-xl border-[1.5px] border-[#d7dae0] bg-white px-[14px] py-[13px] text-[14px] font-semibold text-[#14161a] outline-none">{programas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Campo rotulo="Data do evento"><input type="date" value={post.dataISO} onChange={(e) => setPost((p) => ({ ...p, dataISO: e.target.value }))} className="w-full rounded-xl border-[1.5px] border-[#d7dae0] bg-white px-[14px] py-3 text-[14px] font-semibold" /></Campo><Campo rotulo="Slots disponíveis"><input type="number" min={1} value={post.slots} onChange={(e) => setPost((p) => ({ ...p, slots: Math.max(1, Number(e.target.value) || 1) }))} className="w-full rounded-xl border-[1.5px] border-[#d7dae0] bg-white px-[14px] py-3 text-[14px] font-semibold" /></Campo></div>
      <Campo rotulo="Título / chamada"><input type="text" maxLength={120} value={post.titulo} onChange={(e) => setPost((p) => ({ ...p, titulo: e.target.value }))} className="w-full rounded-xl border-[1.5px] border-[#d7dae0] bg-white px-[14px] py-[13px] text-[14px] font-semibold outline-none focus:border-[#14161a]" /></Campo>
      <button type="button" onClick={aoPublicar} className="vitrine-pop rounded-[14px] bg-[#14161a] p-[15px] text-[15px] font-bold text-white active:scale-[.98]">Publicar na vitrine</button>
    </div>
    <aside className="lg:sticky lg:top-[90px]"><p className="mb-3 text-[12px] font-bold uppercase tracking-[1px] text-[#9aa0a8]">Prévia do card</p><div className="overflow-hidden rounded-[20px] bg-white shadow-[0_18px_40px_-22px_rgba(20,22,26,.5)]"><div className="relative aspect-[3/4] bg-cover bg-center" style={{ background: post.imagem ? undefined : programa.gradiente, backgroundImage: post.imagem ? `url(${post.imagem})` : undefined }}>
      {!post.imagem && <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/60">imagem</span>}<div className="vitrine-pop absolute left-[11px] top-[11px] flex items-center gap-[6px] rounded-[9px] bg-[rgba(20,22,26,.55)] px-[9px] py-[5px] text-[11px] font-bold text-white backdrop-blur-sm"><i className="h-[7px] w-[7px] rounded-full" style={{ background: programa.cor }} />{dataCurta(post.dataISO)} · {programa.nome}</div><span className="vitrine-pop absolute bottom-[11px] right-[11px] rounded-[9px] border-[1.5px] border-[#14161a] bg-white px-[9px] py-[5px] text-[10.5px] font-bold">{post.slots} slots</span></div><div className="p-[14px]"><strong className="vitrine-pop block text-[15px] leading-[1.2]">{post.titulo || 'Sua chamada aparece aqui'}</strong><span className="mt-[5px] block text-[12.5px] font-medium text-[#9aa0a8]">{post.slots} de {post.slots} livres</span><span className="mt-[13px] inline-block rounded-full border-[1.5px] border-[#d7dae0] px-3 py-[6px] text-[12.5px] font-bold text-[#9aa0a8]">♥ 0</span></div></div><p className="mt-3 text-[12px] leading-[1.5] text-[#9aa0a8]">O selo com <b>data</b> e <b>programa</b> é aplicado automaticamente ao publicar.</p></aside>
  </div></main>
}

function Campo({ rotulo, complemento, children }: { rotulo: string; complemento?: string; children: React.ReactNode }) {
  return <div><p className="vitrine-pop mb-2 text-[13px] font-bold">{rotulo} {complemento && <span className="font-semibold text-[#9aa0a8]">{complemento}</span>}</p>{children}</div>
}
