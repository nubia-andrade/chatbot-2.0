'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  ativo: boolean
  mensagem?: string
}

const MENSAGEM_PADRAO =
  'Há alterações não salvas neste formulário. Se sair agora, elas se perdem.'

/**
 * Avisa antes de sair de um formulário com alteração não salva — em
 * qualquer tela desta entrega que use este componente, não só numa.
 *
 * Três caminhos de saída, três técnicas:
 *
 * 1. Fechar a aba, recarregar ou digitar outra URL: `beforeunload` é o único
 *    gancho que o navegador dá para isso, e a mensagem que ele mostra é a
 *    dele, fixa — não a nossa (é assim desde que sites abusavam do texto
 *    livre para prender quem tentava sair).
 *
 * 2. Clicar num link interno (menu, outra linha de uma lista): o Next 16 só
 *    oferece interceptação por link individual, via o `onNavigate` do
 *    `<Link>` (node_modules/next/dist/docs/.../link.md, seção "Blocking
 *    navigation") — não existe um gancho global de router. Envolver cada
 *    `<Link>` do app com esse prop derrotaria o propósito de ter uma peça
 *    reutilizável só aqui. Em vez disso, este componente ouve `click` em
 *    fase de captura no `document`. Captura corre do topo da árvore para
 *    baixo, então dispara antes do próprio `<Link>` (cujo `onClick` o React
 *    liga por delegação, em fase de propagação, mais abaixo) — dá para
 *    interceptar e cancelar a navegação de qualquer link interno sem
 *    precisar conhecer cada um.
 *
 * 3. Navegação disparada por código (`router.push()`), como um botão
 *    "Cancelar" que volta para a lista — **não passa pelo listener de
 *    clique acima**, porque não existe `<a href>` no meio: o alvo do clique
 *    é o `<button>`, e é o `onClick` dele que chama `router.push`
 *    diretamente. Sem gancho de router global no Next 16, a única forma
 *    correta é a tela usar `useNavegacaoSegura` (abaixo) em vez de
 *    `useRouter().push` direto — o hook faz a mesma pergunta de confirmação,
 *    olhando o mesmo `ativo` que este componente recebe.
 *
 * **Como navegar dentro de um formulário protegido:** troque
 * `const router = useRouter(); router.push(destino)` por
 * `const navegar = useNavegacaoSegura(temAlteracaoNaoSalva); navegar(destino)`,
 * passando o mesmo booleano que vai para `<AvisoDeSaida ativo={...} />`.
 * As Tarefas 10, 11 e 12 devem usar este hook para qualquer navegação por
 * código dentro de uma tela que também renderiza `<AvisoDeSaida>` — inclusive
 * o botão "Cancelar" de um formulário.
 */
export function AvisoDeSaida({ ativo, mensagem = MENSAGEM_PADRAO }: Props) {
  useEffect(() => {
    if (!ativo) return

    function aoTentarFechar(evento: BeforeUnloadEvent) {
      evento.preventDefault()
      // Alguns navegadores ainda exigem `returnValue` além de `preventDefault`.
      evento.returnValue = ''
    }

    function aoClicarNoDocumento(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0) return
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

      const alvo = evento.target as HTMLElement
      const link = alvo.closest('a[href]') as HTMLAnchorElement | null
      if (!link) return

      // Só links internos: navegação externa e downloads seguem o padrão do
      // navegador, que já é o comportamento certo para eles.
      if (link.target === '_blank' || link.hasAttribute('download')) return
      if (link.origin !== window.location.origin) return

      const confirmaSaida = window.confirm(mensagem)
      if (!confirmaSaida) {
        evento.preventDefault()
        evento.stopPropagation()
        return
      }

      // Confirmado: deixa o clique seguir para o `<Link>` do Next navegar
      // normalmente. Nada a fazer aqui.
    }

    window.addEventListener('beforeunload', aoTentarFechar)
    document.addEventListener('click', aoClicarNoDocumento, true)

    return () => {
      window.removeEventListener('beforeunload', aoTentarFechar)
      document.removeEventListener('click', aoClicarNoDocumento, true)
    }
  }, [ativo, mensagem])

  return null
}

/**
 * Navegação por código que respeita o mesmo aviso de alteração não salva do
 * `<AvisoDeSaida>`. Use dentro de qualquer tela que tenha um formulário
 * protegido e precise navegar via `router.push` — o exemplo mais comum é um
 * botão "Cancelar" que volta para a lista sem passar por um `<a href>`, o
 * caminho que o listener de clique de `<AvisoDeSaida>` não cobre.
 *
 * ```tsx
 * const temAlteracaoNaoSalva = ... // o mesmo booleano passado a `ativo`
 * const navegar = useNavegacaoSegura(temAlteracaoNaoSalva)
 * ...
 * <AvisoDeSaida ativo={temAlteracaoNaoSalva} />
 * <button onClick={() => navegar('/configuracoes/programas')}>Cancelar</button>
 * ```
 *
 * `ativo` em `false` (formulário limpo, ou já salvo) navega sem perguntar —
 * mesma regra do componente.
 */
export function useNavegacaoSegura(ativo: boolean, mensagem: string = MENSAGEM_PADRAO) {
  const router = useRouter()

  return useCallback(
    (destino: string) => {
      if (ativo && !window.confirm(mensagem)) return
      router.push(destino)
    },
    [ativo, mensagem, router],
  )
}
