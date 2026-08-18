import { CelulaDoDia } from './CelulaDoDia'
import type { ItemDaConsulta } from '@/lib/dominio/consulta'
import type { DiaDeDisponibilidade, Modalidade } from '@/lib/dominio/disponibilidade'

const NOMES_CURTOS_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Props = {
  dias: DiaDeDisponibilidade[]
  ano: number
  mes: number
  modalidade: Modalidade
  itensSelecionados: ItemDaConsulta[]
  aoAlternar: (data: string) => void
  aoAlternarPraca: (data: string, pracaCodigo: string) => void
}

/**
 * A grade do mês. No Nacional, a célula inteira seleciona a data. No Regional,
 * os próprios chips SP/RJ/BH/DF/PE viram controles: uma data está selecionada
 * quando possui ao menos uma praça escolhida.
 */
export function GradeDoMes({
  dias,
  ano,
  mes,
  modalidade,
  itensSelecionados,
  aoAlternar,
  aoAlternarPraca,
}: Props) {
  const itensPorData = new Map(itensSelecionados.map((item) => [item.data, item]))
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

        {dias.map((dia) => {
          const item = itensPorData.get(dia.data)
          const selecionada = Boolean(item && (modalidade === 'nacional' || item.pracas.length > 0))
          return (
            <CelulaDoDia
              key={dia.data}
              dia={dia}
              modalidade={modalidade}
              selecionada={selecionada}
              pracasSelecionadas={item?.pracas ?? []}
              aoClicar={() => aoAlternar(dia.data)}
              aoAlternarPraca={(pracaCodigo) => aoAlternarPraca(dia.data, pracaCodigo)}
            />
          )
        })}
      </div>
    </div>
  )
}
