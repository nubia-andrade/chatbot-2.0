import type { EstadoDoDia } from '@/lib/dominio/disponibilidade'

/**
 * As cores de cada estado do calendário. Cor nunca é o único indicador:
 * cada estado também possui rótulo textual.
 */
export const CORES_POR_ESTADO: Record<EstadoDoDia, { dot: string; fundo: string; rotulo: string }> = {
  disponivel: { dot: 'var(--disponivel)', fundo: 'var(--disponivel-fundo)', rotulo: 'Disponível' },
  concorrencia: {
    dot: 'var(--concorrencia)',
    fundo: 'var(--concorrencia-fundo)',
    rotulo: 'Indisponível por concorrência',
  },
  ja_comprado: {
    dot: '#2563EB',
    fundo: '#EFF6FF',
    rotulo: '✓ Já comprado',
  },
  limite_mensal: {
    dot: 'var(--roxo)',
    fundo: '#F5F3FF',
    rotulo: 'Limite mensal atingido',
  },
  fora_do_prazo: { dot: 'var(--prazo)', fundo: 'var(--prazo-fundo)', rotulo: 'Fora do prazo mínimo' },
  bloqueado: { dot: 'var(--esgotado)', fundo: 'var(--esgotado-fundo)', rotulo: 'Bloqueado pelo programa' },
  esgotado: { dot: 'var(--esgotado)', fundo: 'var(--esgotado-fundo)', rotulo: 'Esgotado' },
  sem_exibicao: { dot: 'transparent', fundo: 'transparent', rotulo: 'Sem exibição' },
}

export const TEXTO_ACESSIVEL_POR_ESTADO: Partial<Record<EstadoDoDia, string>> = {
  disponivel: 'var(--disponivel-texto)',
  concorrencia: 'var(--concorrencia-texto)',
  ja_comprado: '#1D4ED8',
  limite_mensal: 'var(--roxo)',
  fora_do_prazo: 'var(--prazo-texto)',
  bloqueado: 'var(--esgotado)',
  esgotado: 'var(--esgotado)',
}

const ESTADOS_DA_LEGENDA: EstadoDoDia[] = [
  'disponivel',
  'ja_comprado',
  'limite_mensal',
  'fora_do_prazo',
  'bloqueado',
  'concorrencia',
  'esgotado',
]

export function LegendaDeEstados() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda de estados do calendário">
      {ESTADOS_DA_LEGENDA.map((estado) => (
        <li key={estado} className="flex items-center gap-1.5">
          {estado === 'ja_comprado' ? (
            <span aria-hidden className="text-[12px] font-bold" style={{ color: '#2563EB' }}>✓</span>
          ) : (
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: CORES_POR_ESTADO[estado].dot }}
            />
          )}
          <span className="text-[12px] font-medium text-[var(--texto-2)]">
            {CORES_POR_ESTADO[estado].rotulo}
          </span>
        </li>
      ))}
    </ul>
  )
}
