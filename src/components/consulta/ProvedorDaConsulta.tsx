'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { Modalidade } from '@/lib/dominio/disponibilidade'
import type { ItemDaConsulta } from '@/lib/dominio/consulta'

/** Estado persistido da consulta dentro da aba. */
export type EstadoDaConsulta = {
  /** Marca escolhida pelo executivo na entrada da consulta. */
  marcaId: string | null
  marcaNome: string | null
  /** Anunciante oficial da carteira associado à marca. */
  cliente: Cliente | null
  programaId: string | null
  programaNome: string | null
  modalidade: Modalidade
  ano: number
  mes: number
  itens: ItemDaConsulta[]
  datasConfirmadas: boolean
}

const CHAVE_SESSAO = 'chatbot2:consulta'

function estadoInicial(): EstadoDaConsulta {
  const agora = new Date()
  return {
    marcaId: null,
    marcaNome: null,
    cliente: null,
    programaId: null,
    programaNome: null,
    modalidade: 'nacional',
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    itens: [],
    datasConfirmadas: false,
  }
}

type ContextoConsulta = {
  estado: EstadoDaConsulta
  hidratado: boolean
  atualizar: (parcial: Partial<EstadoDaConsulta>) => void
  confirmarDatas: () => void
  limpar: () => void
}

const Contexto = createContext<ContextoConsulta | null>(null)

export function ProvedorDaConsulta({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaConsulta>(estadoInicial)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_SESSAO)
      if (bruto) {
        const salvo = JSON.parse(bruto) as Partial<EstadoDaConsulta>
        setEstado((atual) => ({ ...atual, ...salvo }))
      }
    } catch {
      // sessionStorage indisponível ou conteúdo inválido: segue com estado inicial.
    } finally {
      setHidratado(true)
    }
  }, [])

  useEffect(() => {
    if (!hidratado) return
    try {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(estado))
    } catch {
      // Gravação é melhor esforço; não pode derrubar a tela.
    }
  }, [estado, hidratado])

  function atualizar(parcial: Partial<EstadoDaConsulta>) {
    setEstado((atual) => {
      const proximo = { ...atual, ...parcial }

      // Qualquer alteração das datas reabre o passo de confirmação.
      if ('itens' in parcial) {
        proximo.datasConfirmadas = false
      }

      return proximo
    })
  }

  function confirmarDatas() {
    setEstado((atual) => ({ ...atual, datasConfirmadas: true }))
  }

  function limpar() {
    setEstado(estadoInicial())
    try {
      sessionStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // idem
    }
  }

  return (
    <Contexto.Provider value={{ estado, hidratado, atualizar, confirmarDatas, limpar }}>
      {children}
    </Contexto.Provider>
  )
}

export function useConsulta(): ContextoConsulta {
  const contexto = useContext(Contexto)
  if (!contexto) {
    throw new Error('useConsulta precisa ser chamado dentro de <ProvedorDaConsulta>')
  }
  return contexto
}

/** As 7 pílulas do stepper, na ordem do fluxo. */
export const PASSOS: { slug: string; rotulo: string }[] = [
  { slug: 'cliente', rotulo: 'Cliente' },
  { slug: 'setor', rotulo: 'Setor' },
  { slug: 'programa', rotulo: 'Programa' },
  { slug: 'calendario', rotulo: 'Calendário' },
  { slug: 'datas', rotulo: 'Datas' },
  { slug: 'resumo', rotulo: 'Resumo' },
  { slug: 'proposta', rotulo: 'Proposta' },
]

/**
 * O passo mais adiantado que o estado atual justifica. Marca e anunciante
 * nascem juntos na entrada consolidada; `cliente` continua sendo o gate
 * técnico porque é ele que alimenta todas as regras de carteira.
 */
export function primeiroPassoPendente(estado: EstadoDaConsulta): string {
  if (!estado.cliente) return 'cliente'
  if (!estado.programaId) return 'programa'
  if (estado.itens.length === 0) return 'calendario'
  if (!estado.datasConfirmadas) return 'datas'
  return 'resumo'
}

export function useGuardaDoPasso(slug: string): boolean {
  const { estado, hidratado } = useConsulta()
  const router = useRouter()
  const [redirecionando, setRedirecionando] = useState(false)

  useEffect(() => {
    if (!hidratado) return

    const pendente = primeiroPassoPendente(estado)
    const indexPendente = PASSOS.findIndex((passo) => passo.slug === pendente)
    const indexEstePasso = PASSOS.findIndex((passo) => passo.slug === slug)

    if (indexEstePasso > indexPendente) {
      setRedirecionando(true)
      router.replace(`/consulta/${pendente}`)
    }
  }, [estado, hidratado, router, slug])

  return hidratado && !redirecionando
}
