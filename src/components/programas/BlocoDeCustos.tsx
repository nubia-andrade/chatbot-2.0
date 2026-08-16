'use client'

import { calcularDireitosTv, calcularDireitosDigital } from '@/lib/dominio/direitos-e-conexos'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'

/** O pedaço do rascunho do formulário de programa que este bloco lê e escreve. */
export type RascunhoDeCustos = {
  custo_midia_tv: string
  custo_producao_tv: string
  percentual_simulcast: string
  custo_midia_digital: string
  custo_producao_digital: string
}

export function rascunhoDeCustosInicial(programa: {
  custo_midia_tv?: number | null
  custo_producao_tv?: number | null
  percentual_simulcast?: number | null
  custo_midia_digital?: number | null
  custo_producao_digital?: number | null
} | null): RascunhoDeCustos {
  return {
    custo_midia_tv: formatarMoeda(programa?.custo_midia_tv),
    custo_producao_tv: formatarMoeda(programa?.custo_producao_tv),
    percentual_simulcast: formatarMoeda(programa?.percentual_simulcast),
    custo_midia_digital: formatarMoeda(programa?.custo_midia_digital),
    custo_producao_digital: formatarMoeda(programa?.custo_producao_digital),
  }
}

function TituloDoBloco({ texto }: { texto: string }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--texto-3)]">
      {texto}
    </h2>
  )
}

function CampoDeMoeda({
  rotulo,
  valor,
  aoMudar,
  ajuda,
}: {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  ajuda?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">{rotulo}</span>
      <input
        type="text"
        value={valor}
        placeholder="0,00"
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={() => aoMudar(formatarMoeda(paraNumero(valor)))}
        className="h-[40px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />
      {ajuda && <span className="text-[11.5px] text-[var(--texto-3)]">{ajuda}</span>}
    </label>
  )
}

/**
 * Campo de "direitos e conexos": nunca digitado, sempre resultado da fórmula
 * (`direitos-e-conexos.ts`), recalculado a cada tecla porque lê direto do
 * rascunho — não guarda estado próprio. O contorno tracejado e o token
 * `--reservado` marcam visualmente "isto é calculado", para não parecer um
 * campo obrigatório que a pessoa esqueceu de preencher.
 */
function CampoCalculado({ rotulo, valor, explicacao }: { rotulo: string; valor: number | null; explicacao: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">{rotulo}</span>
      <div
        title={explicacao}
        className="flex h-[40px] items-center justify-between gap-2 rounded-[var(--raio-campo)] border border-dashed px-3 text-[13.5px] font-semibold"
        style={{ borderColor: 'var(--reservado)', color: 'var(--reservado)', background: 'var(--reservado-fundo)' }}
      >
        <span>{valor !== null ? `R$ ${formatarMoeda(valor)}` : 'Preencha a mídia para calcular'}</span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.05em]">Calculado</span>
      </div>
      <span className="text-[11.5px] text-[var(--texto-3)]">{explicacao}</span>
    </div>
  )
}

/**
 * Bloco Custos — reestruturado na Entrega 3: nacional TV e nacional Digital
 * lado a lado, cada um com "direitos e conexos" calculado ao vivo (nunca
 * digitado) a partir da mídia e, só na TV, do simulcast.
 *
 * Digital fica opcional de propósito — a área ainda não confirmou quais
 * praças vendem digital, então nada aqui é validado como obrigatório.
 *
 * Os custos REGIONAIS (por praça) não moram mais neste formulário: vivem na
 * aba Regional (`TabelaDeCustosRegionais`), porque passaram a variar por
 * praça em vez de ter um valor único por programa.
 */
export function BlocoDeCustos({
  rascunho,
  mudar,
}: {
  rascunho: RascunhoDeCustos
  mudar: <C extends keyof RascunhoDeCustos>(campo: C, valor: RascunhoDeCustos[C]) => void
}) {
  const direitosTv = calcularDireitosTv(paraNumero(rascunho.custo_midia_tv), paraNumero(rascunho.percentual_simulcast))
  const direitosDigital = calcularDireitosDigital(paraNumero(rascunho.custo_midia_digital))

  return (
    <fieldset className="flex flex-col gap-5 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Custos nacionais" />

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">TV</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDeMoeda
            rotulo="Custo de mídia TV"
            valor={rascunho.custo_midia_tv}
            aoMudar={(valor) => mudar('custo_midia_tv', valor)}
          />
          <CampoDeMoeda
            rotulo="Custo de produção TV"
            valor={rascunho.custo_producao_tv}
            aoMudar={(valor) => mudar('custo_producao_tv', valor)}
          />
          <CampoDeMoeda
            rotulo="% Simulcast"
            valor={rascunho.percentual_simulcast}
            aoMudar={(valor) => mudar('percentual_simulcast', valor)}
            ajuda="Valor cobrado pela replicação da exibição no Globoplay."
          />
          <CampoCalculado
            rotulo="Direitos e conexos (TV)"
            valor={direitosTv}
            explicacao="15% da mídia de TV, já somado o simulcast."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--borda)] pt-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">
          Digital <span className="font-normal normal-case text-[var(--texto-3)]">(opcional)</span>
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDeMoeda
            rotulo="Custo de mídia digital"
            valor={rascunho.custo_midia_digital}
            aoMudar={(valor) => mudar('custo_midia_digital', valor)}
          />
          <CampoDeMoeda
            rotulo="Custo de produção digital"
            valor={rascunho.custo_producao_digital}
            aoMudar={(valor) => mudar('custo_producao_digital', valor)}
          />
          <CampoCalculado
            rotulo="Direitos e conexos (Digital)"
            valor={direitosDigital}
            explicacao="15% da mídia digital. Não existe simulcast de digital."
          />
        </div>
      </div>
    </fieldset>
  )
}
