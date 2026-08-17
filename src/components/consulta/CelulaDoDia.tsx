'use client'

import { CORES_POR_ESTADO, TEXTO_ACESSIVEL_POR_ESTADO } from './LegendaDeEstados'
import type { DiaDeDisponibilidade } from '@/lib/dominio/disponibilidade'

type Props = {
  dia: DiaDeDisponibilidade
  selecionada: boolean
  aoClicar: () => void
}

function numeroDoDia(dataIso: string): number {
  return Number(dataIso.slice(8, 10))
}

/**
 * Uma célula do calendário — Task 12. **Não decide nada**: `dia.estado`,
 * `dia.motivos` e `dia.pracas` já chegam resolvidos de `carregarDisponibilidade`
 * (Task 8), esta função só os desenha.
 *
 * `sem_exibicao` não é um estado, é ausência de inventário (o programa não
 * vai ao ar naquele dia) — por isso vira um `<div>` sem dot, sem "N
 * livres"/"usados de total" e não interativo, em vez de um `<button>`
 * "desabilitado" que ainda pareceria um estado possível de resolver.
 *
 * Nas demais, só `disponivel` é de fato clicável; as outras continuam
 * `<button>` (para o motivo ficar acessível por teclado e leitor de tela,
 * via `title` e o texto oculto no fim), mas com `aria-disabled="true"`,
 * `cursor: not-allowed` e o clique sem efeito algum.
 */
export function CelulaDoDia({ dia, selecionada, aoClicar }: Props) {
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
  const regional = dia.pracas.length > 0
  const usados = dia.total - dia.livres

  // `title` traz TODOS os motivos, um por linha — o detalhe nunca esconde o
  // segundo motivo atrás do primeiro (uma data pode estar fora do prazo E
  // bloqueada ao mesmo tempo).
  const title = dia.motivos.length > 0 ? dia.motivos.join('\n') : undefined

  // No regional, a pergunta não é "este dia está livre?", é "o que está
  // livre, para qual praça" — o `title` de cada quadradinho não é lido por
  // todo leitor de tela, então o mesmo detalhe entra no texto oculto da
  // célula inteira.
  const resumoDasPracas = dia.pracas
    .map((praca) =>
      praca.disponivel
        ? `${praca.praca_codigo} livre`
        : `${praca.praca_codigo} vendida para ${praca.cliente_nome}`,
    )
    .join(', ')

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
          <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: cores.dot }} />
        </span>
      </div>

      <p className="mt-0.5 text-[10px] font-bold leading-tight sm:text-[12px]" style={{ color: corTexto }}>
        {dia.livres} livre{dia.livres === 1 ? '' : 's'}
      </p>
      <p className="text-[9px] leading-tight sm:text-[10.5px]" style={{ color: 'var(--texto-2)' }}>
        {usados}/{dia.total}
      </p>

      {/* Regional: as 5 praças em miniatura — a pergunta regional não é "este dia está livre?", é "o que está livre, para qual praça". */}
      {regional && (
        <div className="mt-1 grid grid-cols-5 gap-[2px]">
          {dia.pracas.map((praca) => (
            <span
              key={praca.praca_codigo}
              title={
                praca.disponivel
                  ? `${praca.praca_codigo}: livre`
                  : `${praca.praca_codigo}: vendida para ${praca.cliente_nome}`
              }
              className="flex aspect-square items-center justify-center rounded-[3px] text-[6px] font-bold leading-none text-white sm:text-[7px]"
              style={{ background: praca.disponivel ? 'var(--disponivel-texto)' : 'var(--esgotado)' }}
            >
              {praca.praca_codigo.slice(0, 2)}
            </span>
          ))}
        </div>
      )}

      {/*
        Feriado é ILUSTRAÇÃO, nunca regra — por isso nunca entra em `motivos`
        nem muda `cores`/`clicavel`. Mesmo lugar em qualquer estado (aqui,
        sempre a última linha da célula) para quem lê "Natal" numa célula
        verde entender que o programa vende naquele dia.
      */}
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

      {/* Cor nunca é o único indicador: o rótulo do estado, todos os motivos, as praças (no regional) e o feriado ficam disponíveis a leitor de tela mesmo sem o `title` (que não é lido por todo leitor de tela em todo navegador). */}
      <span className="sr-only">
        {cores.rotulo}
        {dia.motivos.length > 0 ? `. ${dia.motivos.join('. ')}` : ''}
        {regional ? `. Praças: ${resumoDasPracas}.` : ''}
        {dia.feriado ? `. ${dia.feriado}.` : ''}
        {selecionada ? '. Selecionada.' : ''}
      </span>
    </button>
  )
}
