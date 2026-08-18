'use client'

import { calcularDireitosTv, calcularDireitosDigital } from '@/lib/dominio/direitos-e-conexos'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'

export type RascunhoDeCustos = {
  custo_midia_tv: string
  custo_producao_tv: string
  percentual_simulcast: string
  custo_midia_digital: string
  custo_producao_digital: string
  custo_midia_redes_sociais: string
  custo_producao_redes_sociais: string
}

export function rascunhoDeCustosInicial(programa: {
  custo_midia_tv?: number | null
  custo_producao_tv?: number | null
  percentual_simulcast?: number | null
  custo_midia_digital?: number | null
  custo_producao_digital?: number | null
  custo_midia_redes_sociais?: number | null
  custo_producao_redes_sociais?: number | null
} | null): RascunhoDeCustos {
  return {
    custo_midia_tv: formatarMoeda(programa?.custo_midia_tv),
    custo_producao_tv: formatarMoeda(programa?.custo_producao_tv),
    percentual_simulcast: formatarMoeda(programa?.percentual_simulcast),
    custo_midia_digital: formatarMoeda(programa?.custo_midia_digital),
    custo_producao_digital: formatarMoeda(programa?.custo_producao_digital),
    custo_midia_redes_sociais: formatarMoeda(programa?.custo_midia_redes_sociais),
    custo_producao_redes_sociais: formatarMoeda(programa?.custo_producao_redes_sociais),
  }
}

function TituloDoBloco({ texto }: { texto: string }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--texto-3)]">{texto}</h2>
}

function CampoDeMoeda({ rotulo, valor, aoMudar, ajuda }: { rotulo: string; valor: string; aoMudar: (valor: string) => void; ajuda?: string }) {
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
          <CampoDeMoeda rotulo="Custo de mídia TV" valor={rascunho.custo_midia_tv} aoMudar={(valor) => mudar('custo_midia_tv', valor)} />
          <CampoDeMoeda rotulo="Custo de produção TV" valor={rascunho.custo_producao_tv} aoMudar={(valor) => mudar('custo_producao_tv', valor)} />
          <CampoDeMoeda rotulo="% Simulcast" valor={rascunho.percentual_simulcast} aoMudar={(valor) => mudar('percentual_simulcast', valor)} ajuda="Valor cobrado pela replicação da exibição no Globoplay." />
          <CampoCalculado rotulo="Direitos e conexos (TV)" valor={direitosTv} explicacao="15% da mídia de TV, já somado o simulcast." />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--borda)] pt-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">Digital <span className="font-normal normal-case">(opcional)</span></span>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDeMoeda rotulo="Custo de mídia digital" valor={rascunho.custo_midia_digital} aoMudar={(valor) => mudar('custo_midia_digital', valor)} />
          <CampoDeMoeda rotulo="Custo de produção digital" valor={rascunho.custo_producao_digital} aoMudar={(valor) => mudar('custo_producao_digital', valor)} />
          <CampoCalculado rotulo="Direitos e conexos (Digital)" valor={direitosDigital} explicacao="15% da mídia digital. Não existe simulcast de digital." />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--borda)] pt-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--texto-3)]">Redes sociais <span className="font-normal normal-case">(opcional)</span></span>
          <p className="mt-1 text-[11px] text-[var(--texto-3)]">Campos provisórios até a validação comercial. Não calculamos direitos/conexos para Redes Sociais neste momento.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDeMoeda rotulo="Valor de Redes Sociais" valor={rascunho.custo_midia_redes_sociais} aoMudar={(valor) => mudar('custo_midia_redes_sociais', valor)} ajuda="Valor comercial do complemento por ação." />
          <CampoDeMoeda rotulo="Custo de produção de Redes Sociais" valor={rascunho.custo_producao_redes_sociais} aoMudar={(valor) => mudar('custo_producao_redes_sociais', valor)} ajuda="Preencha somente quando houver custo de produção associado." />
        </div>
      </div>
    </fieldset>
  )
}
