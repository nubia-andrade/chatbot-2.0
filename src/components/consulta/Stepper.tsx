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
 * As 7 pílulas do wizard — telas 1b a 1e do handoff.
 *
 * A cor nunca é o único sinal de estado: o passo concluído ganha o prefixo
 * "✓" (não só fundo/texto verdes) e o ativo ganha `aria-current="step"`
 * além do gradiente da marca.
 *
 * Proposta aparece sempre desabilitada, com o texto explicando o motivo —
 * mesma decisão que a Entrega 2 tomou com a aba "Modelo de propostas"
 * (`AbasDoPrograma.tsx`): mostrar em vez de esconder, para o executivo
 * saber que a funcionalidade existe.
 *
 * Passo concluído é clicável, para voltar. Passo à frente do pendente,
 * não — por isso os inativos (fundo `#F5F4F8`, texto `#B4AEC0`) não são
 * `<Link>`. Esse par de cores é o único do handoff abaixo de 4.5:1 de
 * contraste, mas o WCAG 1.4.3 isenta texto de componente desabilitado — e
 * estas pílulas não são clicáveis.
 */
export function Stepper({ passoAtual, estado }: Props) {
  const pendente = primeiroPassoPendente(estado)
  const indexPendente = PASSOS.findIndex((passo) => passo.slug === pendente)
  const indexAtual = PASSOS.findIndex((passo) => passo.slug === passoAtual)

  return (
    <nav aria-label="Etapas da consulta" className="flex flex-wrap gap-2">
      {PASSOS.map((passo, indice) => {
        const numero = indice + 1

        if (passo.slug === 'proposta') {
          return (
            <span
              key={passo.slug}
              aria-disabled="true"
              title="Disponível na próxima entrega"
              className={`${ESTILO_BASE} cursor-not-allowed`}
              style={{ background: '#F5F4F8', color: 'var(--placeholder)' }}
            >
              {numero}·{passo.rotulo}
            </span>
          )
        }

        const ativo = indice === indexAtual
        const concluido = !ativo && indice < indexPendente

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
