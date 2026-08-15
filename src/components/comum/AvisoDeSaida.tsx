'use client'

import { useEffect } from 'react'

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
 * Dois caminhos de saída, duas técnicas:
 *
 * 1. Fechar a aba, recarregar ou digitar outra URL: `beforeunload` é o único
 *    gancho que o navegador dá para isso, e a mensagem que ele mostra é a
 *    dele, fixa — não a nossa (é assim desde que sites abusavam do texto
 *    livre para prender quem tentava sair).
 *
 * 2. Clicar num link interno (menu, "Cancelar", outra linha de uma lista):
 *    o Next 16 só oferece interceptação por link individual, via o
 *    `onNavigate` do `<Link>` (node_modules/next/dist/docs/.../link.md,
 *    seção "Blocking navigation") — não existe um gancho global de router.
 *    Envolver cada `<Link>` do app com esse prop derrotaria o propósito de
 *    ter uma peça reutilizável só aqui. Em vez disso, este componente ouve
 *    `click` em fase de captura no `document`. Captura corre do topo da
 *    árvore para baixo, então dispara antes do próprio `<Link>` (cujo
 *    `onClick` o React liga por delegação, em fase de propagação, mais
 *    abaixo) — dá para interceptar e cancelar a navegação de qualquer link
 *    interno sem precisar conhecer cada um.
 *
 * O clique fora de um link (ex.: botão que chama `router.push` direto) não
 * passa por aqui — quem dispara essa navegação já sabe que há alteração
 * pendente e decide se confirma antes de chamar.
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
