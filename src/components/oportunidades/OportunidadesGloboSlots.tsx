'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { consultarInventarioDaOportunidade, publicarOportunidade } from '@/lib/acoes/oportunidades'
import type { InventarioDaOportunidade } from '@/lib/dados/inventario-oportunidades'
import type { CategoriaDeOportunidade, OportunidadePublicada } from '@/lib/dados/oportunidades'

type ProgramaDoApp = { id: string; nome: string }
type Props = {
  nomeUsuario: string
  programas: ProgramaDoApp[]
  categorias: CategoriaDeOportunidade[]
  oportunidadesIniciais: OportunidadePublicada[]
  modoInicial?: 'feed' | 'postar'
}
type Tela = 'feed' | 'detalhe' | 'postar'

const PALETA = [
  { cor: '#ff5a3c', gradiente: 'linear-gradient(150deg,#ff8a3c,#ff3d6e)' },
  { cor: '#7c3aed', gradiente: 'linear-gradient(150deg,#8b5cf6,#4f46e5)' },
  { cor: '#1e90ff', gradiente: 'linear-gradient(150deg,#22d3ee,#2563eb)' },
  { cor: '#f5a623', gradiente: 'linear-gradient(150deg,#fbbf24,#f97316)' },
  { cor: '#10b981', gradiente: 'linear-gradient(150deg,#34d399,#059669)' },
  { cor: '#ec4899', gradiente: 'linear-gradient(150deg,#f472b6,#db2777)' },
] as const
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${String(dia).padStart(2, '0')} ${MESES[mes - 1]}`
}
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
const inventarioVazio: InventarioDaOportunidade = { slotsTotal: 0, slotsOcupados: 0, slotsLivres: 0, setoresCompradores: [], erro: null }

export function OportunidadesGloboSlots({ nomeUsuario, programas, categorias, oportunidadesIniciais, modoInicial = 'feed' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventoNaUrl = searchParams.get('evento')
  const hoje = new Date().toISOString().slice(0, 10)
  const [tela, setTela] = useState<Tela>(modoInicial)
  const [filtro, setFiltro] = useState<string>('todas')
  const [selecionada, setSelecionada] = useState<OportunidadePublicada | null>(null)
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({})
  const [arquivoImagem, setArquivoImagem] = useState<File | null>(null)
  const [inventario, setInventario] = useState<InventarioDaOportunidade>(inventarioVazio)
  const [consultandoInventario, setConsultandoInventario] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [erroPublicacao, setErroPublicacao] = useState<string | null>(null)
  const [post, setPost] = useState({
    programaId: programas[0]?.id ?? '',
    categoriaId: categorias[0]?.id ?? '',
    dataISO: hoje,
    expiraEm: hoje,
    titulo: '',
    descricao: '',
    imagem: null as string | null,
  })

  const oportunidades = useMemo(
    () => oportunidadesIniciais.filter((oportunidade) => oportunidade.expiraEm >= hoje),
    [oportunidadesIniciais, hoje],
  )

  useEffect(() => {
    if (!eventoNaUrl || modoInicial === 'postar') return
    const encontrada = oportunidades.find((oportunidade) => oportunidade.id === eventoNaUrl)
    if (!encontrada) return
    setSelecionada(encontrada)
    setTela('detalhe')
  }, [eventoNaUrl, modoInicial, oportunidades])

  useEffect(() => {
    if (tela !== 'postar' || !post.programaId || !post.dataISO) {
      setInventario(inventarioVazio)
      return
    }
    let cancelado = false
    setConsultandoInventario(true)
    setErroPublicacao(null)
    consultarInventarioDaOportunidade(post.programaId, post.dataISO).then((resultado) => {
      if (!cancelado) {
        setInventario(resultado)
        setConsultandoInventario(false)
      }
    })
    return () => { cancelado = true }
  }, [tela, post.programaId, post.dataISO])

  const filtradas = useMemo(() => oportunidades
    .filter((oportunidade) => filtro === 'todas' || oportunidade.categoriaId === filtro)
    .sort((a, b) => b.slotsLivres - a.slotsLivres), [oportunidades, filtro])

  const programaDoPost = programas.find((programa) => programa.id === post.programaId) ?? programas[0]
  const categoriaDoPost = categorias.find((categoria) => categoria.id === post.categoriaId) ?? categorias[0]

  function abrir(oportunidade: OportunidadePublicada) {
    setSelecionada(oportunidade)
    setTela('detalhe')
    window.history.replaceState(null, '', `/oportunidades?evento=${encodeURIComponent(oportunidade.id)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function voltarAoFeed() {
    setTela('feed')
    setSelecionada(null)
    window.history.replaceState(null, '', '/oportunidades')
  }
  function alternarCurtida(id: string) {
    setCurtidas((atual) => ({ ...atual, [id]: !atual[id] }))
  }
  function lerImagem(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    setArquivoImagem(arquivo)
    const leitor = new FileReader()
    leitor.onload = () => setPost((atual) => ({ ...atual, imagem: typeof leitor.result === 'string' ? leitor.result : null }))
    leitor.readAsDataURL(arquivo)
  }

  async function publicar() {
    if (publicando) return
    setErroPublicacao(null)
    if (!post.programaId || !post.categoriaId || !post.dataISO || !post.expiraEm || !post.titulo.trim() || !post.descricao.trim()) {
      setErroPublicacao('Preencha programa, categoria, datas, título e descrição.')
      return
    }
    if (inventario.slotsLivres <= 0) {
      setErroPublicacao('Esta data está sem slots livres. Escolha outra data.')
      return
    }
    setPublicando(true)
    const formulario = new FormData()
    formulario.set('programaId', post.programaId)
    formulario.set('categoriaId', post.categoriaId)
    formulario.set('dataISO', post.dataISO)
    formulario.set('expiraEm', post.expiraEm)
    formulario.set('titulo', post.titulo.trim())
    formulario.set('descricao', post.descricao.trim())
    if (arquivoImagem) formulario.set('imagem', arquivoImagem)

    const resultado = await publicarOportunidade(formulario)
    if (!resultado.ok) {
      setErroPublicacao(resultado.erro ?? 'Não foi possível publicar a oportunidade.')
      setPublicando(false)
      return
    }
    router.push('/oportunidades')
    router.refresh()
  }

  if (tela === 'postar') {
    const preview: OportunidadePublicada = {
      id: 'preview',
      programaId: programaDoPost?.id ?? '',
      programaNome: programaDoPost?.nome ?? 'Programa',
      categoriaId: categoriaDoPost?.id ?? '',
      categoriaNome: categoriaDoPost?.nome ?? 'Categoria',
      categoriaSlug: categoriaDoPost?.slug ?? 'categoria',
      dataISO: post.dataISO,
      expiraEm: post.expiraEm,
      titulo: post.titulo || 'Sua chamada aparece aqui',
      descricao: post.descricao || 'A descrição curta da oportunidade aparecerá aqui.',
      imagem: post.imagem,
      autor: nomeUsuario,
      slotsLivres: inventario.slotsLivres,
      slotsTotal: inventario.slotsTotal,
      slotsOcupados: inventario.slotsOcupados,
      setoresCompradores: inventario.setoresCompradores,
    }

    return (
      <div className="mx-auto max-w-[960px] px-5 pb-[70px] pt-6 sm:px-7">
        <button type="button" onClick={() => router.push('/oportunidades')} className="mb-4 text-[13px] font-semibold text-[#6b7280]">← Cancelar</button>
        <h1 className="vitrine-pop text-[30px] font-extrabold tracking-[-1px]">Publicar oportunidade</h1>
        <p className="mt-1 text-[13px] text-[#6b7280]">Crie a ação, confira o inventário da data e veja como ela aparecerá para o time comercial.</p>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1.45fr_.75fr]">
          <div className="flex flex-col gap-5">
            <Campo titulo="Imagem" apoio="máx. 5 MB">
              <label className="block cursor-pointer">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={lerImagem} className="hidden" />
                <div className="flex aspect-[16/6] items-center justify-center rounded-[16px] border-2 border-dashed border-[#c8ccd4] bg-white bg-cover bg-center" style={{ backgroundImage: post.imagem ? `url(${post.imagem})` : undefined }}>
                  <div className={`text-center ${post.imagem ? 'rounded-lg bg-black/45 px-3 py-2 text-white' : 'text-[#9aa0a8]'}`}>
                    <p className="vitrine-pop text-[14px] font-bold">{post.imagem ? 'Imagem carregada ✓' : 'Adicionar imagem'}</p>
                    <p className="mt-1 text-[12px]">clique para enviar</p>
                  </div>
                </div>
              </label>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Programa">
                <select value={post.programaId} onChange={(e) => setPost((a) => ({ ...a, programaId: e.target.value }))} className="vitrine-input">
                  {programas.map((programa) => <option key={programa.id} value={programa.id}>{programa.nome}</option>)}
                </select>
              </Campo>
              <Campo titulo="Categoria">
                <select value={post.categoriaId} onChange={(e) => setPost((a) => ({ ...a, categoriaId: e.target.value }))} className="vitrine-input">
                  {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
                </select>
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Data do evento">
                <input type="date" value={post.dataISO} onChange={(e) => setPost((a) => ({ ...a, dataISO: e.target.value }))} className="vitrine-input" />
              </Campo>
              <Campo titulo="Exibir até">
                <input type="date" min={hoje} value={post.expiraEm} onChange={(e) => setPost((a) => ({ ...a, expiraEm: e.target.value }))} className="vitrine-input" />
              </Campo>
            </div>

            <PainelInventario inventario={inventario} carregando={consultandoInventario} />

            <Campo titulo="Título / chamada">
              <input type="text" maxLength={160} value={post.titulo} onChange={(e) => setPost((a) => ({ ...a, titulo: e.target.value }))} placeholder="Ex.: Ação especial Dia das Mães" className="vitrine-input" />
            </Campo>

            <Campo titulo="Sobre a oportunidade">
              <textarea
                maxLength={300}
                rows={4}
                value={post.descricao}
                onChange={(e) => setPost((a) => ({ ...a, descricao: e.target.value }))}
                placeholder="Conte brevemente por que esta oportunidade é relevante para as marcas."
                className="vitrine-input min-h-[108px] resize-y"
              />
              <p className="mt-1.5 text-right text-[11px] font-semibold text-[#9aa0a8]">{post.descricao.length}/300</p>
            </Campo>

            {erroPublicacao && <p className="rounded-[12px] bg-[#fdecef] px-4 py-3 text-[12px] font-semibold text-[#be123c]">{erroPublicacao}</p>}
            <button
              type="button"
              onClick={publicar}
              disabled={publicando || consultandoInventario || inventario.slotsLivres <= 0 || !post.titulo.trim() || !post.descricao.trim() || !post.categoriaId}
              className="vitrine-pop rounded-[14px] bg-[#14161a] p-[15px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {publicando ? 'Publicando…' : 'Publicar em Oportunidades'}
            </button>
          </div>

          <div className="lg:sticky lg:top-[92px]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[#9aa0a8]">Prévia do card</p>
            <Card oportunidade={preview} curtida={false} aoAbrir={() => {}} aoCurtir={() => {}} preview />
            <p className="mt-3 text-[11.5px] leading-[1.5] text-[#9aa0a8]">Data, programa e disponibilidade são atualizados automaticamente.</p>
          </div>
        </div>
      </div>
    )
  }

  if (tela === 'detalhe' && selecionada) {
    const tema = temaPara(selecionada.programaId)
    return (
      <div className="mx-auto max-w-[920px] px-5 pb-[70px] pt-6 sm:px-7">
        <button type="button" onClick={voltarAoFeed} className="mb-[16px] text-[13px] font-semibold text-[#6b7280]">← Voltar às oportunidades</button>
        <div className="grid items-start gap-[32px] md:grid-cols-[.82fr_1.18fr]">
          <Imagem oportunidade={selecionada} detalhe />
          <div className="pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="vitrine-pop rounded-full px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: tema.cor }}>{selecionada.programaNome}</span>
              <span className="vitrine-chip">{selecionada.categoriaNome}</span>
            </div>
            <h1 className="vitrine-pop mt-4 text-[33px] font-extrabold leading-[1.05] tracking-[-1px]">{selecionada.titulo}</h1>
            <p className="mt-[13px] text-[15px] leading-[1.55] text-[#5a606a]">{selecionada.descricao}</p>

            <div className="my-[20px] rounded-[16px] bg-white px-5 py-[17px] shadow-[0_6px_20px_-14px_rgba(20,22,26,.4)]">
              <div className="flex flex-wrap items-center gap-[22px]">
                <Stat valor={String(selecionada.slotsLivres)} rotulo="slots livres" cor={tema.cor} />
                <span className="h-[38px] w-px bg-[#eceef1]" />
                <Stat valor={String(curtidas[selecionada.id] ? 1 : 0)} rotulo="curtidas" />
                <button type="button" onClick={() => alternarCurtida(selecionada.id)} className="ml-auto rounded-full border-[1.5px] px-[18px] py-[10px] text-[14px] font-bold" style={{ borderColor: curtidas[selecionada.id] ? '#14161a' : '#d7dae0', background: curtidas[selecionada.id] ? '#14161a' : '#fff', color: curtidas[selecionada.id] ? '#fff' : '#14161a' }}>♥ Curtir</button>
              </div>
              {selecionada.setoresCompradores.length > 0 && (
                <div className="mt-4 border-t border-[#eceef1] pt-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-[.8px] text-[#9aa0a8]">Setores que já compraram nesta data</p>
                  <div className="mt-2 flex flex-wrap gap-2">{selecionada.setoresCompradores.map((setor) => <span key={setor} className="rounded-full bg-[#f2f3f5] px-3 py-1.5 text-[11.5px] font-semibold text-[#5a606a]">{setor}</span>)}</div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => router.push(`/consulta?programa=${encodeURIComponent(selecionada.programaId)}&data=${selecionada.dataISO}`)} className="vitrine-pop w-full rounded-[14px] bg-[#14161a] p-4 text-[16px] font-bold text-white">Gerar consulta →</button>
            <div className="mt-[14px] flex items-center gap-2.5 text-[13px] font-medium text-[#9aa0a8]"><span className="h-7 w-7 rounded-full" style={{ background: tema.gradiente }} />Postado por {selecionada.autor} · Consultor de programa</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-[1180px] px-5 pb-[70px] pt-[24px] sm:px-7">
      <div className="vitrine-pop pointer-events-none absolute right-[18px] top-[2px] hidden select-none text-[118px] font-extrabold leading-[.8] tracking-[-5px] text-[rgba(20,22,26,.03)] lg:block">2026</div>
      <section className="relative max-w-[700px]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[1.8px] text-[#ff5a3c]">Oportunidades de ação</p>
        <h1 className="vitrine-pop mt-1.5 text-[31px] font-extrabold leading-[1.03] tracking-[-1.15px] sm:text-[36px]">Descubra onde sua marca pode entrar</h1>
        <p className="mt-2 max-w-[650px] text-[13.5px] leading-[1.45] text-[#6b7280]">Ações comemorativas, sazonais e participações de talentos dos programas Globo. Veja os slots livres e transforme uma oportunidade em consulta.</p>
      </section>

      <div className="relative mb-[17px] mt-5 flex flex-wrap items-center gap-[8px]">
        <Filtro ativo={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas</Filtro>
        {categorias.map((categoria) => (
          <Filtro key={categoria.id} ativo={filtro === categoria.id} onClick={() => setFiltro(categoria.id)}>{categoria.nome}</Filtro>
        ))}
        <span className="ml-auto text-[11.5px] font-semibold text-[#6b7280]">ordenar: mais slots ▾</span>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[#cfd3d9] bg-white/60 px-6 py-14 text-center">
          <p className="vitrine-pop text-[17px] font-bold">Nenhuma oportunidade publicada</p>
          <p className="mt-1 text-[12.5px] text-[#8a909a]">As publicações ativas e dentro da data de exibição aparecerão aqui.</p>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtradas.map((oportunidade) => (
            <Card key={oportunidade.id} oportunidade={oportunidade} curtida={Boolean(curtidas[oportunidade.id])} aoAbrir={() => abrir(oportunidade)} aoCurtir={() => alternarCurtida(oportunidade.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PainelInventario({ inventario, carregando }: { inventario: InventarioDaOportunidade; carregando: boolean }) {
  if (carregando) return <div className="rounded-[14px] border border-[#e1e4e8] bg-white px-4 py-4 text-[12px] font-semibold text-[#8a909a]">Consultando inventário da data…</div>
  if (inventario.erro) return <div className="rounded-[14px] bg-[#fdecef] px-4 py-4 text-[12px] font-semibold text-[#be123c]">{inventario.erro}</div>
  return (
    <div className="rounded-[14px] border border-[#e1e4e8] bg-white px-4 py-4">
      <div className="flex items-end gap-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.8px] text-[#9aa0a8]">Inventário da data</p><p className="vitrine-pop mt-1 text-[23px] font-extrabold">{inventario.slotsLivres} <span className="text-[12px] font-semibold text-[#8a909a]">de {inventario.slotsTotal} livres</span></p></div>
        <p className="mb-1 text-[11.5px] font-semibold text-[#8a909a]">{inventario.slotsOcupados} ocupados</p>
      </div>
      {inventario.setoresCompradores.length > 0 && <div className="mt-3 border-t border-[#eceef1] pt-3"><p className="text-[10px] font-bold uppercase tracking-[.7px] text-[#9aa0a8]">Setores que já compraram</p><div className="mt-2 flex flex-wrap gap-1.5">{inventario.setoresCompradores.map((setor) => <span key={setor} className="rounded-full bg-[#f2f3f5] px-2.5 py-1 text-[11px] font-semibold text-[#5a606a]">{setor}</span>)}</div></div>}
    </div>
  )
}

function Card({ oportunidade, curtida, aoAbrir, aoCurtir, preview = false }: { oportunidade: OportunidadePublicada; curtida: boolean; aoAbrir: () => void; aoCurtir: () => void; preview?: boolean }) {
  return (
    <article onClick={preview ? undefined : aoAbrir} className={`${preview ? '' : 'vitrine-card cursor-pointer'} overflow-hidden rounded-[18px] bg-white shadow-[0_6px_18px_-13px_rgba(20,22,26,.28)]`}>
      <Imagem oportunidade={oportunidade} />
      <div className="p-[12px] pb-[13px]">
        <h2 className="vitrine-pop line-clamp-2 text-[14px] font-bold leading-[1.18] tracking-[-.25px]">{oportunidade.titulo}</h2>
        <p className="mt-[4px] text-[11.5px] font-medium text-[#9aa0a8]">{oportunidade.slotsLivres} de {oportunidade.slotsTotal} livres</p>
        <div className="mt-[10px] flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); if (!preview) aoCurtir() }} className="rounded-full border-[1.5px] px-2.5 py-1 text-[11.5px] font-bold" style={{ borderColor: curtida ? '#14161a' : '#d7dae0', background: curtida ? '#14161a' : '#fff', color: curtida ? '#fff' : '#14161a' }}>♥ {curtida ? 1 : 0}</button>
          <span className="ml-auto truncate text-[11px] font-semibold text-[#b6bbc3]">{oportunidade.categoriaNome}</span>
        </div>
      </div>
    </article>
  )
}

function Imagem({ oportunidade, detalhe = false }: { oportunidade: OportunidadePublicada; detalhe?: boolean }) {
  const slot = slotVisual(oportunidade.slotsLivres)
  const tema = temaPara(oportunidade.programaId)
  return (
    <div className={`relative overflow-hidden bg-cover bg-center ${detalhe ? 'aspect-[4/5] rounded-[20px] shadow-[0_22px_44px_-24px_rgba(20,22,26,.45)]' : 'aspect-[6/5]'}`} style={{ background: oportunidade.imagem ? undefined : tema.gradiente, backgroundImage: oportunidade.imagem ? `url(${oportunidade.imagem})` : undefined }}>
      {!oportunidade.imagem && <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/70">imagem do programa</div>}
      <div className="vitrine-pop absolute left-[9px] top-[9px] flex max-w-[calc(100%-18px)] items-center gap-1.5 rounded-[8px] bg-[rgba(20,22,26,.53)] px-[8px] py-[4px] text-[9.5px] font-bold text-white backdrop-blur-sm"><span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: tema.cor }} /><span className="truncate">{dataCurta(oportunidade.dataISO)} · {oportunidade.programaNome}</span></div>
      {!detalhe && <div className="vitrine-pop absolute bottom-[9px] right-[9px] rounded-[8px] border-[1.5px] px-[8px] py-[4px] text-[9.5px] font-bold" style={{ background: slot.bg, color: slot.fg, borderColor: slot.borda }}>{slot.texto}</div>}
    </div>
  )
}

function Filtro({ ativo, children, onClick }: { ativo: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border-[1.5px] px-[13px] py-[6px] text-[11.5px] font-semibold ${ativo ? 'border-[#14161a] bg-[#14161a] text-white' : 'border-[#d7dae0] bg-white text-[#6b7280] hover:border-[#14161a] hover:text-[#14161a]'}`}>{children}</button>
}
function Campo({ titulo, apoio, children }: { titulo: string; apoio?: string; children: React.ReactNode }) {
  return <div><p className="vitrine-pop mb-2 text-[13px] font-bold">{titulo} {apoio && <span className="font-semibold text-[#9aa0a8]">({apoio})</span>}</p>{children}</div>
}
function Stat({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return <div><p className="vitrine-pop text-[28px] font-extrabold leading-none" style={{ color: cor ?? '#14161a' }}>{valor}</p><p className="mt-1 text-[12px] font-semibold text-[#9aa0a8]">{rotulo}</p></div>
}
