'use client'

import { useMemo } from 'react'
import {
  useConsulta,
  useGuardaDoPasso,
} from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'

const NOMES_DOS_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function chaveDoMes(dataIso: string): string {
  return dataIso.slice(0, 7)
}

function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  return `${NOMES_DOS_MESES[mes - 1]} ${ano}`
}

/**
 * Passo 5 — Datas.
 *
 * Regra vigente: o mesmo anunciante não pode comprar mais de uma ação na
 * mesma data. Portanto, no nacional cada data selecionada representa sempre
 * UMA nova ação; este passo é de conferência, não de aumento de quantidade.
 *
 * No regional, as praças continuam sendo configuradas no item da consulta;
 * a evolução dessa parte ficará concentrada aqui, sem voltar a colocar
 * quantidade > 1 por data.
 */
export default function PassoDatas() {
  const pronto = useGuardaDoPasso('datas')
  const { estado, atualizar, confirmarDatas } = useConsulta()

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof estado.itens>()
    for (const item of [...estado.itens].sort((a, b) => a.data.localeCompare(b.data))) {
      const chave = chaveDoMes(item.data)
      const atuais = mapa.get(chave) ?? []
      atuais.push(item)
      mapa.set(chave, atuais)
    }
    return [...mapa.entries()]
  }, [estado.itens])

  if (!pronto) {
    return <CarregandoDoPasso />
  }

  function removerData(data: string) {
    atualizar({ itens: estado.itens.filter((item) => item.data !== data) })
  }

  const totalAcoes = estado.itens.length
  const habilitado = totalAcoes > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Confira as datas selecionadas
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Cada data representa uma nova ação. O mesmo anunciante não pode repetir uma data já comprada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          {grupos.map(([mes, itens]) => (
            <section
              key={mes}
              className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)]"
            >
              <header className="flex items-center justify-between border-b border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3">
                <h3 className="text-[13.5px] font-bold text-[var(--texto)]">{rotuloDoMes(mes)}</h3>
                <span className="text-[11.5px] font-semibold text-[var(--texto-3)]">
                  {itens.length} nova{itens.length === 1 ? '' : 's'} ação{itens.length === 1 ? '' : 'ões'}
                </span>
              </header>

              <div className="divide-y divide-[var(--borda)]">
                {itens.map((item) => (
                  <div key={item.data} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div>
                      <p className="text-[13.5px] font-bold text-[var(--texto)]">{formatarData(item.data)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--texto-3)]">
                        1 ação nesta data
                        {estado.modalidade === 'regional' && item.pracas.length > 0
                          ? ` · ${item.pracas.join(', ')}`
                          : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removerData(item.data)}
                      className="rounded-[9px] border border-[var(--borda-forte)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--texto-2)] outline-none hover:bg-[var(--superficie-suave)] focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {grupos.length === 0 && (
            <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-8 text-center text-[13px] text-[var(--texto-3)]">
              Nenhuma data selecionada. Volte ao calendário para escolher ao menos uma data elegível.
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--texto-3)]">Resumo</p>

          <div className="mt-3 flex justify-between gap-3 text-[12.5px] text-[var(--texto-2)]">
            <span>Programa</span>
            <strong className="text-right text-[var(--texto)]">{estado.programaNome ?? '—'}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[12.5px] text-[var(--texto-2)]">
            <span>Anunciante</span>
            <strong className="text-right text-[var(--texto)]">{estado.cliente?.nome ?? '—'}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[12.5px] text-[var(--texto-2)]">
            <span>Datas</span>
            <strong className="text-[var(--texto)]">{totalAcoes}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[12.5px] text-[var(--texto-2)]">
            <span>Novas ações</span>
            <strong className="text-[var(--texto)]">{totalAcoes}</strong>
          </div>

          <div className="mt-4 rounded-[10px] bg-[var(--prazo-fundo)] px-3 py-2.5 text-[11px] leading-[1.5] text-[var(--texto-2)]">
            A seleção ainda não reserva o inventário. A disponibilidade será validada novamente antes de gerar a proposta.
          </div>
        </aside>
      </div>

      <AcoesDoPasso
        voltarPara="calendario"
        avancarPara="resumo"
        avancarRotulo="Ver resumo"
        habilitado={habilitado}
        motivo="Selecione ao menos uma data para continuar"
        aoAvancar={confirmarDatas}
      />
    </div>
  )
}
