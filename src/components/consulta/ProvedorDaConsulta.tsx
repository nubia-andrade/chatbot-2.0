'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { Modalidade } from '@/lib/dominio/disponibilidade'
import type { ItemDaConsulta } from '@/lib/dominio/consulta'

/**
 * O estado do wizard de consulta, espelhado no `sessionStorage` da aba —
 * Task 9.
 *
 * `sessionStorage`, não `localStorage`: a consulta pertence à aba, e duas
 * abas com consultas diferentes é um uso legítimo que o `localStorage`
 * embaralharia (uma sobrescreveria a outra).
 */
export type EstadoDaConsulta = {
  cliente: Cliente | null
  programaId: string | null
  programaNome: string | null
  modalidade: Modalidade
  ano: number
  mes: number
  itens: ItemDaConsulta[]
}

const CHAVE_SESSAO = 'chatbot2:consulta'

function estadoInicial(): EstadoDaConsulta {
  const agora = new Date()
  return {
    cliente: null,
    programaId: null,
    programaNome: null,
    modalidade: 'nacional',
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    itens: [],
  }
}

type ContextoConsulta = {
  estado: EstadoDaConsulta
  atualizar: (parcial: Partial<EstadoDaConsulta>) => void
  limpar: () => void
}

const Contexto = createContext<ContextoConsulta | null>(null)

/**
 * Provedor do estado do wizard. Client Component porque `createContext` e
 * `sessionStorage` só existem no navegador.
 *
 * O estado nasce com os valores padrão (mês/ano correntes, o resto vazio) —
 * os mesmos no servidor e no navegador, para que a primeira renderização
 * bata na hidratação. Só depois da montagem (`useEffect`) é que lemos o
 * `sessionStorage` e, se havia algo salvo, mesclamos por cima: ler no
 * primeiro render divergiria do que o servidor renderizou, porque o
 * servidor não tem `sessionStorage`.
 */
export function ProvedorDaConsulta({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaConsulta>(estadoInicial)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_SESSAO)
      if (bruto) {
        const salvo = JSON.parse(bruto) as Partial<EstadoDaConsulta>
        // Hidratação do sessionStorage: só existe no navegador, então não dá
        // pra ler nem no primeiro render nem no inicializador do useState sem
        // divergir do que o servidor renderizou. É o mesmo padrão do guia
        // oficial do React para "read state from another source on mount".
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEstado((atual) => ({ ...atual, ...salvo }))
      }
    } catch {
      // sessionStorage indisponível (aba anônima restrita, JSON corrompido
      // etc.) — segue com o estado inicial em vez de quebrar a tela.
    } finally {
      setHidratado(true)
    }
  }, [])

  useEffect(() => {
    if (!hidratado) return
    try {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(estado))
    } catch {
      // idem — gravar é melhor esforço, não pode derrubar a tela.
    }
  }, [estado, hidratado])

  function atualizar(parcial: Partial<EstadoDaConsulta>) {
    setEstado((atual) => ({ ...atual, ...parcial }))
  }

  function limpar() {
    setEstado(estadoInicial())
    try {
      sessionStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // idem
    }
  }

  return <Contexto.Provider value={{ estado, atualizar, limpar }}>{children}</Contexto.Provider>
}

export function useConsulta(): ContextoConsulta {
  const contexto = useContext(Contexto)
  if (!contexto) {
    throw new Error('useConsulta precisa ser chamado dentro de <ProvedorDaConsulta>')
  }
  return contexto
}

/** As 7 pílulas do stepper, na ordem do fluxo canônico do handoff. */
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
 * O passo mais adiantado que o estado atual justifica.
 *
 * Não há um campo próprio para "setor" porque ele nasce junto do cliente
 * (é detectado automaticamente, tela 1c do handoff) — por isso o passo
 * Setor nunca bloqueia o avanço sozinho, só mostra o que já veio do
 * cliente. Pelo mesmo motivo não há gate próprio para "datas": o que
 * bloqueia é `itens` vazio, resolvido no passo Calendário.
 */
export function primeiroPassoPendente(estado: EstadoDaConsulta): string {
  if (!estado.cliente) return 'cliente'
  if (!estado.programaId) return 'programa'
  if (estado.itens.length === 0) return 'calendario'
  return 'resumo'
}

/**
 * A guarda de cada página de passo. Entrar direto por uma URL adiante do
 * que o estado já justifica (ex.: `/consulta/resumo` sem cliente nem
 * programa escolhidos) devolve ao passo pendente em vez de quebrar a tela.
 */
export function useGuardaDoPasso(slug: string): void {
  const { estado } = useConsulta()
  const router = useRouter()

  useEffect(() => {
    const pendente = primeiroPassoPendente(estado)
    const indexPendente = PASSOS.findIndex((passo) => passo.slug === pendente)
    const indexEstePasso = PASSOS.findIndex((passo) => passo.slug === slug)

    if (indexEstePasso > indexPendente) {
      router.replace(`/consulta/${pendente}`)
    }
  }, [estado, router, slug])
}
