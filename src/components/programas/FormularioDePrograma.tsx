'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarPrograma } from '@/lib/acoes/programas'
import { enviarImagemDePrograma } from '@/lib/acoes/imagens'
import type { EstadoDoPrograma, Programa } from '@/lib/dominio/cadastro'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'
import { urlDeImagemSegura } from '@/lib/seguranca/url-imagem'
import { AvisoDeSaida, useNavegacaoSegura } from '@/components/comum/AvisoDeSaida'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'
import { BlocoDeCustos, rascunhoDeCustosInicial, type RascunhoDeCustos } from './BlocoDeCustos'

const ROTULOS_ESTADO: Record<EstadoDoPrograma, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_configuracao: 'Em configuração',
}

const DIAS_DA_SEMANA = [
  { valor: 0, rotulo: 'Dom' },
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
]

type Rascunho = {
  nome: string
  mnemonico: string
  imagem_url: string
  canal: string
  estado: EstadoDoPrograma
  dias_da_semana: number[]
  slots: string
  prazo_minimo_dias: string
  bloqueio_mensal: string
  acoes_minimas: string
  acoes_maximas: string
  disponivel_para_proposta: boolean
  possui_fluxo_aprovacao: boolean
  contem_digital: boolean
  redes_sociais: boolean
  aceita_regional: boolean
  dia_da_semana_regional: string
  prazo_minimo_regional_dias: string
  max_pracas_por_acao: string
  custo_producao_regional: string
  bloqueio_mensal_regional: string
} & RascunhoDeCustos

function rascunhoInicial(programa: Programa | null): Rascunho {
  return {
    nome: programa?.nome ?? '',
    mnemonico: programa?.mnemonico ?? '',
    imagem_url: programa?.imagem_url ?? '',
    canal: programa?.canal ?? '',
    estado: programa?.estado ?? 'em_configuracao',
    dias_da_semana: programa?.dias_da_semana ?? [],
    slots: programa ? String(programa.slots) : '1',
    prazo_minimo_dias: programa ? String(programa.prazo_minimo_dias) : '0',
    bloqueio_mensal: programa ? String(programa.bloqueio_mensal) : '0',
    acoes_minimas: programa ? String(programa.acoes_minimas) : '1',
    acoes_maximas: programa ? String(programa.acoes_maximas) : '1',
    disponivel_para_proposta: programa?.disponivel_para_proposta ?? false,
    ...rascunhoDeCustosInicial(programa),
    possui_fluxo_aprovacao: programa?.possui_fluxo_aprovacao ?? false,
    contem_digital: programa?.contem_digital ?? false,
    redes_sociais: programa?.redes_sociais ?? false,
    aceita_regional: programa?.aceita_regional ?? false,
    dia_da_semana_regional: programa?.dia_da_semana_regional != null ? String(programa.dia_da_semana_regional) : '',
    prazo_minimo_regional_dias: programa?.prazo_minimo_regional_dias != null ? String(programa.prazo_minimo_regional_dias) : '',
    max_pracas_por_acao: programa ? String(programa.max_pracas_por_acao) : '3',
    custo_producao_regional: formatarMoeda(programa?.custo_producao_regional),
    bloqueio_mensal_regional: programa?.bloqueio_mensal_regional != null ? String(programa.bloqueio_mensal_regional) : '',
  }
}

function numeroOuIndefinido(texto: string): number | undefined {
  const limpo = texto.trim()
  if (!limpo) return undefined
  const valor = Number(limpo)
  return Number.isNaN(valor) ? undefined : valor
}

function paraPrograma(id: string | undefined, rascunho: Rascunho): Partial<Programa> {
  return {
    ...(id ? { id } : {}),
    nome: rascunho.nome,
    mnemonico: rascunho.mnemonico,
    imagem_url: rascunho.imagem_url.trim() || null,
    canal: rascunho.canal,
    estado: rascunho.estado,
    dias_da_semana: rascunho.dias_da_semana,
    slots: numeroOuIndefinido(rascunho.slots),
    prazo_minimo_dias: numeroOuIndefinido(rascunho.prazo_minimo_dias),
    bloqueio_mensal: numeroOuIndefinido(rascunho.bloqueio_mensal),
    acoes_minimas: numeroOuIndefinido(rascunho.acoes_minimas),
    acoes_maximas: numeroOuIndefinido(rascunho.acoes_maximas),
    disponivel_para_proposta: rascunho.disponivel_para_proposta,
    custo_midia_tv: paraNumero(rascunho.custo_midia_tv),
    custo_producao_tv: paraNumero(rascunho.custo_producao_tv),
    percentual_simulcast: paraNumero(rascunho.percentual_simulcast),
    custo_midia_digital: paraNumero(rascunho.custo_midia_digital),
    custo_producao_digital: paraNumero(rascunho.custo_producao_digital),
    custo_midia_redes_sociais: paraNumero(rascunho.custo_midia_redes_sociais),
    custo_producao_redes_sociais: paraNumero(rascunho.custo_producao_redes_sociais),
    possui_fluxo_aprovacao: rascunho.possui_fluxo_aprovacao,
    contem_digital: rascunho.contem_digital,
    redes_sociais: rascunho.redes_sociais,
    aceita_regional: rascunho.aceita_regional,
    dia_da_semana_regional: rascunho.aceita_regional ? (numeroOuIndefinido(rascunho.dia_da_semana_regional) ?? null) : null,
    prazo_minimo_regional_dias: rascunho.aceita_regional ? (numeroOuIndefinido(rascunho.prazo_minimo_regional_dias) ?? null) : null,
    max_pracas_por_acao: numeroOuIndefinido(rascunho.max_pracas_por_acao) ?? 3,
    custo_producao_regional: rascunho.aceita_regional ? paraNumero(rascunho.custo_producao_regional) : null,
    bloqueio_mensal_regional: rascunho.aceita_regional ? (numeroOuIndefinido(rascunho.bloqueio_mensal_regional) ?? null) : null,
  }
}

export function FormularioDePrograma({ programa }: { programa: Programa | null }) {
  const router = useRouter()
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoInicial(programa))
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const navegar = useNavegacaoSegura(sujo)

  function mudar<C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    setSujo(true)
  }

  function alternarDia(dia: number) {
    setRascunho((atual) => ({
      ...atual,
      dias_da_semana: atual.dias_da_semana.includes(dia)
        ? atual.dias_da_semana.filter((d) => d !== dia)
        : [...atual.dias_da_semana, dia].sort((a, b) => a - b),
    }))
    setSujo(true)
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    if (salvando) return
    setSalvando(true)
    setErros([])

    const resultado = await salvarPrograma(paraPrograma(programa?.id, rascunho))
    setSalvando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      return
    }

    setSujo(false)
    if (!programa && resultado.id) router.push(`/configuracoes/programas/${resultado.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6 rounded-[var(--raio-card)] border border-[var(--borda)] p-6" style={{ background: 'var(--superficie)' }}>
      <AvisoDeSaida ativo={sujo} />

      {erros.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-[10px] border px-4 py-3 text-[13px] font-semibold" style={{ color: 'var(--concorrencia)', background: 'var(--concorrencia-fundo)', borderColor: 'var(--concorrencia)' }}>
          {erros.map((erro) => <li key={erro}>{erro}</li>)}
        </ul>
      )}

      <BlocoIdentificacao rascunho={rascunho} mudar={mudar} />
      <BlocoExibicao rascunho={rascunho} mudar={mudar} alternarDia={alternarDia} />
      <BlocoRegrasDeProposta rascunho={rascunho} mudar={mudar} />
      <BlocoDeCustos rascunho={rascunho} mudar={mudar} />
      <BlocoMarcadores rascunho={rascunho} mudar={mudar} />
      <BlocoRegional rascunho={rascunho} mudar={mudar} />

      <div className="flex flex-wrap gap-3 border-t border-[var(--borda)] pt-5">
        <BotaoDeGravacao gravando={salvando}>{programa ? 'Salvar alterações' : 'Cadastrar programa'}</BotaoDeGravacao>
        <button type="button" disabled={salvando} onClick={() => navegar('/configuracoes/programas')} className="h-[44px] rounded-[12px] border border-[var(--borda-forte)] px-5 text-[13.5px] font-semibold text-[var(--texto-2)] enabled:cursor-pointer disabled:opacity-60">Cancelar</button>
      </div>
    </form>
  )
}

type PropsDoBloco = {
  rascunho: Rascunho
  mudar: <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) => void
}

function TituloDoBloco({ texto }: { texto: string }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--texto-3)]">{texto}</h2>
}

function Campo({ rotulo, valor, aoMudar, aoSairDoFoco, tipo = 'text', placeholder, ajuda }: { rotulo: string; valor: string; aoMudar: (valor: string) => void; aoSairDoFoco?: () => void; tipo?: 'text' | 'number'; placeholder?: string; ajuda?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">{rotulo}</span>
      <input type={tipo} value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} onBlur={aoSairDoFoco} className="h-[40px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]" />
      {ajuda && <span className="text-[11.5px] text-[var(--texto-3)]">{ajuda}</span>}
    </label>
  )
}

function CampoDeImagem({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivo: File) {
    setEnviando(true)
    setErro(null)
    const formulario = new FormData()
    formulario.append('arquivo', arquivo)
    const resultado = await enviarImagemDePrograma(formulario)
    setEnviando(false)
    if (entrada.current) entrada.current.value = ''
    if (resultado.erro) return setErro(resultado.erro)
    if (resultado.url) aoMudar(resultado.url)
  }

  const url = urlDeImagemSegura(valor)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">Imagem do programa</span>
      <div className="flex flex-wrap items-center gap-3">
        <div aria-hidden className="h-[56px] w-[92px] shrink-0 rounded-[10px] border border-[var(--borda-forte)]" style={{ background: url ? `center / cover no-repeat url("${url}")` : 'var(--superficie-suave)' }} />
        <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={(e) => { const arquivo = e.target.files?.[0]; if (arquivo) void enviar(arquivo) }} />
        <button type="button" disabled={enviando} onClick={() => entrada.current?.click()} className="h-[40px] rounded-[10px] border border-[var(--borda-forte)] px-4 text-[12.5px] font-bold text-[var(--roxo)] enabled:cursor-pointer disabled:opacity-60">{enviando ? 'Enviando…' : valor.trim() ? 'Trocar imagem' : 'Enviar imagem'}</button>
        {valor.trim() && !enviando ? <button type="button" onClick={() => aoMudar('')} className="h-[40px] cursor-pointer px-1 text-[12.5px] font-semibold text-[var(--texto-3)]">Remover</button> : null}
      </div>
      {erro && <p role="alert" className="text-[12px] font-semibold" style={{ color: 'var(--concorrencia)' }}>{erro}</p>}
      <Campo rotulo="Ou cole a URL de uma imagem já hospedada" valor={valor} placeholder="https://…" aoMudar={aoMudar} />
    </div>
  )
}

function Marcador({ rotulo, descricao, marcado, aoMudar }: { rotulo: string; descricao: string; marcado: boolean; aoMudar: (valor: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 rounded-[10px] border border-[var(--borda)] p-3">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} className="mt-0.5 h-[16px] w-[16px] cursor-pointer accent-[#7A2FF2]" />
      <span><span className="block text-[12.5px] font-semibold text-[var(--texto)]">{rotulo}</span><span className="mt-0.5 block text-[11.5px] text-[var(--texto-3)]">{descricao}</span></span>
    </label>
  )
}

function BlocoIdentificacao({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3">
      <TituloDoBloco texto="Identificação" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome do programa" valor={rascunho.nome} aoMudar={(v) => mudar('nome', v)} />
        <Campo rotulo="Mnemônico" valor={rascunho.mnemonico} placeholder="Ex.: MAVO" aoMudar={(v) => mudar('mnemonico', v)} />
        <Campo rotulo="Canal" valor={rascunho.canal} placeholder="Ex.: TV Globo" aoMudar={(v) => mudar('canal', v)} />
        <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-[var(--texto-2)]">Estado</span><select value={rascunho.estado} onChange={(e) => mudar('estado', e.target.value as EstadoDoPrograma)} className="h-[40px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)]">{Object.entries(ROTULOS_ESTADO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
        <div className="sm:col-span-2"><CampoDeImagem valor={rascunho.imagem_url} aoMudar={(v) => mudar('imagem_url', v)} /></div>
      </div>
    </fieldset>
  )
}

function BlocoExibicao({ rascunho, mudar, alternarDia }: PropsDoBloco & { alternarDia: (dia: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Exibição" />
      <div><span className="text-[12px] font-semibold text-[var(--texto-2)]">Dias de exibição</span><div className="mt-1.5 flex flex-wrap gap-2">{DIAS_DA_SEMANA.map((dia) => { const marcado = rascunho.dias_da_semana.includes(dia.valor); return <button key={dia.valor} type="button" aria-pressed={marcado} onClick={() => alternarDia(dia.valor)} className="h-[36px] w-[52px] cursor-pointer rounded-[10px] border text-[12.5px] font-bold" style={marcado ? { borderColor: 'var(--roxo)', background: 'rgba(122,47,242,.1)', color: 'var(--roxo)' } : { borderColor: 'var(--borda-forte)', color: 'var(--texto-3)' }}>{dia.rotulo}</button> })}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><Campo rotulo="Slots por data" tipo="number" valor={rascunho.slots} aoMudar={(v) => mudar('slots', v)} ajuda="Quantas ações de conteúdo cabem num mesmo dia." /><Campo rotulo="Prazo mínimo (dias)" tipo="number" valor={rascunho.prazo_minimo_dias} aoMudar={(v) => mudar('prazo_minimo_dias', v)} ajuda="Antecedência mínima para fechamento." /></div>
    </fieldset>
  )
}

function BlocoRegrasDeProposta({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Regras de proposta" />
      <div className="grid gap-3 sm:grid-cols-3"><Campo rotulo="Bloqueio mensal" tipo="number" valor={rascunho.bloqueio_mensal} aoMudar={(v) => mudar('bloqueio_mensal', v)} ajuda="Limite mensal do anunciante neste programa." /><Campo rotulo="Ações mínimas" tipo="number" valor={rascunho.acoes_minimas} aoMudar={(v) => mudar('acoes_minimas', v)} /><Campo rotulo="Ações máximas" tipo="number" valor={rascunho.acoes_maximas} aoMudar={(v) => mudar('acoes_maximas', v)} /></div>
      <Marcador rotulo="Disponível para proposta" descricao="Programas disponíveis exigem custos de TV preenchidos." marcado={rascunho.disponivel_para_proposta} aoMudar={(v) => mudar('disponivel_para_proposta', v)} />
    </fieldset>
  )
}

function BlocoMarcadores({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Marcadores" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Marcador rotulo="Possui fluxo de aprovação" descricao="Passa por aprovação antes de sair." marcado={rascunho.possui_fluxo_aprovacao} aoMudar={(v) => mudar('possui_fluxo_aprovacao', v)} />
        <Marcador rotulo="Contém digital" descricao="Libera Digital como complemento no calendário." marcado={rascunho.contem_digital} aoMudar={(v) => mudar('contem_digital', v)} />
        <Marcador rotulo="Redes sociais" descricao="Libera Redes Sociais como complemento no calendário." marcado={rascunho.redes_sociais} aoMudar={(v) => mudar('redes_sociais', v)} />
        <Marcador rotulo="Aceita regional" descricao="Libera ações locais por praça." marcado={rascunho.aceita_regional} aoMudar={(v) => mudar('aceita_regional', v)} />
      </div>
    </fieldset>
  )
}

function BlocoRegional({ rascunho, mudar }: PropsDoBloco) {
  if (!rascunho.aceita_regional) return null
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Regional" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="text-[12px] font-semibold text-[var(--texto-2)]">Dia da semana da ação regional</span><select value={rascunho.dia_da_semana_regional} onChange={(e) => mudar('dia_da_semana_regional', e.target.value)} className="h-[40px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)]"><option value="">Selecione…</option>{DIAS_DA_SEMANA.map((dia) => <option key={dia.valor} value={dia.valor}>{dia.rotulo}</option>)}</select></label>
        <Campo rotulo="Prazo mínimo regional (dias)" tipo="number" valor={rascunho.prazo_minimo_regional_dias} aoMudar={(v) => mudar('prazo_minimo_regional_dias', v)} />
        <Campo rotulo="Máximo de praças por ação" tipo="number" valor={rascunho.max_pracas_por_acao} aoMudar={(v) => mudar('max_pracas_por_acao', v)} />
        <Campo rotulo="Custo de produção regional" valor={rascunho.custo_producao_regional} aoMudar={(v) => mudar('custo_producao_regional', v)} aoSairDoFoco={() => mudar('custo_producao_regional', formatarMoeda(paraNumero(rascunho.custo_producao_regional)))} ajuda="Único para a ação inteira; não multiplica pelo número de praças." />
        <Campo rotulo="Bloqueio mensal regional" tipo="number" valor={rascunho.bloqueio_mensal_regional} aoMudar={(v) => mudar('bloqueio_mensal_regional', v)} />
      </div>
    </fieldset>
  )
}
