'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  consultarDisponibilidadeMensal,
  type ResultadoDaDisponibilidadeMensal,
} from '@/lib/acoes/consulta-disponibilidade'
import type { MarcaDaCarteira } from '@/lib/dados/busca-marcas'

type ProgramaDaConsulta = {
  id: string
  nome: string
  canal: string
  aceita_regional: boolean
}

type Props = {
  marca: MarcaDaCarteira
  programa: ProgramaDaConsulta
  aoVoltar: () => void
}

const MESES = [
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
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const VISUAL = {
  disponivel: { fundo: 'var(--disponivel-fundo)', texto: 'var(--disponivel)', ponto: 'var(--disponivel)' },
  concorrencia: { fundo: 'var(--concorrencia-fundo)', texto: 'var(--concorrencia)', ponto: 'var(--concorrencia)' },
  restricao: { fundo: 'var(--concorrencia-fundo)', texto: 'var(--concorrencia)', ponto: 'var(--concorrencia)' },
  ja_comprado: { fundo: '#EFF6FF', texto: '#2563EB', ponto: '#2563EB' },
  limite_mensal: { fundo: '#F5F3FF', texto: 'var(--roxo)', ponto: 'var(--roxo)' },
  bloqueado: { fundo: 'var(--prazo-fundo)', texto: 'var(--prazo)', ponto: 'var(--prazo)' },
  prazo: { fundo: 'var(--prazo-fundo)', texto: 'var(--prazo)', ponto: 'var(--prazo)' },
  esgotado: { fundo: 'var(--esgotado-fundo)', texto: 'var(--esgotado)', ponto: 'var(--esgotado)' },
  fora_grade: { fundo: 'var(--superficie-suave)', texto: 'var(--texto-3)', ponto: 'var(--borda-forte)' },
} as const

function mesAtual(): { ano: number; mes: number } {
  const agora = new Date()
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }
}

function moverMes(ano: number, mes: number, deslocamento: number) {
  const data = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1))
  return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 }
}

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function rotuloDoEstado(estado: keyof typeof VISUAL, slotsLivres: number): string {
  switch (estado) {
    case 'disponivel':
      return `${slotsLivres} livre${slotsLivres === 1 ? '' : 's'}`
    case 'esgotado':
      return '0 livres'
    case 'concorrencia':
      return 'Concorrência'
    case 'restricao':
      return 'Restrição'
    case 'ja_comprado':
      return '✓ Já comprado'
    case 'limite_mensal':
      return 'Limite mensal'
    case 'prazo':
      return 'Prazo encerrado'
    case 'bloqueado':
      return 'Bloqueado'
    default:
      return ''
  }
}

export function CalendarioDeDisponibilidade({ marca, programa, aoVoltar }: Props) {
  const inicial = useMemo(() => mesAtual(), [])
  const [ano, setAno] = useState(inicial.ano)
  const [mes, setMes] = useState(inicial.mes)
  const [resultado, setResultado] = useState<ResultadoDaDisponibilidadeMensal | null>(null)
  const [datasSelecionadas, setDatasSelecionadas] = useState<string[]>([])
  const [avisoLimite, setAvisoLimite] = useState<string | null>(null)
  const [carregando, iniciarTransicao] = useTransition()

  useEffect(() => {
    let ativa = true
    iniciarTransicao(async () => {
      const resposta = await consultarDisponibilidadeMensal({
        programaId: programa.id,
        clienteId: marca.cliente_id,
        ano,
        mes,
      })
      if (ativa) setResultado(resposta)
    })
    return () => {
      ativa = false
    }
  }, [ano, mes, programa.id, marca.cliente_id])

  const dias = resultado?.dias ?? []
  const deslocamento = dias.length > 0 ? new Date(`${dias[0].data}T00:00:00Z`).getUTCDay() : 0
  const prefixoMes = `${ano}-${String(mes).padStart(2, '0')}`
  const limiteMensal = resultado?.limiteMensal ?? 0
  const acoesCompradasNoMes = resultado?.acoesDoAnuncianteNoMes ?? 0
  const selecionadasNoMes = datasSelecionadas.filter((data) => data.startsWith(`${prefixoMes}-`)).length
  const totalComSelecaoNoMes = acoesCompradasNoMes + selecionadasNoMes
  const temLimiteMensal = limiteMensal > 0
  const limiteAtingidoComSelecao = temLimiteMensal && totalComSelecaoNoMes >= limiteMensal

  function navegar(deslocamentoMes: number) {
    const proximo = moverMes(ano, mes, deslocamentoMes)
    setAno(proximo.ano)
    setMes(proximo.mes)
    setAvisoLimite(null)
  }

  function alternarData(data: string) {
    if (datasSelecionadas.includes(data)) {
      setDatasSelecionadas((atuais) => atuais.filter((item) => item !== data))
      setAvisoLimite(null)
      return
    }

    if (data.startsWith(`${prefixoMes}-`) && temLimiteMensal && totalComSelecaoNoMes >= limiteMensal) {
      setAvisoLimite(
        `${marca.cliente_nome} atingiu o limite de ${limiteMensal} ações de ${programa.nome} neste mês, considerando as datas já compradas e as selecionadas nesta consulta.`,
      )
      return
    }

    setDatasSelecionadas((atuais) => [...atuais, data].sort())
    setAvisoLimite(null)
  }

  return (
    <section className="overflow-hidden rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borda)] px-6 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={aoVoltar}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--borda-forte)] text-[18px] text-[var(--texto-2)] hover:bg-[var(--superficie-suave)]"
            aria-label="Voltar para marca e programa"
          >
            ←
          </button>
          <div>
            <p className="text-[11px] font-semibold text-[var(--texto-3)]">{marca.cliente_nome}</p>
            <h1 className="text-[18px] font-bold text-[var(--texto)]">
              {marca.marca_nome} · {programa.nome}
            </h1>
          </div>
        </div>
        <span className="text-[12px] font-semibold text-[var(--texto-3)]">Etapa 2 de 7</span>
      </header>

      <div className="grid min-h-[650px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5 sm:p-7 xl:border-r xl:border-[var(--borda)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navegar(-1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--borda-forte)] hover:bg-[var(--superficie-suave)]"
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <h2 className="min-w-[160px] text-center text-[20px] font-bold text-[var(--texto)]">
                {MESES[mes - 1]} {ano}
              </h2>
              <button
                type="button"
                onClick={() => navegar(1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--borda-forte)] hover:bg-[var(--superficie-suave)]"
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <div className="text-right">
              <p className="text-[11.5px] text-[var(--texto-3)]">
                Disponibilidade elegível para <strong style={{ color: 'var(--roxo)' }}>{marca.marca_nome}</strong>
              </p>
              {temLimiteMensal && (
                <p className="mt-1 text-[11px] text-[var(--texto-2)]">
                  Ações do anunciante no mês: <strong style={{ color: limiteAtingidoComSelecao ? 'var(--roxo)' : 'var(--texto)' }}>
                    {acoesCompradasNoMes}/{limiteMensal}
                  </strong>
                  {selecionadasNoMes > 0 && (
                    <span> · com seleção: <strong>{totalComSelecaoNoMes}/{limiteMensal}</strong></span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--texto-2)]">
            <Legenda cor="var(--disponivel)" texto="Disponível" />
            <Legenda cor="var(--concorrencia)" texto="Concorrência / restrição" />
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: '#2563EB' }}>
              <span>✓</span> Já comprado
            </span>
            <Legenda cor="var(--roxo)" texto="Limite mensal" />
            <Legenda cor="var(--prazo)" texto="Bloqueado / prazo" />
            <Legenda cor="var(--esgotado)" texto="Esgotado" />
            <span className="font-semibold text-[var(--roxo)]">✦ Preço especial</span>
          </div>

          {resultado?.erro ? (
            <div className="rounded-[var(--raio-card)] bg-[var(--concorrencia-fundo)] p-4 text-[13px] text-[var(--concorrencia)]">
              {resultado.erro}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="pb-1 text-center text-[10px] font-bold text-[var(--texto-3)]">
                    {dia}
                  </div>
                ))}
                {Array.from({ length: deslocamento }, (_, indice) => (
                  <div key={`vazio-${indice}`} aria-hidden />
                ))}
                {dias.map((dia) => {
                  const selecionada = datasSelecionadas.includes(dia.data)
                  const bloqueadaPelaSelecao =
                    dia.estado === 'disponivel' && !selecionada && limiteAtingidoComSelecao
                  const estadoEfetivo = bloqueadaPelaSelecao ? 'limite_mensal' : dia.estado
                  const visual = VISUAL[estadoEfetivo]
                  const motivoEfetivo = bloqueadaPelaSelecao
                    ? `Limite de ${limiteMensal} ações no mês atingido considerando as datas selecionadas.`
                    : dia.motivo

                  return (
                    <button
                      key={dia.data}
                      type="button"
                      disabled={!selecionada && (!dia.selecionavel || bloqueadaPelaSelecao)}
                      onClick={() => alternarData(dia.data)}
                      title={motivoEfetivo ?? dia.periodoEspecial?.nome ?? 'Disponível'}
                      className="relative min-h-[92px] rounded-[12px] border p-2 text-left transition-transform sm:min-h-[100px] sm:p-2.5"
                      style={{
                        background: visual.fundo,
                        borderColor: selecionada ? 'var(--roxo)' : 'var(--borda)',
                        borderWidth: selecionada ? 2 : 1,
                        cursor: selecionada || (dia.selecionavel && !bloqueadaPelaSelecao) ? 'pointer' : 'default',
                        opacity: dia.estado === 'fora_grade' ? 0.55 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[13px] font-bold text-[var(--texto)]">
                          {Number(dia.data.slice(-2))}
                        </span>
                        {selecionada ? (
                          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--roxo)] text-[11px] font-bold text-white">✓</span>
                        ) : estadoEfetivo === 'ja_comprado' ? (
                          <span className="text-[13px] font-bold" style={{ color: '#2563EB' }}>✓</span>
                        ) : (
                          <span className="mt-1 h-2 w-2 rounded-full" style={{ background: visual.ponto }} />
                        )}
                      </div>

                      {dia.estado !== 'fora_grade' && (
                        <div className="mt-5">
                          <p className="text-[11.5px] font-bold" style={{ color: visual.texto }}>
                            {rotuloDoEstado(estadoEfetivo, dia.slotsLivres)}
                          </p>
                          <p className="mt-0.5 text-[9.5px] text-[var(--texto-3)]">
                            {dia.slotsOcupados}/{dia.slotsTotais} ocupados
                          </p>
                        </div>
                      )}

                      {dia.periodoEspecial && (
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[8.5px] font-bold text-[var(--roxo)]">
                          ✦ +{dia.periodoEspecial.percentualAcrescimo}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {carregando && (
                <div className="mt-4 text-center text-[12px] text-[var(--texto-3)]">Atualizando disponibilidade…</div>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col bg-[var(--superficie-suave)] p-5 sm:p-6">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--texto)]">Datas selecionadas</h2>
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">
              Datas já compradas e meses no limite não podem ser selecionados.
            </p>
          </div>

          <div className="mt-4 flex max-h-[360px] flex-col gap-2 overflow-y-auto">
            {datasSelecionadas.length === 0 ? (
              <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-4 text-[12px] leading-[1.5] text-[var(--texto-3)]">
                Selecione uma ou mais datas verdes no calendário.
              </div>
            ) : (
              datasSelecionadas.map((data) => (
                <div key={data} className="flex items-center justify-between gap-3 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-3">
                  <div>
                    <p className="text-[12.5px] font-bold text-[var(--texto)]">{formatarData(data)}</p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">1 slot selecionado</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alternarData(data)}
                    aria-label={`Remover ${formatarData(data)}`}
                    className="cursor-pointer text-[16px] text-[var(--texto-3)]"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
            <div className="flex justify-between text-[12px] text-[var(--texto-2)]">
              <span>Datas</span>
              <strong className="text-[var(--texto)]">{datasSelecionadas.length}</strong>
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-[var(--texto-2)]">
              <span>Slots selecionados</span>
              <strong className="text-[var(--texto)]">{datasSelecionadas.length}</strong>
            </div>
            {temLimiteMensal && (
              <div className="mt-3 border-t border-[var(--borda)] pt-3">
                <div className="flex justify-between text-[12px] text-[var(--texto-2)]">
                  <span>Ações já compradas neste mês</span>
                  <strong className="text-[var(--texto)]">{acoesCompradasNoMes}/{limiteMensal}</strong>
                </div>
                {selecionadasNoMes > 0 && (
                  <div className="mt-2 flex justify-between text-[12px] text-[var(--texto-2)]">
                    <span>Com esta seleção</span>
                    <strong style={{ color: limiteAtingidoComSelecao ? 'var(--roxo)' : 'var(--texto)' }}>
                      {totalComSelecaoNoMes}/{limiteMensal}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {avisoLimite && (
            <div className="mt-3 rounded-[var(--raio-card)] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 text-[11px] leading-[1.5] text-[var(--roxo)]">
              {avisoLimite}
            </div>
          )}

          <div className="mt-auto pt-5">
            <div className="mb-3 rounded-[var(--raio-card)] bg-[var(--prazo-fundo)] px-4 py-3 text-[10.5px] leading-[1.5] text-[var(--texto-2)]">
              A consulta valida a disponibilidade neste momento. A seleção ainda não reserva o inventário.
            </div>
            <button
              type="button"
              disabled
              className="h-[48px] w-full rounded-[12px] text-[13px] font-bold text-white opacity-45"
              style={{ background: 'var(--marca)' }}
              title="A configuração da proposta entra no próximo checkpoint."
            >
              Continuar para proposta →
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
      {texto}
    </span>
  )
}
