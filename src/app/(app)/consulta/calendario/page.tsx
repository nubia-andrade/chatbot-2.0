'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { GradeDoMes } from '@/components/consulta/GradeDoMes'
import { LegendaDeEstados } from '@/components/consulta/LegendaDeEstados'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { carregarDisponibilidadeDoCalendario } from '@/lib/acoes/disponibilidade'
import type { ResultadoDeDisponibilidade } from '@/lib/dados/disponibilidade'

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const ERRO_GENERICO = 'Não foi possível carregar a disponibilidade. Tente novamente.'

type Resultado =
  | { chave: string; tipo: 'ok'; dados: ResultadoDeDisponibilidade }
  | { chave: string; tipo: 'erro'; mensagem: string }

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function PassoCalendario() {
  const pronto = useGuardaDoPasso('calendario')
  const { estado, atualizar } = useConsulta()

  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [avisoLimite, setAvisoLimite] = useState<string | null>(null)
  const idDaConsulta = useRef(0)

  const clienteId = estado.cliente?.id ?? null
  const programaId = estado.programaId
  const { modalidade, ano, mes } = estado
  const chaveAtual = `${programaId}|${clienteId}|${modalidade}|${ano}-${mes}|${tentativa}`

  useEffect(() => {
    if (!programaId || !clienteId) return
    const numero = ++idDaConsulta.current

    carregarDisponibilidadeDoCalendario({ programaId, clienteId, modalidade, ano, mes })
      .then((dados) => {
        if (numero !== idDaConsulta.current) return
        if (dados.erro) setResultado({ chave: chaveAtual, tipo: 'erro', mensagem: dados.erro })
        else setResultado({ chave: chaveAtual, tipo: 'ok', dados })
      })
      .catch(() => {
        if (numero !== idDaConsulta.current) return
        setResultado({ chave: chaveAtual, tipo: 'erro', mensagem: ERRO_GENERICO })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, clienteId, modalidade, ano, mes, tentativa])

  useEffect(() => { setAvisoLimite(null) }, [ano, mes])

  if (!pronto) return <CarregandoDoPasso />
  if (!estado.cliente || !programaId) return <CarregandoDoPasso />
  const cliente = estado.cliente

  const carregando = resultado === null || resultado.chave !== chaveAtual
  const comErro = !carregando && resultado?.tipo === 'erro'
  const dados = !carregando && resultado?.tipo === 'ok' ? resultado.dados : null
  const dias = dados?.dias ?? []
  const programa = dados?.programa ?? null
  const mesTodoSemExibicao = !carregando && !comErro && dias.length > 0 && dias.every((dia) => dia.estado === 'sem_exibicao')

  const prefixoMes = `${ano}-${String(mes).padStart(2, '0')}-`
  const limiteMensal = modalidade === 'nacional' ? (dados?.limiteMensal ?? 0) : 0
  const acoesCompradasNoMes = modalidade === 'nacional' ? (dados?.acoesDoAnuncianteNoMes ?? 0) : 0
  const selecionadasNoMes = estado.itens.filter((item) => item.data.startsWith(prefixoMes)).length
  const totalComSelecao = acoesCompradasNoMes + selecionadasNoMes
  const limiteAtingidoComSelecao = limiteMensal > 0 && totalComSelecao >= limiteMensal
  const datasSelecionadas = [...estado.itens].sort((a, b) => a.data.localeCompare(b.data))

  const diasParaExibir = dias.map((dia) => {
    const selecionada = estado.itens.some((item) => item.data === dia.data)
    if (modalidade === 'nacional' && limiteAtingidoComSelecao && !selecionada && dia.estado === 'disponivel') {
      return {
        ...dia,
        estado: 'limite_mensal' as const,
        motivos: [...dia.motivos, `O anunciante atingiu o limite de ${limiteMensal} ações neste programa no mês.`],
      }
    }
    return dia
  })

  function irParaMes(delta: number) {
    let novoMes = estado.mes + delta
    let novoAno = estado.ano
    if (novoMes < 1) { novoMes = 12; novoAno -= 1 }
    else if (novoMes > 12) { novoMes = 1; novoAno += 1 }
    atualizar({ ano: novoAno, mes: novoMes })
  }

  function alternarData(data: string) {
    const jaSelecionada = estado.itens.some((item) => item.data === data)
    if (jaSelecionada) {
      atualizar({ itens: estado.itens.filter((item) => item.data !== data) })
      setAvisoLimite(null)
      return
    }

    if (modalidade === 'nacional' && data.startsWith(prefixoMes) && limiteMensal > 0 && totalComSelecao >= limiteMensal) {
      setAvisoLimite(`${cliente.nome} já atingiu o limite de ${limiteMensal} ações de ${estado.programaNome ?? 'este programa'} neste mês, considerando as compras existentes e esta seleção.`)
      return
    }

    atualizar({ itens: [...estado.itens, { data, quantidade: 1, pracas: [] }] })
    setAvisoLimite(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[19px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>Disponibilidade elegível</h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Disponibilidade elegível para <strong className="text-[var(--texto-2)]">{cliente.nome}</strong>. Selecione as datas verdes e configure os complementos no painel ao lado.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4 rounded-[var(--raio-card)] border border-[var(--borda)] p-4 sm:p-5" style={{ background: 'var(--superficie)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => irParaMes(-1)} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--borda-forte)] text-[15px] font-bold text-[var(--texto-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]">‹</button>
              <p className="min-w-[150px] text-center text-[15px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>{NOMES_DOS_MESES[estado.mes - 1]} {estado.ano}</p>
              <button type="button" onClick={() => irParaMes(1)} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--borda-forte)] text-[15px] font-bold text-[var(--texto-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]">›</button>
            </div>
            <LegendaDeEstados />
          </div>

          {carregando && <EsqueletoDaGrade />}

          {comErro && (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--raio-card)] border px-4 py-10 text-center" style={{ background: 'var(--concorrencia-fundo)', borderColor: 'var(--concorrencia)' }}>
              <p className="text-[13.5px] font-bold" style={{ color: 'var(--concorrencia-texto)' }}>{resultado && resultado.tipo === 'erro' ? resultado.mensagem : ERRO_GENERICO}</p>
              <button type="button" onClick={() => setTentativa((n) => n + 1)} className="rounded-[10px] px-5 py-2 text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]" style={{ background: 'var(--marca)' }}>Tentar de novo</button>
            </div>
          )}

          {mesTodoSemExibicao && <EstadoVazio titulo={`${estado.programaNome ?? 'Este programa'} não vai ao ar em ${NOMES_DOS_MESES[estado.mes - 1].toLowerCase()} de ${estado.ano}`} explicacao="Navegue para outro mês, ou volte e escolha outro programa." />}

          {!carregando && !comErro && !mesTodoSemExibicao && (
            <GradeDoMes dias={diasParaExibir} ano={estado.ano} mes={estado.mes} selecionadas={estado.itens.map((item) => item.data)} aoAlternar={alternarData} />
          )}
        </div>

        <aside className="flex h-fit flex-col rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] p-5 xl:sticky xl:top-5">
          <div>
            <h3 className="text-[14px] font-bold text-[var(--texto)]">Datas selecionadas</h3>
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">A seleção fica salva enquanto você navega entre os meses.</p>
          </div>

          <div className="mt-4 flex max-h-[300px] flex-col gap-2 overflow-y-auto">
            {datasSelecionadas.length === 0 ? (
              <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-white p-4 text-[12px] leading-[1.5] text-[var(--texto-3)]">Selecione uma ou mais datas verdes no calendário.</div>
            ) : datasSelecionadas.map((item) => (
              <div key={item.data} className="flex items-center justify-between gap-3 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--disponivel)]" />
                  <div><p className="text-[12.5px] font-bold text-[var(--texto)]">{formatarData(item.data)}</p><p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">1 nova ação</p></div>
                </div>
                <button type="button" onClick={() => alternarData(item.data)} aria-label={`Remover ${formatarData(item.data)}`} className="cursor-pointer text-[16px] text-[var(--texto-3)]">×</button>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
            <div className="flex justify-between text-[12px] text-[var(--texto-2)]"><span>Datas</span><strong className="text-[var(--texto)]">{estado.itens.length}</strong></div>
            <div className="mt-2 flex justify-between text-[12px] text-[var(--texto-2)]"><span>Novas ações</span><strong className="text-[var(--texto)]">{estado.itens.length}</strong></div>
            {!carregando && !comErro && modalidade === 'nacional' && limiteMensal > 0 && (
              <div className="mt-3 border-t border-[var(--borda)] pt-3">
                <div className="flex justify-between gap-3 text-[11.5px] text-[var(--texto-2)]"><span>Ações já compradas neste mês</span><strong className="whitespace-nowrap text-[var(--texto)]">{acoesCompradasNoMes}/{limiteMensal}</strong></div>
                {selecionadasNoMes > 0 && <div className="mt-2 flex justify-between gap-3 text-[11.5px] text-[var(--texto-2)]"><span>Com esta seleção</span><strong className="whitespace-nowrap text-[var(--roxo)]">{totalComSelecao}/{limiteMensal}</strong></div>}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
            <div>
              <p className="text-[12px] font-bold text-[var(--texto)]">Complementos da proposta</p>
              <p className="mt-1 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">A opção escolhida vale para todas as datas selecionadas.</p>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              <OpcaoComplemento
                titulo="Incluir Digital"
                descricao={programa?.contem_digital ? 'Adiciona mídia e produção digital em todas as ações.' : 'Este programa não está marcado como contendo Digital.'}
                marcado={estado.incluirDigital}
                desabilitado={!programa?.contem_digital}
                aoMudar={(marcado) => atualizar({ incluirDigital: marcado })}
              />
              <OpcaoComplemento
                titulo="Incluir Redes sociais"
                descricao={programa?.redes_sociais ? 'Adiciona o complemento de Redes Sociais em todas as ações.' : 'Este programa não está marcado como tendo Redes Sociais.'}
                marcado={estado.incluirRedesSociais}
                desabilitado={!programa?.redes_sociais}
                aoMudar={(marcado) => atualizar({ incluirRedesSociais: marcado })}
              />
            </div>
          </div>

          {avisoLimite && <div className="mt-3 rounded-[var(--raio-card)] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 text-[11px] leading-[1.5] text-[var(--roxo)]">{avisoLimite}</div>}

          <div className="mt-4 rounded-[var(--raio-card)] bg-[var(--prazo-fundo)] px-4 py-3 text-[10.5px] leading-[1.5] text-[var(--texto-2)]">A consulta valida a disponibilidade neste momento. A seleção ainda não reserva o inventário.</div>

          {estado.itens.length > 0 ? (
            <Link href="/consulta/resumo" className="mt-3 flex h-[46px] w-full items-center justify-center rounded-[12px] text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]" style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}>Continuar para resumo →</Link>
          ) : (
            <button type="button" disabled className="mt-3 h-[46px] w-full cursor-not-allowed rounded-[12px] text-[13px] font-bold text-white opacity-45" style={{ background: 'var(--marca)' }}>Continuar para resumo →</button>
          )}

          <Link href="/consulta/programa" className="mt-3 text-center text-[12px] font-bold text-[var(--texto-2)] underline-offset-2 hover:underline">← Voltar para programa</Link>
        </aside>
      </div>
    </div>
  )
}

function OpcaoComplemento({ titulo, descricao, marcado, desabilitado, aoMudar }: { titulo: string; descricao: string; marcado: boolean; desabilitado: boolean; aoMudar: (marcado: boolean) => void }) {
  return (
    <label className={`flex items-start gap-3 rounded-[10px] border p-3 ${desabilitado ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`} style={{ borderColor: marcado ? 'var(--roxo)' : 'var(--borda)', background: marcado ? '#F5F3FF' : 'var(--superficie-suave)' }}>
      <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={(evento) => aoMudar(evento.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--roxo)]" />
      <span><span className="block text-[11.5px] font-bold text-[var(--texto)]">{titulo}</span><span className="mt-0.5 block text-[10px] leading-[1.4] text-[var(--texto-3)]">{descricao}</span></span>
    </label>
  )
}

function EsqueletoDaGrade() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">Carregando disponibilidade…</span>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-[6px]" aria-hidden>
        {Array.from({ length: 35 }).map((_, indice) => <div key={indice} className="min-h-[64px] animate-pulse rounded-[9px] sm:min-h-[82px] sm:rounded-[11px]" style={{ background: 'var(--superficie-suave)' }} />)}
      </div>
    </div>
  )
}
