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
  /**
   * Marcado quando o executivo avança do passo Datas (5) para o Resumo
   * (6) — é lá que se define a quantidade de ações por data e, no
   * regional, as praças de cada ação. Sem este campo, escolher datas no
   * calendário já bastava para `primeiroPassoPendente` liberar o Resumo
   * direto, pulando o passo 5 inteiro (achado da revisão da Task 9).
   *
   * Nasce `false`. Uma sessão salva antes deste campo existir não tem a
   * chave no `sessionStorage`; ao mesclar (`{ ...atual, ...salvo }`) o
   * `false` do estado inicial prevalece, então restaurar uma sessão
   * antiga não pula o passo por engano.
   */
  datasConfirmadas: boolean
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
    datasConfirmadas: false,
  }
}

type ContextoConsulta = {
  estado: EstadoDaConsulta
  /**
   * `false` até a leitura do `sessionStorage` terminar (com ou sem nada
   * salvo — os dois casos marcam `hidratado` como concluídos, não só o
   * caminho com dado salvo). Existe para `useGuardaDoPasso` não decidir
   * em cima do `estadoInicial()` — achado Important #1 da revisão da
   * Task 9: sem essa checagem, a guarda rodava com o estado ainda vazio
   * antes da effect de hidratação do provider (que é ancestral) ter
   * chance de rodar, porque o React dispara effects de descendente antes
   * das do ancestral no mesmo commit — e mandava de volta para o passo 1
   * uma consulta salva válida, a cada F5.
   */
  hidratado: boolean
  atualizar: (parcial: Partial<EstadoDaConsulta>) => void
  /**
   * Marca o passo Datas como concluído — é o que libera o Resumo em
   * `primeiroPassoPendente`. A Task 13 (conteúdo real do passo 5) é quem
   * deve chamar isto no botão de avançar; até lá, a rota `datas/` mostra
   * o gancho pronto mas não chama, então tentar seguir para o resumo
   * continua sendo devolvido ao passo 5 pela guarda — o esperado num
   * esqueleto que ainda não construiu o passo.
   */
  confirmarDatas: () => void
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
    setEstado((atual) => {
      const proximo = { ...atual, ...parcial }

      // Mudar `itens` invalida a confirmação do passo Datas: as
      // quantidades e praças que o executivo definira ali valiam para o
      // conjunto de datas anterior. Qualquer atualização vinda do
      // Calendário (mesmo trocar uma data por outra) precisa reabrir o
      // passo 5 — por isso a checagem é pela presença da chave `itens`
      // no parcial, não por comparação de conteúdo.
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
 * cliente; escolhido o cliente, a classificação já é conhecida de fato,
 * então o "✓" nele é honesto mesmo sem visita.
 *
 * "Datas" já teve o mesmo tratamento (sem gate próprio) e isso era
 * defeito, não decisão: com `itens` preenchido o pendente pulava direto
 * para `resumo`, deixando a guarda liberar `/consulta/resumo` sem que o
 * executivo tivesse passado pelo passo 5 — onde se define quantidade por
 * data e, no regional, as praças de cada ação. `datasConfirmadas` fecha
 * esse buraco.
 */
export function primeiroPassoPendente(estado: EstadoDaConsulta): string {
  if (!estado.cliente) return 'cliente'
  if (!estado.programaId) return 'programa'
  if (estado.itens.length === 0) return 'calendario'
  if (!estado.datasConfirmadas) return 'datas'
  return 'resumo'
}

/**
 * A guarda de cada página de passo. Entrar direto por uma URL adiante do
 * que o estado já justifica (ex.: `/consulta/resumo` sem cliente nem
 * programa escolhidos) devolve ao passo pendente em vez de quebrar a tela.
 *
 * Devolve `pronto`: `true` só quando o passo pode de fato renderizar seu
 * conteúdo — depois da hidratação, e só se a guarda não estiver mandando
 * embora. A página chamadora usa isso para não pintar nada (nem que seja
 * o placeholder de hoje, ou dado de negócio de verdade nas Tasks 10-14)
 * antes da decisão estar tomada — achado Important #2 da revisão.
 *
 * Espera `hidratado` antes de avaliar (achado Important #1): sem isso, a
 * guarda de uma página descendente roda com `estadoInicial()` — o React
 * dispara effects de descendente antes das do ancestral no mesmo commit,
 * então a effect de hidratação do provider (ancestral, em
 * `ProvedorDaConsulta`) ainda não tinha rodado. `primeiroPassoPendente`
 * de um estado vazio é sempre `'cliente'`, e a guarda mandava de volta
 * para lá mesmo com uma consulta salva e válida — a cada F5 em qualquer
 * passo além do primeiro.
 */
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
      // Não é estado derivado de props/estado local: é a reação a uma
      // decisão de navegação que só este effect pode tomar (depende de
      // `hidratado` e de `router`, ambos externos ao render). Sem isso a
      // página renderizaria seu conteúdo de novo por um instante antes de
      // `router.replace` completar a troca de rota.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirecionando(true)
      router.replace(`/consulta/${pendente}`)
    }
  }, [estado, hidratado, router, slug])

  return hidratado && !redirecionando
}
