import type { EstadoDoDia } from '@/lib/dominio/disponibilidade'

/**
 * As cores de cada estado do calendário — Task 12. Único lugar do sistema
 * que decide essas cores, para nenhuma outra tela (`CelulaDoDia`,
 * `LegendaDeEstados`) inventar a própria.
 *
 * `dot`/`fundo` são os tokens de `globals.css`, que já valem os hex do
 * handoff (`#16A34A`, `#E11D48`, `#F59E0B`, `#1E1B2E` e os respectivos
 * fundos) — usar os tokens em vez de repetir o hex aqui evita as duas
 * fontes divergirem se um dia o design mudar um tom.
 *
 * `bloqueado` e `esgotado` compartilham dot/fundo no handoff (a mesma cor
 * "tinta" para "o programa não abre este dia" e "não sobrou espaço") — só o
 * rótulo muda, porque o motivo é outro.
 *
 * `sem_exibicao` não é um estado de verdade (é ausência de inventário — ver
 * `disponibilidade.ts`), por isso `dot`/`fundo` são `transparent`: a célula
 * apagada não pinta nada, e o rótulo só existe para o TypeScript exigir uma
 * entrada por chave de `EstadoDoDia`. `LegendaDeEstados` não o exibe.
 */
export const CORES_POR_ESTADO: Record<EstadoDoDia, { dot: string; fundo: string; rotulo: string }> = {
  disponivel: { dot: 'var(--disponivel)', fundo: 'var(--disponivel-fundo)', rotulo: 'Disponível' },
  concorrencia: {
    dot: 'var(--concorrencia)',
    fundo: 'var(--concorrencia-fundo)',
    rotulo: 'Indisponível por concorrência',
  },
  fora_do_prazo: { dot: 'var(--prazo)', fundo: 'var(--prazo-fundo)', rotulo: 'Fora do prazo mínimo' },
  bloqueado: { dot: 'var(--esgotado)', fundo: 'var(--esgotado-fundo)', rotulo: 'Bloqueado pelo programa' },
  esgotado: { dot: 'var(--esgotado)', fundo: 'var(--esgotado-fundo)', rotulo: 'Esgotado' },
  sem_exibicao: { dot: 'transparent', fundo: 'transparent', rotulo: 'Sem exibição' },
}

/**
 * A cor acessível de cada estado quando ele carrega TEXTO — "N livres" na
 * célula, e o preenchimento das miniaturas de praça no regional. `dot` e
 * `fundo` acima foram desenhados para preenchimento/borda, não para texto
 * (ver o comentário de `--disponivel-texto` em `globals.css`): usar `dot`
 * como cor de fonte reproduziria o mesmo defeito de contraste que reprovou
 * a Task 10 (`--prazo` a ≈1,97:1 sobre `--prazo-fundo`).
 */
export const TEXTO_ACESSIVEL_POR_ESTADO: Partial<Record<EstadoDoDia, string>> = {
  disponivel: 'var(--disponivel-texto)',
  concorrencia: 'var(--concorrencia-texto)',
  fora_do_prazo: 'var(--prazo-texto)',
  bloqueado: 'var(--esgotado)',
  esgotado: 'var(--esgotado)',
}

/** A ordem em que os 5 estados de verdade aparecem na legenda — `sem_exibicao` fica de fora (não é um estado, é ausência de inventário). */
const ESTADOS_DA_LEGENDA: EstadoDoDia[] = [
  'disponivel',
  'fora_do_prazo',
  'bloqueado',
  'concorrencia',
  'esgotado',
]

/**
 * Legenda dos 5 estados do calendário — Task 12. Dot colorido **e** rótulo
 * por extenso lado a lado: a tela inteira é feita de cor, então cor nunca
 * pode ser o único jeito de saber o estado (WCAG 1.4.1).
 */
export function LegendaDeEstados() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda de estados do calendário">
      {ESTADOS_DA_LEGENDA.map((estado) => (
        <li key={estado} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: CORES_POR_ESTADO[estado].dot }}
          />
          <span className="text-[12px] font-medium text-[var(--texto-2)]">
            {CORES_POR_ESTADO[estado].rotulo}
          </span>
        </li>
      ))}
    </ul>
  )
}
