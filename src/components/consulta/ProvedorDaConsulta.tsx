'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { Modalidade } from '@/lib/dominio/disponibilidade'
import type { ItemDaConsulta } from '@/lib/dominio/consulta'

/** Estado persistido da consulta dentro da aba. */
export type EstadoDaConsulta = {
  marcaId: string | null
  marcaNome: string | null
  cliente: Cliente | null
  programaId: string | null
  programaNome: string | null
  /** Contexto livre informado pelo executivo antes do calendário. */
  produto: string
  objetivo: string
  modalidade: Modalidade
  ano: number
  mes: number
  itens: ItemDaConsulta[]
  /** Complementos globais: quando marcados, valem para todas as datas selecionadas. */
  incluirDigital: boolean
  incluirRedesSociais: boolean
  /** Mantido por compatibilidade com sessões já abertas; não é mais gate de navegação. */
  datasConfirmadas: boolean
  /** Quando preenchido, a próxima emissão será uma nova versão desta proposta. */
  propostaAnteriorId: string | null
  /** Depois que o PDF é gerado, a consulta vira um registro fechado e não pode ser reeditada. */
  finalizada: boolean
  propostaId: string | null
}

export const CHAVE_SESSAO_CONSULTA = 'chatbot2:consulta'

function estadoInicial(): EstadoDaConsulta {
  const agora = new Date()
  return {
    marcaId: null,
    marcaNome: null,
    cliente: null,
    programaId: null,
    programaNome: null,
    produto: '',
    objetivo: '',
    modalidade: 'nacional',
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    itens: [],
    incluirDigital: false,
    incluirRedesSociais: false,
    datasConfirmadas: false,
    propostaAnteriorId: null,
    finalizada: false,
    propostaId: null,
  }
}

type ContextoConsulta = {
  estado: EstadoDaConsulta
  hidratado: boolean
  atualizar: (parcial: Partial<EstadoDaConsulta>) => void
  confirmarDatas: () => void
  finalizar: (propostaId: string) => void
  limpar: () => void
}

const Contexto = createContext<ContextoConsulta | null>(null)

export function ProvedorDaConsulta({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaConsulta>(estadoInicial)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_SESSAO_CONSULTA)
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
      sessionStorage.setItem(CHAVE_SESSAO_CONSULTA, JSON.stringify(estado))
    } catch {
      // Gravação é melhor esforço; não pode derrubar a tela.
    }
  }, [estado, hidratado])

  function atualizar(parcial: Partial<EstadoDaConsulta>) {
    setEstado((atual) => {
      if (atual.finalizada) return atual
      const proximo = { ...atual, ...parcial }
      if ('itens' in parcial) proximo.datasConfirmadas = false
      return proximo
    })
  }

  function confirmarDatas() {
    setEstado((atual) => atual.finalizada ? atual : { ...atual, datasConfirmadas: true })
  }

  function finalizar(propostaId: string) {
    setEstado((atual) => ({ ...atual, finalizada: true, propostaId }))
  }

  function limpar() {
    setEstado(estadoInicial())
    try {
      sessionStorage.removeItem(CHAVE_SESSAO_CONSULTA)
    } catch {
      // idem
    }
  }

  return (
    <Contexto.Provider value={{ estado, hidratado, atualizar, confirmarDatas, finalizar, limpar }}>
      {children}
    </Contexto.Provider>
  )
}

export function useConsulta(): ContextoConsulta {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useConsulta precisa ser chamado dentro de <ProvedorDaConsulta>')
  return contexto
}

/** A jornada real tem três momentos: contexto, disponibilidade e confirmação. */
export const PASSOS: { slug: 'contexto' | 'calendario' | 'resumo'; rotulo: string; href: string }[] = [
  { slug: 'contexto', rotulo: 'Contexto', href: '/consulta' },
  { slug: 'calendario', rotulo: 'Calendário', href: '/consulta/calendario' },
  { slug: 'resumo', rotulo: 'Resumo', href: '/consulta/resumo' },
]

export function primeiroPassoPendente(estado: EstadoDaConsulta): 'contexto' | 'calendario' | 'resumo' {
  if (estado.finalizada) return 'resumo'
  if (!estado.cliente || !estado.programaId || estado.produto.trim() === '' || estado.objetivo.trim() === '') return 'contexto'
  if (estado.itens.length === 0) return 'calendario'
  return 'resumo'
}

export function useGuardaDoPasso(slug: 'contexto' | 'calendario' | 'resumo'): boolean {
  const { estado, hidratado } = useConsulta()
  const router = useRouter()
  const [redirecionando, setRedirecionando] = useState(false)

  useEffect(() => {
    if (!hidratado) return

    if (estado.finalizada && slug !== 'resumo') {
      setRedirecionando(true)
      router.replace('/consulta/resumo')
      return
    }

    const pendente = primeiroPassoPendente(estado)
    const indexPendente = PASSOS.findIndex((passo) => passo.slug === pendente)
    const indexEstePasso = PASSOS.findIndex((passo) => passo.slug === slug)

    if (indexEstePasso > indexPendente) {
      setRedirecionando(true)
      const destino = PASSOS[indexPendente]?.href ?? '/consulta'
      router.replace(destino)
    } else {
      setRedirecionando(false)
    }
  }, [estado, hidratado, router, slug])

  return hidratado && !redirecionando
}
