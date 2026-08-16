import { notFound } from 'next/navigation'
import { obterPrograma } from '@/lib/dados/programas'
import { listarAcoesRegionais } from '@/lib/dados/acoes-regionais'
import { EstadoVazio } from '@/components/comum/EstadoVazio'

function formatarData(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return '—'
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

/**
 * Aba Regional — Task 10 monta a rota e a listagem das ações já vendidas; a
 * grade mensal de disponibilidade por praça, o preço por praça e a sugestão
 * de praças a partir do `descritivo_da_acao` da API são da Task 12.
 *
 * `AbasDoPrograma` só mostra este link quando `aceita_regional` é
 * verdadeiro, mas isso é conveniência de interface — quem digitar a URL de
 * um programa que não vende regional recebe `notFound()` aqui, igual à
 * guarda do layout: a aba não existe para este programa.
 */
export default async function PaginaDeRegional({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const programa = await obterPrograma(id)

  if (!programa || !programa.aceita_regional) notFound()

  const acoes = await listarAcoesRegionais(id)

  if (acoes.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma ação regional vendida ainda"
        explicacao="Ações regionais aparecem aqui por praça, com a data de exibição e o cliente."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {acoes.map((acao) => (
        <li
          key={acao.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
          style={{ background: 'var(--superficie)' }}
        >
          <span className="text-[13.5px] font-bold text-[var(--texto)]">
            {formatarData(acao.data_de_exibicao)} · {acao.praca_codigo}
          </span>
          <span className="text-[13px] text-[var(--texto-3)]">{acao.cliente_nome}</span>
        </li>
      ))}
    </ul>
  )
}
