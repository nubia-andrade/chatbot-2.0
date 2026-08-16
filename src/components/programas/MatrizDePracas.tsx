'use client'

import { useMemo, useState } from 'react'
import { PRACAS, pracasOcupadasEm, type AcaoRegional } from '@/lib/dominio/regional'
import { dentroDoPrazoMinimo, indexarBloqueios, type DataBloqueada } from '@/lib/dominio/bloqueios'

export type AcaoRegionalDaMatriz = AcaoRegional & { id: string }

type Props = {
  diaDaSemanaRegional: number
  prazoMinimoRegionalDias: number
  acoes: AcaoRegionalDaMatriz[]
  /** Datas bloqueadas do programa — R12 vale para o regional igual ao nacional. */
  bloqueios: DataBloqueada[]
  /** Data de hoje em ISO — recebida do servidor para a "fora de prazo" não depender do relógio do navegador. */
  hojeIso: string
  /** Chamado ao clicar numa data com pelo menos uma praça livre — pré-preenche o formulário de venda. */
  aoEscolherData?: (dataIso: string) => void
}

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function paraIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function formatarDataBR(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}`
}

/** Todas as datas de um mês que caem no dia da semana regional do programa. */
function datasRegionaisDoMes(ano: number, mes: number, diaDaSemana: number): string[] {
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  const datas: string[] = []
  for (let dia = 1; dia <= diasNoMes; dia++) {
    if (new Date(Date.UTC(ano, mes, dia)).getUTCDay() === diaDaSemana) {
      datas.push(paraIso(ano, mes, dia))
    }
  }
  return datas
}

type EstadoDaCelula = 'livre' | 'vendida' | 'fora_de_prazo' | 'bloqueada'

/** Cor de cada estado, sempre por token — nunca hex literal. */
const CORES_DA_CELULA: Record<EstadoDaCelula, { fundo: string; texto: string }> = {
  livre: { fundo: 'var(--disponivel-fundo)', texto: 'var(--disponivel)' },
  vendida: { fundo: 'var(--esgotado-fundo)', texto: 'var(--esgotado)' },
  fora_de_prazo: { fundo: 'var(--prazo-fundo)', texto: 'var(--prazo)' },
  bloqueada: { fundo: 'var(--reservado-fundo)', texto: 'var(--reservado)' },
}

/**
 * A visão principal da aba Regional — Task 12, Step 2.
 *
 * As datas do programa (só o dia da semana regional — sextas no Encontro,
 * sábados no É de Casa) nas linhas, as 5 praças nas colunas. R8 é o que essa
 * grade prova visualmente: cada praça tem seu próprio slot na data, então a
 * mesma linha pode ter 3 células "vendida" e 2 "livre" ao mesmo tempo — um
 * cliente levando SP, RJ e BH numa sexta não esgota DF e PE1.
 *
 * Dois meses por vez, com navegação de 1 mês — mesmo padrão de grade mensal
 * de `CalendarioDeBloqueios`, mas com uma janela dupla porque o slot regional
 * é semanal: um mês só teria 4-5 linhas.
 */
export function MatrizDePracas({
  diaDaSemanaRegional,
  prazoMinimoRegionalDias,
  acoes,
  bloqueios,
  hojeIso,
  aoEscolherData,
}: Props) {
  const hoje = new Date(`${hojeIso}T00:00:00Z`)
  const [ano, setAno] = useState(hoje.getUTCFullYear())
  const [mes, setMes] = useState(hoje.getUTCMonth())

  function irParaMesAnterior() {
    setMes((atual) => {
      if (atual === 0) {
        setAno((a) => a - 1)
        return 11
      }
      return atual - 1
    })
  }

  function irParaProximoMes() {
    setMes((atual) => {
      if (atual === 11) {
        setAno((a) => a + 1)
        return 0
      }
      return atual + 1
    })
  }

  const segundoMes = mes === 11 ? 0 : mes + 1
  const anoDoSegundoMes = mes === 11 ? ano + 1 : ano

  const linhas = useMemo(() => {
    const datas = [
      ...datasRegionaisDoMes(ano, mes, diaDaSemanaRegional),
      ...datasRegionaisDoMes(anoDoSegundoMes, segundoMes, diaDaSemanaRegional),
    ]

    // Quem decide se uma data está bloqueada é `estaBloqueada` (R12);
    // `indexarBloqueios` só a chama para cada data desta janela e guarda o
    // resultado, para a grade não varrer a lista inteira por célula.
    const bloqueiosPorData = indexarBloqueios(bloqueios, datas)

    return datas.map((dataIso) => {
      const bloqueio = bloqueiosPorData.get(dataIso)
      const ocupadas = new Set(pracasOcupadasEm(acoes, dataIso))
      const foraDePrazo = dentroDoPrazoMinimo(hojeIso, dataIso, prazoMinimoRegionalDias)

      const celulas = PRACAS.map((praca) => {
        // R12 vence tudo: uma sexta bloqueada por feriado não tem praça livre
        // nenhuma, por mais que o slot esteja vago.
        if (bloqueio) {
          return { praca, estado: 'bloqueada' as EstadoDaCelula, clienteNome: '' }
        }
        if (ocupadas.has(praca)) {
          const acao = acoes.find((a) => a.data_de_exibicao === dataIso && a.praca_codigo === praca)
          return { praca, estado: 'vendida' as EstadoDaCelula, clienteNome: acao?.cliente_nome ?? '' }
        }
        if (foraDePrazo) {
          return { praca, estado: 'fora_de_prazo' as EstadoDaCelula, clienteNome: '' }
        }
        return { praca, estado: 'livre' as EstadoDaCelula, clienteNome: '' }
      })

      const temPracaLivre = celulas.some((celula) => celula.estado === 'livre')
      return { dataIso, celulas, temPracaLivre, motivoDoBloqueio: bloqueio?.motivo ?? null }
    })
  }, [ano, mes, anoDoSegundoMes, segundoMes, diaDaSemanaRegional, acoes, bloqueios, hojeIso, prazoMinimoRegionalDias])

  return (
    <div
      className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
      style={{ background: 'var(--superficie)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={irParaMesAnterior}
          aria-label="Mês anterior"
          className="h-[34px] w-[34px] cursor-pointer rounded-[10px] border border-[var(--borda-forte)] text-[14px] font-bold text-[var(--texto-2)] hover:bg-[var(--superficie-suave)]"
        >
          ‹
        </button>
        <h3 className="text-[15px] font-bold text-[var(--texto)]">
          {NOMES_DOS_MESES[mes]} – {NOMES_DOS_MESES[segundoMes]} de {anoDoSegundoMes}
        </h3>
        <button
          type="button"
          onClick={irParaProximoMes}
          aria-label="Próximo mês"
          className="h-[34px] w-[34px] cursor-pointer rounded-[10px] border border-[var(--borda-forte)] text-[14px] font-bold text-[var(--texto-2)] hover:bg-[var(--superficie-suave)]"
        >
          ›
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px] font-semibold text-[var(--texto-3)]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-[3px]" style={{ background: 'var(--disponivel)' }} />
          Livre
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-[3px]" style={{ background: 'var(--esgotado)' }} />
          Vendida
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-[3px]" style={{ background: 'var(--prazo)' }} />
          Fora do prazo mínimo
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-[3px]" style={{ background: 'var(--reservado)' }} />
          Data bloqueada
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--texto-3)]">
          Nenhuma data com slot regional nestes dois meses.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="pb-2 text-left font-bold text-[var(--texto-3)]">Data</th>
                {PRACAS.map((praca) => (
                  <th key={praca} className="pb-2 text-center font-bold text-[var(--texto-3)]">
                    {praca}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.dataIso} className="border-t border-[var(--borda)]">
                  <td className="py-2 pr-3 text-left align-top">
                    <button
                      type="button"
                      disabled={!linha.temPracaLivre || !aoEscolherData}
                      onClick={() => aoEscolherData?.(linha.dataIso)}
                      className="text-[13px] font-bold text-[var(--texto)] enabled:cursor-pointer enabled:hover:text-[var(--roxo)] enabled:hover:underline disabled:cursor-default"
                      title={
                        linha.motivoDoBloqueio
                          ? `Data bloqueada: ${linha.motivoDoBloqueio}`
                          : linha.temPracaLivre
                            ? 'Usar esta data no formulário de venda'
                            : 'Nenhuma praça livre nesta data'
                      }
                    >
                      {formatarDataBR(linha.dataIso)}
                    </button>
                    {/* O motivo fica à vista, não só no `title`: quem olha a
                        matriz precisa saber POR QUE a data está fechada sem
                        passar o mouse — e sem telefonar para descobrir. */}
                    {linha.motivoDoBloqueio && (
                      <span
                        className="mt-1 block max-w-[180px] text-[10.5px] font-semibold leading-tight"
                        style={{ color: 'var(--reservado)' }}
                      >
                        Bloqueada: {linha.motivoDoBloqueio}
                      </span>
                    )}
                  </td>
                  {linha.celulas.map((celula) => {
                    const cor = CORES_DA_CELULA[celula.estado]
                    return (
                      <td key={celula.praca} className="py-2 text-center align-top">
                        <span
                          className="mx-auto flex h-[38px] w-full max-w-[92px] flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 text-[10.5px] font-bold"
                          style={{ background: cor.fundo, color: cor.texto }}
                          title={
                            celula.estado === 'bloqueada'
                              ? `Data bloqueada: ${linha.motivoDoBloqueio}`
                              : celula.estado === 'vendida'
                                ? `Vendida para ${celula.clienteNome}`
                                : celula.estado === 'fora_de_prazo'
                                  ? `Fora do prazo mínimo de ${prazoMinimoRegionalDias} dias`
                                  : 'Livre'
                          }
                        >
                          <span className="max-w-full truncate">
                            {celula.estado === 'bloqueada'
                              ? 'Bloqueada'
                              : celula.estado === 'vendida'
                                ? celula.clienteNome
                                : celula.estado === 'fora_de_prazo'
                                  ? 'Fora de prazo'
                                  : 'Livre'}
                          </span>
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
