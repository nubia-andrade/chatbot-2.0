import { CelulaDoDia } from './CelulaDoDia'
import type { DiaDeDisponibilidade } from '@/lib/dominio/disponibilidade'

const NOMES_CURTOS_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Props = {
  dias: DiaDeDisponibilidade[]
  ano: number
  mes: number
  /** Datas (ISO) já escolhidas nesta consulta — vira a borda roxa + badge da célula. */
  selecionadas: string[]
  aoAlternar: (data: string) => void
}

/**
 * A grade do mês — Task 12. Cabeçalho Dom–Sáb, 7 colunas, e as células vazias
 * antes do dia 1 para a primeira semana alinhar com o dia da semana certo.
 *
 * As colunas usam fração (`1fr`), não pixel fixo: numa tela estreita a grade
 * encolhe junto, nunca cria rolagem horizontal — a resposta a "responsivo de
 * verdade" mora em `CelulaDoDia` (tamanhos de fonte e altura mínima por
 * breakpoint), não aqui.
 */
export function GradeDoMes({ dias, ano, mes, selecionadas, aoAlternar }: Props) {
  const selecionadasSet = new Set(selecionadas)
  // Mesmo cálculo de `diaDaSemana` do domínio (UTC, para não escorregar de
  // dia por fuso horário) — aqui só decide quantas células vazias abrem a
  // primeira semana, não é regra de negócio.
  const primeiroDiaDaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const celulasVazias = Array.from({ length: primeiroDiaDaSemana })

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-[6px]" role="row">
        {NOMES_CURTOS_DOS_DIAS.map((nome) => (
          <div
            key={nome}
            className="text-center text-[10.5px] font-bold uppercase tracking-wide text-[var(--texto-2)] sm:text-[11px]"
          >
            {nome}
          </div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:mt-2 sm:gap-[6px]">
        {celulasVazias.map((_, indice) => (
          <div key={`vazia-${indice}`} aria-hidden />
        ))}

        {dias.map((dia) => (
          <CelulaDoDia
            key={dia.data}
            dia={dia}
            selecionada={selecionadasSet.has(dia.data)}
            aoClicar={() => aoAlternar(dia.data)}
          />
        ))}
      </div>
    </div>
  )
}
