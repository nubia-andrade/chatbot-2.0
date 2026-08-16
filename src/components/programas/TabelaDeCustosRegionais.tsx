'use client'

import { useMemo, useState } from 'react'
import { salvarPrecos, type EntradaDePreco } from '@/lib/acoes/regional'
import { PRACAS } from '@/lib/dominio/regional'
import { calcularDireitosTv, calcularDireitosDigital } from '@/lib/dominio/direitos-e-conexos'
import { calcularCustoDaAcaoRegional } from '@/lib/dominio/custo-da-acao-regional'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'

export type PrecoDePraca = {
  praca_codigo: string
  custo_midia_tv: number
  percentual_simulcast: number | null
  custo_midia_digital: number | null
  atualizado_em: string
}

/** Um dos três campos de dinheiro/percentual editáveis por praça. */
type Campo = 'custo_midia_tv' | 'percentual_simulcast' | 'custo_midia_digital'

type Rascunho = Record<Campo, string>

function rascunhoDaPraca(preco: PrecoDePraca): Rascunho {
  return {
    custo_midia_tv: formatarMoeda(preco.custo_midia_tv),
    percentual_simulcast: formatarMoeda(preco.percentual_simulcast),
    custo_midia_digital: formatarMoeda(preco.custo_midia_digital),
  }
}

function formatarDataHoraBR(iso: string): string {
  if (!iso) return 'Nunca atualizado'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return 'Nunca atualizado'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Custos regionais por praça.
 *
 * Uma linha por praça: mídia de TV, % simulcast, mídia digital, e os dois
 * direitos e conexos — TV e digital —, calculados aqui (nunca digitados,
 * `direitos-e-conexos.ts`) e recalculados a cada tecla, igual ao bloco
 * nacional do cadastro.
 *
 * A produção NÃO aparece mais por praça: é única por PROGRAMA
 * (`custoProducaoRegional`, cadastrada no formulário do programa) — decisão
 * da área, um cliente que compra 3 praças paga a produção uma vez, não três
 * (`src/lib/dominio/custo-da-acao-regional.ts`).
 *
 * Os campos digitais ficam opcionais de propósito: a área ainda não
 * confirmou quais praças vendem digital.
 */
export function TabelaDeCustosRegionais({
  programaId,
  precosIniciais,
  custoProducaoRegional,
}: {
  programaId: string
  precosIniciais: PrecoDePraca[]
  /** `programas.custo_producao_regional` — única por programa, somada uma vez no total. */
  custoProducaoRegional: number | null
}) {
  const [precos, setPrecos] = useState(precosIniciais)
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>(() =>
    Object.fromEntries(precosIniciais.map((preco) => [preco.praca_codigo, rascunhoDaPraca(preco)])),
  )
  const [pracasDoCalculo, setPracasDoCalculo] = useState<string[]>([])
  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [sujo, setSujo] = useState(false)

  function mudarCampo(praca: string, campo: Campo, valor: string) {
    setRascunhos((atual) => ({ ...atual, [praca]: { ...atual[praca], [campo]: valor } }))
    setSujo(true)
    setSucesso(null)
  }

  function normalizarAoSairDoFoco(praca: string, campo: Campo) {
    setRascunhos((atual) => ({
      ...atual,
      [praca]: { ...atual[praca], [campo]: formatarMoeda(paraNumero(atual[praca][campo])) },
    }))
  }

  function alternarPracaDoCalculo(praca: string) {
    setPracasDoCalculo((atual) => (atual.includes(praca) ? atual.filter((p) => p !== praca) : [...atual, praca]))
  }

  async function salvar() {
    setGravando(true)
    setErros([])
    setSucesso(null)

    const entradas: EntradaDePreco[] = PRACAS.map((praca) => {
      const rascunho = rascunhos[praca]
      return {
        praca_codigo: praca,
        custo_midia_tv: paraNumero(rascunho.custo_midia_tv) ?? 0,
        percentual_simulcast: paraNumero(rascunho.percentual_simulcast),
        custo_midia_digital: paraNumero(rascunho.custo_midia_digital),
      }
    })
    const resultado = await salvarPrecos(programaId, entradas)

    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      return
    }

    const agora = new Date().toISOString()
    setPrecos(entradas.map((entrada) => ({ ...entrada, atualizado_em: agora })))
    setSucesso('Custos salvos.')
    setSujo(false)
  }

  // Total da ação: soma, das praças marcadas, o que já está salvo (não o
  // rascunho não gravado) — mídia TV + direitos de TV calculados por praça,
  // mais a produção regional somada UMA vez (não por praça — decisão da
  // área, `calcularCustoDaAcaoRegional`). O digital fica fora da soma
  // porque a venda regional, hoje, é uma venda de TV.
  const totalDaAcao = useMemo(
    () => calcularCustoDaAcaoRegional(pracasDoCalculo, precos, custoProducaoRegional),
    [pracasDoCalculo, precos, custoProducaoRegional],
  )

  return (
    <section
      className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
      style={{ background: 'var(--superficie)' }}
    >
      <AvisoDeSaida ativo={sujo} />
      <h3 className="text-[14px] font-bold text-[var(--texto)]">Custos por praça</h3>

      <p
        role="note"
        className="mt-2 rounded-[10px] px-3 py-2 text-[12px] font-semibold"
        style={{ background: 'var(--prazo-fundo)', color: 'var(--prazo)' }}
      >
        Valores pendentes de confirmação com Pricing.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {PRACAS.map((praca) => (
          <LinhaDaPraca
            key={praca}
            praca={praca}
            rascunho={rascunhos[praca]}
            atualizadoEm={precos.find((p) => p.praca_codigo === praca)?.atualizado_em ?? ''}
            noCalculo={pracasDoCalculo.includes(praca)}
            aoAlternarCalculo={() => alternarPracaDoCalculo(praca)}
            aoMudarCampo={(campo, valor) => mudarCampo(praca, campo, valor)}
            aoSairDoFoco={(campo) => normalizarAoSairDoFoco(praca, campo)}
          />
        ))}
      </div>

      {erros.length > 0 && (
        <ul role="alert" className="mt-3 flex flex-col gap-1">
          {erros.map((erro) => (
            <li key={erro} className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
              {erro}
            </li>
          ))}
        </ul>
      )}
      {sucesso && (
        <p role="status" className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--disponivel)' }}>
          {sucesso}
        </p>
      )}

      <BotaoDeGravacao type="button" gravando={gravando} onClick={salvar} className="mt-4">
        Salvar custos
      </BotaoDeGravacao>

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] p-3"
        style={{ background: 'var(--superficie-suave)' }}
      >
        <span className="text-[12.5px] font-semibold text-[var(--texto-2)]">
          Total da ação (TV) {pracasDoCalculo.length > 0 ? `(${pracasDoCalculo.join(', ')})` : '(marque as praças abaixo)'}
        </span>
        <span className="text-[17px] font-bold text-[var(--texto)]">R$ {formatarMoeda(totalDaAcao)}</span>
      </div>
    </section>
  )
}

function CampoDePraca({
  rotulo,
  id,
  valor,
  aoMudar,
  aoSairDoFoco,
}: {
  rotulo: string
  id: string
  valor: string
  aoMudar: (valor: string) => void
  aoSairDoFoco: () => void
}) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-[11px] font-semibold text-[var(--texto-3)]">{rotulo}</span>
      <input
        id={id}
        type="text"
        value={valor ?? ''}
        placeholder="0,00"
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={aoSairDoFoco}
        className="h-[36px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-2.5 text-[12.5px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
      />
    </label>
  )
}

function CampoCalculado({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--texto-3)]">{rotulo}</span>
      <div
        title="Calculado automaticamente a partir da mídia e do simulcast — não é editável."
        className="flex h-[36px] items-center rounded-[var(--raio-campo)] border border-dashed px-2.5 text-[12.5px] font-semibold"
        style={{ borderColor: 'var(--reservado)', color: 'var(--reservado)', background: 'var(--reservado-fundo)' }}
      >
        {valor !== null ? `R$ ${formatarMoeda(valor)}` : '—'}
      </div>
    </div>
  )
}

function LinhaDaPraca({
  praca,
  rascunho,
  atualizadoEm,
  noCalculo,
  aoAlternarCalculo,
  aoMudarCampo,
  aoSairDoFoco,
}: {
  praca: string
  rascunho: Rascunho
  atualizadoEm: string
  noCalculo: boolean
  aoAlternarCalculo: () => void
  aoMudarCampo: (campo: Campo, valor: string) => void
  aoSairDoFoco: (campo: Campo) => void
}) {
  const direitosTv = calcularDireitosTv(paraNumero(rascunho.custo_midia_tv), paraNumero(rascunho.percentual_simulcast))
  const direitosDigital = calcularDireitosDigital(paraNumero(rascunho.custo_midia_digital))

  return (
    <div className="rounded-[10px] border border-[var(--borda)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={noCalculo}
            onChange={aoAlternarCalculo}
            aria-label={`Incluir ${praca} no total da ação`}
            className="h-4 w-4 cursor-pointer accent-[#7A2FF2]"
          />
          <span className="text-[13.5px] font-bold text-[var(--texto)]">{praca}</span>
        </label>
        <span className="text-[11px] text-[var(--texto-3)]">Atualizado em {formatarDataHoraBR(atualizadoEm)}</span>
      </div>

      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">TV</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <CampoDePraca
          rotulo="Mídia TV"
          id={`${praca}-midia-tv`}
          valor={rascunho.custo_midia_tv}
          aoMudar={(valor) => aoMudarCampo('custo_midia_tv', valor)}
          aoSairDoFoco={() => aoSairDoFoco('custo_midia_tv')}
        />
        <CampoDePraca
          rotulo="% Simulcast"
          id={`${praca}-simulcast`}
          valor={rascunho.percentual_simulcast}
          aoMudar={(valor) => aoMudarCampo('percentual_simulcast', valor)}
          aoSairDoFoco={() => aoSairDoFoco('percentual_simulcast')}
        />
        <CampoCalculado rotulo="Direitos e conexos TV" valor={direitosTv} />
      </div>

      <div className="mb-1 mt-3 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">
        Digital <span className="font-normal normal-case text-[var(--texto-3)]">(opcional)</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoDePraca
          rotulo="Mídia digital"
          id={`${praca}-midia-digital`}
          valor={rascunho.custo_midia_digital}
          aoMudar={(valor) => aoMudarCampo('custo_midia_digital', valor)}
          aoSairDoFoco={() => aoSairDoFoco('custo_midia_digital')}
        />
        <CampoCalculado rotulo="Direitos e conexos digital" valor={direitosDigital} />
      </div>
    </div>
  )
}
