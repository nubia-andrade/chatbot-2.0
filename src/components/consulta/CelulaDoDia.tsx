'use client'

import { CORES_POR_ESTADO, TEXTO_ACESSIVEL_POR_ESTADO } from './LegendaDeEstados'
import type { DiaDeDisponibilidade, Modalidade } from '@/lib/dominio/disponibilidade'

type Props = {
  dia: DiaDeDisponibilidade
  modalidade: Modalidade
  selecionada: boolean
  pracasSelecionadas?: string[]
  aoClicar: () => void
  aoAlternarPraca?: (pracaCodigo: string) => void
}

function numeroDoDia(dataIso: string): number {
  return Number(dataIso.slice(8, 10))
}

function rotuloPrincipal(dia: DiaDeDisponibilidade): string {
  if (dia.estado === 'ja_comprado') return '✓ Já comprado'
  if (dia.estado === 'limite_mensal') return 'Limite mensal'
  return `${dia.livres} livre${dia.livres === 1 ? '' : 's'}`
}

function CabecalhoDaCelula({ dia, numero }: { dia: DiaDeDisponibilidade; numero: number }) {
  const cores = CORES_POR_ESTADO[dia.estado]
  const title = dia.motivos.length > 0 ? dia.motivos.join('\n') : undefined

  return (
    <div className="flex items-start justify-between gap-1">
      <span
        className="text-[12px] font-bold sm:text-[14px]"
        style={{ fontFamily: 'var(--fonte-titulo)', color: 'var(--texto)' }}
      >
        {numero}
      </span>
      <span className="flex items-center gap-1">
        {dia.motivos.length > 1 && (
          <span
            aria-hidden
            title={title}
            className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ background: 'var(--texto-2)' }}
          >
            +{dia.motivos.length}
          </span>
        )}
        {dia.estado === 'ja_comprado' ? (
          <span aria-hidden className="text-[13px] font-bold" style={{ color: '#2563EB' }}>✓</span>
        ) : (
          <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: cores.dot }} />
        )}
      </span>
    </div>
  )
}

export function CelulaDoDia({
  dia,
  modalidade,
  selecionada,
  pracasSelecionadas = [],
  aoClicar,
  aoAlternarPraca,
}: Props) {
  const numero = numeroDoDia(dia.data)

  if (dia.estado === 'sem_exibicao') {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-[64px] flex-col rounded-[9px] p-1.5 sm:min-h-[82px] sm:rounded-[11px] sm:p-2"
        style={{ background: 'var(--superficie-suave)' }}
      >
        <span
          className="text-[12px] font-semibold sm:text-[14px]"
          style={{ fontFamily: 'var(--fonte-titulo)', color: 'var(--texto-2)' }}
        >
          {numero}
        </span>
        <span className="sr-only">Dia {numero}: sem exibição do programa.</span>
      </div>
    )
  }

  const cores = CORES_POR_ESTADO[dia.estado]
  const corTexto = TEXTO_ACESSIVEL_POR_ESTADO[dia.estado] ?? 'var(--texto-2)'
  const clicavel = dia.estado === 'disponivel'
  const regional = modalidade === 'regional' && dia.pracas.length > 0
  const usados = dia.total - dia.livres
  const title = dia.motivos.length > 0 ? dia.motivos.join('\n') : undefined
  const selecionadasSet = new Set(pracasSelecionadas)

  const resumoDasPracas = dia.pracas
    .map((praca) =>
      praca.disponivel
        ? `${praca.praca_codigo} livre`
        : `${praca.praca_codigo} vendida para ${praca.cliente_nome}`,
    )
    .join(', ')

  if (regional) {
    return (
      <div
        title={title}
        className="relative flex min-h-[64px] flex-col rounded-[9px] p-1.5 text-left sm:min-h-[82px] sm:rounded-[11px] sm:p-2"
        style={{
          background: cores.fundo,
          border: selecionada ? '2px solid var(--roxo)' : '2px solid transparent',
        }}
      >
        <CabecalhoDaCelula dia={dia} numero={numero} />

        <p className="mt-0.5 text-[10px] font-bold leading-tight sm:text-[12px]" style={{ color: corTexto }}>
          {rotuloPrincipal(dia)}
        </p>
        <p className="text-[9px] leading-tight sm:text-[10.5px]" style={{ color: 'var(--texto-2)' }}>
          {usados}/{dia.total} ocupados
        </p>

        <div className="mt-1 grid grid-cols-5 gap-[2px]" aria-label={`Praças de ${dia.data}`}>
          {dia.pracas.map((praca) => {
            const marcada = selecionadasSet.has(praca.praca_codigo)
            const habilitada = clicavel && praca.disponivel
            return (
              <button
                key={praca.praca_codigo}
                type="button"
                disabled={!habilitada}
                aria-pressed={habilitada ? marcada : undefined}
                aria-label={
                  habilitada
                    ? `${marcada ? 'Remover' : 'Selecionar'} praça ${praca.praca_codigo} em ${dia.data}`
                    : `${praca.praca_codigo} indisponível em ${dia.data}`
                }
                title={
                  praca.disponivel
                    ? `${praca.praca_codigo}: ${marcada ? 'selecionada' : 'livre'}`
                    : `${praca.praca_codigo}: vendida para ${praca.cliente_nome}`
                }
                onClick={() => {
                  if (habilitada) aoAlternarPraca?.(praca.praca_codigo)
                }}
                className="flex aspect-square items-center justify-center rounded-[3px] text-[6px] font-bold leading-none text-white outline-none transition-transform enabled:cursor-pointer enabled:hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--roxo)] sm:text-[7px]"
                style={{
                  background: marcada
                    ? 'var(--roxo)'
                    : praca.disponivel
                      ? 'var(--disponivel-texto)'
                      : 'var(--esgotado)',
                  opacity: habilitada || marcada ? 1 : 0.72,
                }}
              >
                {praca.praca_codigo.slice(0, 2)}
              </button>
            )
          })}
        </div>

        {dia.feriado && (
          <p
            className="mt-auto truncate pt-1 text-[9px] sm:text-[10px]"
            style={{ color: 'var(--texto-2)' }}
            title={dia.feriado}
          >
            {dia.feriado}
          </p>
        )}

        {selecionada && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: 'var(--roxo)' }}
          >
            {pracasSelecionadas.length}
          </span>
        )}

        <span className="sr-only">
          {cores.rotulo}
          {dia.motivos.length > 0 ? `. ${dia.motivos.join('. ')}` : ''}
          {`. Praças: ${resumoDasPracas}.`}
          {pracasSelecionadas.length > 0 ? ` Selecionadas: ${pracasSelecionadas.join(', ')}.` : ''}
          {dia.feriado ? `. ${dia.feriado}.` : ''}
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (clicavel) aoClicar()
      }}
      aria-disabled={clicavel ? undefined : true}
      aria-pressed={clicavel ? selecionada : undefined}
      title={title}
      className="relative flex min-h-[64px] flex-col rounded-[9px] p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)] sm:min-h-[82px] sm:rounded-[11px] sm:p-2"
      style={{
        background: cores.fundo,
        cursor: clicavel ? 'pointer' : 'not-allowed',
        border: selecionada ? '2px solid var(--roxo)' : '2px solid transparent',
      }}
    >
      <CabecalhoDaCelula dia={dia} numero={numero} />

      <p className="mt-0.5 text-[10px] font-bold leading-tight sm:text-[12px]" style={{ color: corTexto }}>
        {rotuloPrincipal(dia)}
      </p>
      <p className="text-[9px] leading-tight sm:text-[10.5px]" style={{ color: 'var(--texto-2)' }}>
        {usados}/{dia.total} ocupados
      </p>

      {dia.feriado && (
        <p
          className="mt-auto truncate pt-1 text-[9px] sm:text-[10px]"
          style={{ color: 'var(--texto-2)' }}
          title={dia.feriado}
        >
          {dia.feriado}
        </p>
      )}

      {selecionada && (
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ background: 'var(--roxo)' }}
        >
          ✓
        </span>
      )}

      <span className="sr-only">
        {cores.rotulo}
        {dia.motivos.length > 0 ? `. ${dia.motivos.join('. ')}` : ''}
        {dia.feriado ? `. ${dia.feriado}.` : ''}
        {selecionada ? '. Selecionada.' : ''}
      </span>
    </button>
  )
}
