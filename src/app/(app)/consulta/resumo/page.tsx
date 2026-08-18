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

function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  return `${NOMES_DOS_MESES[mes - 1]} ${ano}`
}

/**
 * Passo 6 — Resumo.
 *
 * É a conferência final da consulta antes da proposta. Não recalcula regra de
 * disponibilidade: apenas apresenta o estado já confirmado no passo Datas.
 * A proposta continua fora deste checkpoint e, por isso, o botão final fica
 * bloqueado até a etapa de preço/template ser conectada.
 */
export default function PassoResumo() {
  const pronto = useGuardaDoPasso('resumo')
  const { estado } = useConsulta()

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof estado.itens>()
    for (const item of [...estado.itens].sort((a, b) => a.data.localeCompare(b.data))) {
      const chave = item.data.slice(0, 7)
      const atuais = mapa.get(chave) ?? []
      atuais.push(item)
      mapa.set(chave, atuais)
    }
    return [...mapa.entries()]
  }, [estado.itens])

  if (!pronto) {
    return <CarregandoDoPasso />
  }

  const totalAcoes = estado.itens.length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Resumo da consulta
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Confira o anunciante, o programa e as novas ações antes da configuração da proposta.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--texto-3)]">Consulta</p>

          <div className="mt-4">
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Anunciante</p>
            <p className="mt-1 text-[14px] font-bold text-[var(--texto)]">{estado.cliente?.nome ?? '—'}</p>
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">
              {estado.cliente?.setor ?? 'Setor não informado'} · {estado.cliente?.industria ?? 'Indústria não informada'}
            </p>
          </div>

          <div className="my-4 border-t border-[var(--borda)]" />

          <div>
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Programa</p>
            <p className="mt-1 text-[14px] font-bold text-[var(--texto)]">{estado.programaNome ?? '—'}</p>
            <p className="mt-1 text-[11.5px] capitalize text-[var(--texto-3)]">Modalidade {estado.modalidade}</p>
          </div>

          <div className="my-4 border-t border-[var(--borda)]" />

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Novas ações</p>
              <p className="mt-1 text-[24px] font-bold text-[var(--texto)]">{totalAcoes}</p>
            </div>
            <span className="rounded-full bg-[var(--disponivel-fundo)] px-3 py-1 text-[11px] font-bold text-[var(--disponivel)]">
              Datas confirmadas
            </span>
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          {grupos.map(([mes, itens]) => (
            <section
              key={mes}
              className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)]"
            >
              <header className="flex items-center justify-between border-b border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3">
                <h3 className="text-[13.5px] font-bold text-[var(--texto)]">{rotuloDoMes(mes)}</h3>
                <span className="text-[11.5px] font-semibold text-[var(--texto-3)]">
                  {itens.length} ação{itens.length === 1 ? '' : 'ões'}
                </span>
              </header>

              <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((item) => (
                  <div
                    key={item.data}
                    className="rounded-[10px] border border-[var(--borda)] bg-[var(--superficie-suave)] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-bold text-[var(--texto)]">{formatarData(item.data)}</p>
                      <span className="text-[11px] font-bold text-[var(--disponivel)]">✓</span>
                    </div>
                    <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">1 nova ação</p>
                    {estado.modalidade === 'regional' && item.pracas.length > 0 && (
                      <p className="mt-1 text-[10.5px] font-semibold text-[var(--texto-2)]">{item.pracas.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-[var(--raio-card)] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 text-[11.5px] leading-[1.55] text-[var(--texto-2)]">
            A disponibilidade exibida é uma fotografia do momento da consulta e ainda não reserva inventário. Antes de gerar a proposta, o sistema fará uma nova validação das datas selecionadas.
          </div>
        </div>
      </div>

      <AcoesDoPasso
        voltarPara="datas"
        avancarPara="proposta"
        avancarRotulo="Gerar proposta"
        habilitado={false}
        motivo="Preço e template da proposta entram no próximo checkpoint"
      />
    </div>
  )
}
