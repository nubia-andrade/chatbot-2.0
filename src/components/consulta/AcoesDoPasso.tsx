'use client'

import Link from 'next/link'

type Props = {
  /** Slug do passo anterior, ou `null` no primeiro passo (sem "← Voltar"). */
  voltarPara: string | null
  /** Slug do próximo passo. */
  avancarPara: string
  avancarRotulo: string
  habilitado: boolean
  /**
   * Ação síncrona executada antes da navegação. Útil para passos que precisam
   * marcar uma confirmação no provider antes de liberar a próxima rota.
   */
  aoAvancar?: () => void
  /**
   * Por que o botão de avançar está desabilitado — aparece ao lado dele.
   * Botão desabilitado sem explicação é o pior estado possível, então só
   * faz sentido omitir quando `habilitado` é `true`.
   */
  motivo?: string
}

/**
 * A dupla de botões do rodapé de cada passo do wizard — Task 9.
 *
 * "← Voltar" é sempre um link de navegação de verdade (preserva o estado,
 * que já vive no `sessionStorage`). O primário vira `<button disabled>`
 * quando `habilitado` é falso, porque um link desabilitado continua
 * navegável por teclado em vários navegadores — um botão nativo não.
 */
export function AcoesDoPasso({
  voltarPara,
  avancarPara,
  avancarRotulo,
  habilitado,
  aoAvancar,
  motivo,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--borda)] pt-6">
      {voltarPara ? (
        <Link
          href={`/consulta/${voltarPara}`}
          className="rounded-[11px] border border-[var(--borda-forte)] px-5 py-[11px] text-[13.5px] font-bold text-[var(--texto-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
        >
          ← Voltar
        </Link>
      ) : (
        <span aria-hidden />
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!habilitado && motivo && (
          <span className="text-[12.5px] font-medium text-[var(--texto-3)]">{motivo}</span>
        )}

        {habilitado ? (
          <Link
            href={`/consulta/${avancarPara}`}
            onClick={aoAvancar}
            className="rounded-[11px] px-6 py-[11px] text-[13.5px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
            style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
          >
            {avancarRotulo} →
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-[11px] px-6 py-[11px] text-[13.5px] font-bold text-white opacity-50"
            style={{ background: 'var(--marca)' }}
          >
            {avancarRotulo} →
          </button>
        )}
      </div>
    </div>
  )
}
