import type { ReactNode } from 'react'

type Props = {
  titulo: string
  explicacao: string
  acao?: ReactNode
}

/**
 * O estado "vazio" de uma lista — um dos quatro que toda lista desta
 * entrega precisa ter (carregando, vazio, com erro, cheio).
 *
 * Uma lista vazia sem contexto ("Nenhum registro") não diz o que aquele
 * espaço guarda nem por que vale a pena preenchê-lo. `explicacao` é o lugar
 * para isso — por exemplo "Nenhuma data bloqueada. Bloqueie datas em que o
 * programa não aceita ação, como feriados" — e `acao` é o espaço reservado
 * para o botão que resolve o vazio.
 */
export function EstadoVazio({ titulo, explicacao, acao }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-6 py-12 text-center">
      <h3 className="text-[15px] font-bold text-[var(--texto)]">{titulo}</h3>
      <p className="max-w-[420px] text-[13px] text-[var(--texto-3)]">{explicacao}</p>
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}
