import Link from 'next/link'
import type { Programa } from '@/lib/dominio/cadastro'

const ROTULOS_ESTADO: Record<Programa['estado'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_configuracao: 'Em configuração',
}

const CORES_ESTADO: Record<Programa['estado'], { cor: string; fundo: string }> = {
  ativo: { cor: 'var(--disponivel)', fundo: 'var(--disponivel-fundo)' },
  inativo: { cor: 'var(--reservado)', fundo: 'var(--reservado-fundo)' },
  em_configuracao: { cor: 'var(--prazo)', fundo: 'var(--prazo-fundo)' },
}

const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function resumoDosDias(dias: number[]): string {
  if (dias.length === 0) return '—'
  return [...dias]
    .sort((a, b) => a - b)
    .map((dia) => NOMES_DIAS[dia] ?? '?')
    .join(', ')
}

/**
 * Tabela com os programas cadastrados — tela de listagem da Task 11.
 *
 * Nome, mnemônico, canal, estado, slots e prazo mínimo é o que o brief pede
 * como colunas: o suficiente para reconhecer um programa sem abrir o
 * formulário inteiro.
 */
export function ListaDeProgramas({ programas }: { programas: Programa[] }) {
  if (programas.length === 0) {
    return (
      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] px-6 py-14 text-center"
        style={{ background: 'var(--superficie-suave)' }}
      >
        <p className="text-[14px] font-semibold text-[var(--texto-2)]">
          Nenhum programa cadastrado ainda.
        </p>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Use o botão &ldquo;Novo programa&rdquo; para começar.
        </p>
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-[var(--raio-card)] border border-[var(--borda)]"
      style={{ background: 'var(--superficie)' }}
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--borda)] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--texto-3)]">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Mnemônico</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Dias</th>
            <th className="px-4 py-3">Slots</th>
            <th className="px-4 py-3">Prazo mínimo</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {programas.map((programa) => {
            const estado = CORES_ESTADO[programa.estado]
            return (
              <tr key={programa.id} className="border-b border-[var(--borda)] last:border-none">
                <td className="px-4 py-3 font-semibold text-[var(--texto)]">{programa.nome}</td>
                <td className="px-4 py-3 text-[var(--texto-2)]">{programa.mnemonico}</td>
                <td className="px-4 py-3 text-[var(--texto-2)]">{programa.canal}</td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ color: estado.cor, background: estado.fundo }}
                  >
                    {ROTULOS_ESTADO[programa.estado]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--texto-3)]">{resumoDosDias(programa.dias_da_semana)}</td>
                <td className="px-4 py-3 text-[var(--texto-2)]">{programa.slots}</td>
                <td className="px-4 py-3 text-[var(--texto-2)]">{programa.prazo_minimo_dias} dias</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/configuracoes/programas/${programa.id}`}
                    className="text-[12.5px] font-semibold text-[var(--roxo)] hover:text-[var(--roxo-hover)]"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
