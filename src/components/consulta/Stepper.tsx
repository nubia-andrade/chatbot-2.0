'use client'

import Link from 'next/link'
import {
  PASSOS,
  primeiroPassoPendente,
  type EstadoDaConsulta,
} from '@/components/consulta/ProvedorDaConsulta'

type Props = {
  passoAtual: string
  estado: EstadoDaConsulta
}

const ESTILO_BASE =
  'inline-flex items-center rounded-full px-3 py-[7px] text-[12.5px] font-bold outline-none whitespace-nowrap'

/**
 * Stepper do wizard. Antes da geração, etapas concluídas podem ser revisitadas.
 * Depois que o PDF é gerado, a consulta vira um registro fechado: os passos
 * anteriores continuam visíveis como contexto, mas deixam de ser links.
 */
export function Stepper({ passoAtual, estado }: Props) {
  const pendente = primeiroPassoPendente(estado)
  const indexPendente = PASSOS.findIndex((passo) => passo.slug === pendente)
  const indexAtual = PASSOS.findIndex((passo) => passo.slug === passoAtual)

  return (
    <nav aria-label="Etapas da consulta" className="flex flex-wrap gap-2">
      {PASSOS.map((passo, indice) => {
        const numero = indice + 1
        const ativo = indice === indexAtual
        const concluido = !ativo && (estado.finalizada ? indice < indexAtual : indice < indexPendente)

        if (ativo) {
          return (
            <span
              key={passo.slug}
              aria-current="step"
              className={ESTILO_BASE}
              style={{ background: 'var(--marca)', color: '#FFFFFF' }}
            >
              {numero}·{passo.rotulo}
            </span>
          )
        }

        if (concluido && estado.finalizada) {
          return (
            <span
              key={passo.slug}
              aria-disabled="true"
              title="Consulta finalizada. Inicie uma nova consulta para alterar os dados."
              className={`${ESTILO_BASE} cursor-not-allowed`}
              style={{ background: 'var(--disponivel-fundo)', color: 'var(--disponivel)' }}
            >
              ✓ {passo.rotulo}
            </span>
          )
        }

        if (concluido) {
          return (
            <Link
              key={passo.slug}
              href={`/consulta/${passo.slug}`}
              className={`${ESTILO_BASE} focus-visible:ring-2 focus-visible:ring-[var(--roxo)]`}
              style={{ background: 'var(--disponivel-fundo)', color: 'var(--disponivel)' }}
            >
              ✓ {passo.rotulo}
            </Link>
          )
        }

        return (
          <span
            key={passo.slug}
            aria-disabled="true"
            title="Conclua os passos anteriores para chegar aqui"
            className={`${ESTILO_BASE} cursor-not-allowed`}
            style={{ background: '#F5F4F8', color: 'var(--placeholder)' }}
          >
            {numero}·{passo.rotulo}
          </span>
        )
      })}
    </nav>
  )
}
