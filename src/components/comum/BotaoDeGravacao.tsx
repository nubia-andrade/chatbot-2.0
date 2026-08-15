'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = {
  gravando: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled'>

/**
 * Botão de gravar/salvar padrão da entrega.
 *
 * Enquanto `gravando`, fica desabilitado e troca o texto por "Salvando…" —
 * o retorno imediato que impede o duplo clique. Sem isso, um clique duplo
 * em qualquer formulário (data bloqueada, restrição, ação regional) dispara
 * duas gravações e cria um registro repetido. O texto some junto com o
 * clique: silêncio não é confirmação, então "Salvando…" fica visível até a
 * chamada terminar.
 */
export function BotaoDeGravacao({ gravando, children, type = 'submit', ...resto }: Props) {
  return (
    <button
      {...resto}
      type={type}
      disabled={gravando}
      aria-busy={gravando}
      className="h-[44px] rounded-[12px] px-5 text-[14px] font-bold text-white enabled:cursor-pointer disabled:opacity-70"
      style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
    >
      {gravando ? 'Salvando…' : children}
    </button>
  )
}
