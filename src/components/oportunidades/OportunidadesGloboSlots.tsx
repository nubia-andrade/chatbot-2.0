'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

type ProgramaDoApp = { id: string; nome: string }
type Props = {
  nomeUsuario: string
  programas: ProgramaDoApp[]
  modoInicial?: 'feed' | 'postar'
}

type Oportunidade = {
  id: string
  programaId: string
  programaNome: string
  dataISO: string
  titulo: string
  tag: string
  likes: number
  slotsLivres: number
  slotsTotal: number
  cor: string
  gradiente: string
  autor: string
  imagem?: string | null
}

type Tela = 'feed' | 'detalhe' | 'postar'
type Filtro = 'todas' | 'datas' | 'talentos' | 'sazonais'

const PALETA = [
  { cor: '#ff5a3c', gradiente: 'linear-gradient(150deg,#ff8a3c,#ff3d6e)' },
  { cor: '#7c3aed', gradiente: 'linear-gradient(150deg,#8b5cf6,#4f46e5)' },
  { cor: '#1e90ff', gradiente: 'linear-gradient(150deg,#22d3ee,#2563eb)' },
  { cor: '#f5a623', gradiente: 'linear-gradient(150deg,#fbbf24,#f97316)' },
  { cor: '#10b981', gradiente: 'linear-gradient(150deg,#34d399,#059669)' },
  { cor: '#ec4899', gradiente: 'linear-gradient(150deg,#f472b6,#db2777)' },
] as const

const DEMO_PROGRAMAS = ['Novelas', 'Big Brother', 'SporTV', 'Domingão', 'Estreias', 'Especiais']
const DEMO: Oportunidade[] = [
  demo('0', 0, '2026-05-10', 'Ação especial Dia das Mães', 24, 3, 5, 'Sazonal'),
  demo('1', 1, '2026-11-29', 'Esquenta Black Friday no BBB', 61, 1, 6, 'Comercial'),
  demo('2', 2, '2026-06-04', 'Participação de talento no intervalo', 12, 0, 4, 'Talento'),
  demo('3', 3, '2026-06-12', 'Dia dos Namorados no palco', 8, 7, 10, 'Sazonal'),
  demo('4', 4, '2026-08-15', 'Estreia da nova temporada', 33, 2, 5, 'Lançamento'),
  demo('5', 5, '2026-09-30', 'Especial de aniversário', 19, 4, 8, 'Institucional'),
  demo('6', 0, '2026-05-10', 'Homenagem às mães na novela', 41, 2, 4, 'Sazonal'),
  demo('7', 2, '2026-09-07', 'Cobertura especial de corrida', 27, 5, 8, 'Evento'),
]

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const CHAVE_LOCAL = 'globo-slots-oportunidades-locais'

function demo(id: string, p: number, dataISO: string, titulo: string, likes: number, livres: number, total: number, tag: string): Oportunidade {
  return {
    id,
    programaId: `demo-${p}`,
    programaNome: DEMO_PROGRAMAS[p],
    dataISO,
    titulo,
    tag,
    likes,
    slotsLivres: livres,
    slotsTotal: total,
    cor: PALETA[p].cor,
    gradiente: PALETA[p].gradiente,
    autor: 'Marina Souza',
  }
}

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${String(dia).padStart(2, '0')} ${MESES[mes - 1]}`
}

function slotVisual(livres: number) {
  if (livres <= 0) return { bg: '#eef0f2', fg: '#8a909a', borda: '#dfe2e7', texto: 'esgotado' }
  if (livres === 1) return { bg: '#ffe9e2', fg: '#c23a20', borda: '#ff5a3c', texto: '1 slot' }
  return { bg: '#fff', fg: '#14161a', borda: '#14161a', texto: `${livres} slots` }
}

export function OportunidadesGloboSlots({ nomeUsuario, programas, modoInicial = 'feed' }: Props) {
  const router = useRouter()
  const [tela, setTela] = useState<Tela>(modoInicial)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [selecionada, setSelecionada] = useState<Oportunidade | null>(null)
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({})
  const [locais, setLocais] = useState<Oportunidade[]>([])
  const [post, setPost] = useState({
    programaId: programas[0]?.id ?? '',
    dataISO: '2026-08-29',
    slots: 3,
    titulo: '',
    imagem: null as string | null,
  })

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_LOCAL)
      if (salvo) setLocais(JSON.parse(salvo) as Oportunidade[])
    } catch {
      setLocais([])
    }
  }, [])

  const oportunidades = useMemo(() => [...locais, ...DEMO], [locais])
  const filtradas = useMemo(() => oportunidades
    .filter((o) => {
      if (filtro === 'datas') return o.tag === 'Sazonal' || o.tag === 'Comercial'
      if (filtro === 'talentos') return o.tag === 'Talento'
      if (filtro === 'sazonais') return o.tag === 'Sazonal'
      return true
    })
    .sort((a, b) => b.slotsLivres - a.slotsLivres), [oportunidades, filtro])

  const programaDoPost = programas.find((programa) => programa.id === post.programaId) ?? programas[0]
  const indicePrograma = Math.max(0, programas.findIndex((programa) => programa.id === programaDoPost?.id))
  const temaPost = PALETA[indicePrograma % PALETA.length]

  function abrir(oportunidade: Oportunidade) {
    setSelecionada(oportunidade)
    setTela('detalhe')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function alternarCurtida(id: string) {
    setCurtidas((atual) => ({ ...atual, [id]: !atual[id] }))
  }

  function lerImagem(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setPost((atual) => ({ ...atual, imagem: typeof leitor.result === 'string' ? leitor.result : null }))
    leitor.readAsDataURL(arquivo)
  }

  function publicar() {
    if (!programaDoPost || !post.dataISO || post.slots < 1 || !post.titulo.trim()) return
    const nova: Oportunidade = {
      id: `local-${Date.now()}`,
      programaId: programaDoPost.id,
      programaNome: programaDoPost.nome,
      dataISO: post.dataISO,
      titulo: post.titulo.trim(),
      tag: 'Sazonal',
      likes: 0,
      slotsLivres: post.slots,
      slotsTotal: post.slots,
      cor: temaPost.cor,
      gradiente: temaPost.gradiente,
      autor: nomeUsuario,
      imagem: post.imagem,
    }
    const proximas = [nova, ...locais]
    setLocais(proximas)
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(proximas))
    setTela('feed')
    setPost((atual) => ({ ...atual, titulo: '', imagem: null }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (tela === 'postar') {
    return (
      <div className="mx-auto max-w-[960px] px-5 pb-[70px] pt-8 sm:px-7">
        <button type="button" onClick={() => modoInicial === 'postar' ? router.push('/oportunidades') : setTela('feed')} className="mb-4 text-[14px] font-semibold text-[#6b7280]">← Cancelar</button>
        <h1 className="vitrine-pop text-[32px] font-extrabold tracking-[-1px]">Publicar oportunidade</h1>
        <p className="mt-1 text-[13px] text-[#6b7280]">Crie a ação e confira exatamente como ela aparecerá para o time comercial.</p>

        <div className="mt-6 grid items-start gap-9 lg:grid-cols-[1.3fr_.7fr]">
          <div className="flex flex-col gap-5">
            <Campo titulo="Imagem" apoio="pequena / média · máx. recomendado 1200px">
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" onChange={lerImagem} className="hidden" />
                <div className="flex aspect-[16/7] items-center justify-center rounded-[16px] border-2 border-dashed border-[#c8ccd4] bg-white bg-cover bg-center" style={{ backgroundImage: post.imagem ? `url(${post.imagem})` : undefined }}>
                  <div className={`text-center ${post.imagem ? 'rounded-lg bg-black/45 px-3 py-2 text-white' : 'text-[#9aa0a8]'}`}>
                    <p className="vitrine-pop text-[14px] font-bold">{post.imagem ? 'Imagem carregada ✓' : 'Adicionar imagem'}</p>
                    <p className="mt-1 text-[12px]">clique para enviar</p>
                  </div>
                </div>
              </label>
            </Campo>

            <Campo titulo="Programa">
              <select value={post.programaId} onChange={(e) => setPost((a) => ({ ...a, programaId: e.target.value }))} className="vitrine-input">
                {programas.map((programa) => <option key={programa.id} value={programa.id}>{programa.nome}</option>)}
              </select>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Data do evento"><input type="date" value={post.dataISO} onChange={(e) => setPost((a) => ({ ...a, dataISO: e.target.value }))} className="vitrine-input" /></Campo>
              <Campo titulo="Slots disponíveis"><input type="number" min={1} value={post.slots} onChange={(e) => setPost((a) => ({ ...a, slots: Math.max(1, Number(e.target.value) || 1) }))} className="vitrine-input" /></Campo>
            </div>

            <Campo titulo="Título / chamada"><input type="text" value={post.titulo} onChange={(e) => setPost((a) => ({ ...a, titulo: e.target.value }))} placeholder="Ex.: Ação especial Dia das Mães" className="vitrine-input" /></Campo>

            <button type="button" onClick={publicar} disabled={!programaDoPost || !post.titulo.trim()} className="vitrine-pop rounded-[14px] bg-[#14161a] p-[15px] text-[15px] font-bold text-white disabled:opacity-40">Publicar em Oportunidades</button>
          </div>

          <div className="lg:sticky lg:top-[100px]">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[1px] text-[#9aa0a8]">Prévia do card</p>
            <Card oportunidade={{
              id: 'preview', programaId: programaDoPost?.id ?? '', programaNome: programaDoPost?.nome ?? 'Programa', dataISO: post.dataISO, titulo: post.titulo || 'Sua chamada aparece aqui', tag: 'Sazonal', likes: 0, slotsLivres: post.slots, slotsTotal: post.slots, cor: temaPost.cor, gradiente: temaPost.gradiente, autor: nomeUsuario, imagem: post.imagem,
            }} curtida={false} aoAbrir={() => {}} aoCurtir={() => {}} preview />
            <p className="mt-3 text-[12px] leading-[1.5] text-[#9aa0a8]">O selo com <strong>data</strong> e <strong>programa</strong> é aplicado automaticamente.</p>
          </div>
        </div>
      </div>
    )
  }

  if (tela === 'detalhe' && selecionada) {
    const likes = selecionada.likes + (curtidas[selecionada.id] ? 1 : 0)
    return (
      <div className="mx-auto max-w-[920px] px-5 pb-[70px] pt-7 sm:px-7">
        <button type="button" onClick={() => setTela('feed')} className="mb-[18px] text-[14px] font-semibold text-[#6b7280]">← Voltar às oportunidades</button>
        <div className="grid items-start gap-[34px] md:grid-cols-[.9fr_1.1fr]">
          <Imagem oportunidade={selecionada} detalhe />
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2"><span className="vitrine-pop rounded-full px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: selecionada.cor }}>{selecionada.programaNome}</span><span className="vitrine-chip">{selecionada.tag}</span></div>
            <h1 className="vitrine-pop mt-4 text-[34px] font-extrabold leading-[1.05] tracking-[-1px]">{selecionada.titulo}</h1>
            <p className="mt-[14px] text-[15.5px] leading-[1.6] text-[#5a606a]">Oportunidade criada pelo time do programa para conectar marcas a ações sazonais, participações de talentos e narrativas especiais, conforme disponibilidade de slots.</p>

            <div className="my-[22px] flex flex-wrap items-center gap-[22px] rounded-[16px] bg-white px-5 py-[18px] shadow-[0_6px_20px_-14px_rgba(20,22,26,.4)]">
              <Stat valor={String(selecionada.slotsLivres)} rotulo="slots livres" cor={selecionada.cor} />
              <span className="h-[38px] w-px bg-[#eceef1]" />
              <Stat valor={String(likes)} rotulo="curtidas" />
              <button type="button" onClick={() => alternarCurtida(selecionada.id)} className="ml-auto rounded-full border-[1.5px] px-[18px] py-[10px] text-[14px] font-bold" style={{ borderColor: curtidas[selecionada.id] ? '#14161a' : '#d7dae0', background: curtidas[selecionada.id] ? '#14161a' : '#fff', color: curtidas[selecionada.id] ? '#fff' : '#14161a' }}>♥ Curtir</button>
            </div>

            <button type="button" onClick={() => router.push(`/consulta?programa=${encodeURIComponent(selecionada.programaId)}&data=${selecionada.dataISO}`)} className="vitrine-pop w-full rounded-[14px] bg-[#14161a] p-4 text-[16px] font-bold text-white">Gerar consulta →</button>
            <div className="mt-[14px] flex items-center gap-2.5 text-[13px] font-medium text-[#9aa0a8]"><span className="h-7 w-7 rounded-full" style={{ background: selecionada.gradiente }} />Postado por {selecionada.autor} · Consultor de programa</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-[1180px] px-5 pb-[70px] pt-[34px] sm:px-7">
      <div className="vitrine-pop pointer-events-none absolute right-[14px] top-[6px] hidden select-none text-[150px] font-extrabold leading-[.8] tracking-[-6px] text-[rgba(20,22,26,.035)] lg:block">2026</div>
      <section className="relative">
        <p className="text-[13px] font-semibold uppercase tracking-[2px] text-[#ff5a3c]">Oportunidades de ação</p>
        <h1 className="vitrine-pop mt-2 text-[38px] font-extrabold leading-[1.02] tracking-[-1.5px] sm:text-[44px]">Descubra onde sua<br />marca pode entrar</h1>
        <p className="mt-3 max-w-[560px] text-[15px] leading-[1.5] text-[#6b7280]">Ações comemorativas, sazonais e participações de talentos dos programas Globo. Veja os slots livres e transforme uma oportunidade em consulta.</p>
      </section>

      <div className="relative mb-[22px] mt-7 flex flex-wrap items-center gap-[9px]">
        <Filtro ativo={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas</Filtro>
        <Filtro ativo={filtro === 'datas'} onClick={() => setFiltro('datas')}>Datas comemorativas</Filtro>
        <Filtro ativo={filtro === 'talentos'} onClick={() => setFiltro('talentos')}>Talentos</Filtro>
        <Filtro ativo={filtro === 'sazonais'} onClick={() => setFiltro('sazonais')}>Sazonais</Filtro>
        <span className="ml-auto text-[13px] font-semibold text-[#6b7280]">ordenar: mais slots ▾</span>
      </div>

      <div className="relative grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtradas.map((oportunidade) => (
          <Card key={oportunidade.id} oportunidade={oportunidade} curtida={Boolean(curtidas[oportunidade.id])} aoAbrir={() => abrir(oportunidade)} aoCurtir={() => alternarCurtida(oportunidade.id)} />
        ))}
      </div>
    </div>
  )
}

function Card({ oportunidade, curtida, aoAbrir, aoCurtir, preview = false }: { oportunidade: Oportunidade; curtida: boolean; aoAbrir: () => void; aoCurtir: () => void; preview?: boolean }) {
  const slot = slotVisual(oportunidade.slotsLivres)
  return (
    <article onClick={preview ? undefined : aoAbrir} className={`${preview ? '' : 'vitrine-card cursor-pointer'} overflow-hidden rounded-[20px] bg-white shadow-[0_6px_20px_-12px_rgba(20,22,26,.3)]`}>
      <Imagem oportunidade={oportunidade} />
      <div className="p-[14px] pb-[15px]">
        <h2 className="vitrine-pop text-[15px] font-bold leading-[1.2] tracking-[-.3px]">{oportunidade.titulo}</h2>
        <p className="mt-[5px] text-[12.5px] font-medium text-[#9aa0a8]">{oportunidade.slotsLivres} de {oportunidade.slotsTotal} {oportunidade.slotsTotal === 1 ? 'livre' : 'livres'}</p>
        <div className="mt-[13px] flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); if (!preview) aoCurtir() }} className="rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold" style={{ borderColor: curtida ? '#14161a' : '#d7dae0', background: curtida ? '#14161a' : '#fff', color: curtida ? '#fff' : '#14161a' }}>♥ {oportunidade.likes + (curtida ? 1 : 0)}</button>
          <span className="ml-auto text-[12px] font-semibold text-[#c1c5cc]">{oportunidade.tag}</span>
        </div>
      </div>
      <span className="sr-only">{slot.texto}</span>
    </article>
  )
}

function Imagem({ oportunidade, detalhe = false }: { oportunidade: Oportunidade; detalhe?: boolean }) {
  const slot = slotVisual(oportunidade.slotsLivres)
  return (
    <div className={`relative overflow-hidden bg-cover bg-center ${detalhe ? 'aspect-[3/4] rounded-[22px] shadow-[0_26px_50px_-24px_rgba(20,22,26,.5)]' : 'aspect-[3/4]'}`} style={{ background: oportunidade.imagem ? undefined : oportunidade.gradiente, backgroundImage: oportunidade.imagem ? `url(${oportunidade.imagem})` : undefined }}>
      {!oportunidade.imagem && <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/70">imagem do programa</div>}
      <div className="vitrine-pop absolute left-[11px] top-[11px] flex items-center gap-1.5 rounded-[9px] bg-[rgba(20,22,26,.55)] px-[9px] py-[5px] text-[11px] font-bold text-white backdrop-blur-sm"><span className="h-[7px] w-[7px] rounded-full" style={{ background: oportunidade.cor }} />{dataCurta(oportunidade.dataISO)} · {oportunidade.programaNome}</div>
      {!detalhe && <div className="vitrine-pop absolute bottom-[11px] right-[11px] rounded-[9px] border-[1.5px] px-[9px] py-[5px] text-[10.5px] font-bold" style={{ background: slot.bg, color: slot.fg, borderColor: slot.borda }}>{slot.texto}</div>}
    </div>
  )
}

function Filtro({ ativo, children, onClick }: { ativo: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border-[1.5px] px-[15px] py-[7px] text-[13px] font-semibold ${ativo ? 'border-[#14161a] bg-[#14161a] text-white' : 'border-[#d7dae0] bg-white text-[#6b7280] hover:border-[#14161a] hover:text-[#14161a]'}`}>{children}</button>
}

function Campo({ titulo, apoio, children }: { titulo: string; apoio?: string; children: React.ReactNode }) {
  return <div><p className="vitrine-pop mb-2 text-[13px] font-bold">{titulo} {apoio && <span className="font-semibold text-[#9aa0a8]">({apoio})</span>}</p>{children}</div>
}

function Stat({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return <div><p className="vitrine-pop text-[28px] font-extrabold leading-none" style={{ color: cor ?? '#14161a' }}>{valor}</p><p className="mt-1 text-[12px] font-semibold text-[#9aa0a8]">{rotulo}</p></div>
}
