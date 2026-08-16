import { listarRestricoes } from '@/lib/dados/restricoes'
import { EstadoVazio } from '@/components/comum/EstadoVazio'

function descreverAlvo(restricao: { anunciante: string | null; setor: string | null; industria: string | null }): string {
  if (restricao.anunciante) return restricao.anunciante
  if (restricao.setor && restricao.industria) return `${restricao.setor} · ${restricao.industria}`
  if (restricao.setor) return restricao.setor
  if (restricao.industria) return restricao.industria
  return '—'
}

/**
 * Aba Restrições — Task 10 monta a rota e a listagem; o cadastro (por
 * anunciante, por setor+indústria ou só por categoria, com busca na
 * carteira via `CampoDeBuscaDeCliente`) é da Task 11.
 *
 * A guarda de acesso já é do layout (`[id]/layout.tsx`).
 */
export default async function PaginaDeRestricoes({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const restricoes = await listarRestricoes(id)

  if (restricoes.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma restrição cadastrada"
        explicacao="Cadastre restrições por anunciante, por setor e indústria, ou só por categoria, para impedir propostas que o programa não aceita."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {restricoes.map((restricao) => (
        <li
          key={restricao.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
          style={{ background: 'var(--superficie)' }}
        >
          <span className="text-[13.5px] font-bold text-[var(--texto)]">
            {descreverAlvo(restricao)}
          </span>
          <span className="text-[13px] text-[var(--texto-3)]">{restricao.motivo}</span>
        </li>
      ))}
    </ul>
  )
}
