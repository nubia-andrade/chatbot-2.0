import { listarDatasBloqueadas } from '@/lib/dados/datas-bloqueadas'
import { EstadoVazio } from '@/components/comum/EstadoVazio'

function formatarData(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return '—'
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

/**
 * Aba Datas bloqueadas — Task 10 monta a rota e a listagem; o cadastro (o
 * formulário que bloqueia uma data com motivo) é da Task 11, junto com a
 * grade mensal (calendário) que a spec pede para esta tela.
 *
 * A guarda de acesso já é do layout (`[id]/layout.tsx`) — chegar aqui já
 * significa que a pessoa pode ver e editar este programa.
 */
export default async function PaginaDeDatasBloqueadas({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const datas = await listarDatasBloqueadas(id)

  if (datas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma data bloqueada"
        explicacao="Bloqueie datas em que o programa não aceita ação, como feriados."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {datas.map((data) => (
        <li
          key={data.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
          style={{ background: 'var(--superficie)' }}
        >
          <span className="text-[13.5px] font-bold text-[var(--texto)]">
            {formatarData(data.data)}
          </span>
          <span className="text-[13px] text-[var(--texto-3)]">{data.motivo}</span>
        </li>
      ))}
    </ul>
  )
}
