'use client'

import { useEffect, useRef, useState } from 'react'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { GradeDoMes } from '@/components/consulta/GradeDoMes'
import { LegendaDeEstados } from '@/components/consulta/LegendaDeEstados'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { carregarDisponibilidadeDoCalendario } from '@/lib/acoes/disponibilidade'
import type { ResultadoDeDisponibilidade } from '@/lib/dados/disponibilidade'

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

const ERRO_GENERICO = 'Não foi possível carregar a disponibilidade. Tente novamente.'

type Resultado =
  | { chave: string; tipo: 'ok'; dados: ResultadoDeDisponibilidade }
  | { chave: string; tipo: 'erro'; mensagem: string }

export default function PassoCalendario() {
  const pronto = useGuardaDoPasso('calendario')
  const { estado, atualizar } = useConsulta()

  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [tentativa, setTentativa] = useState(0)
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
        if (dados.erro) {
          setResultado({ chave: chaveAtual, tipo: 'erro', mensagem: dados.erro })
        } else {
          setResultado({ chave: chaveAtual, tipo: 'ok', dados })
        }
      })
      .catch(() => {
        if (numero !== idDaConsulta.current) return
        setResultado({ chave: chaveAtual, tipo: 'erro', mensagem: ERRO_GENERICO })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, clienteId, modalidade, ano, mes, tentativa])

  if (!pronto) return <CarregandoDoPasso />
  if (!estado.cliente || !programaId) return <CarregandoDoPasso />
  const cliente = estado.cliente

  const carregando = resultado === null || resultado.chave !== chaveAtual
  const comErro = !carregando && resultado?.tipo === 'erro'
  const dados = !carregando && resultado?.tipo === 'ok' ? resultado.dados : null
  const dias = dados?.dias ?? []
  const mesTodoSemExibicao =
    !carregando && !comErro && dias.length > 0 && dias.every((dia) => dia.estado === 'sem_exibicao')

  const limiteMensal = modalidade === 'nacional' ? (dados?.limiteMensal ?? 0) : 0
  const acoesCompradasNoMes = modalidade === 'nacional' ? (dados?.acoesDoAnuncianteNoMes ?? 0) : 0
  const selecionadasNoMes = estado.itens.filter(
    (item) => item.data.startsWith(`${ano}-${String(mes).padStart(2, '0')}-`),
  ).length
  const totalComSelecao = acoesCompradasNoMes + selecionadasNoMes

  function irParaMes(delta: number) {
    let novoMes = estado.mes + delta
    let novoAno = estado.ano
    if (novoMes < 1) {
      novoMes = 12
      novoAno -= 1
    } else if (novoMes > 12) {
      novoMes = 1
      novoAno += 1
    }
    atualizar({ ano: novoAno, mes: novoMes })
  }

  function alternarData(data: string) {
    const jaSelecionada = estado.itens.some((item) => item.data === data)
    const proximosItens = jaSelecionada
      ? estado.itens.filter((item) => item.data !== data)
      : [...estado.itens, { data, quantidade: 1, pracas: [] }]
    atualizar({ itens: proximosItens })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-[19px] font-bold text-[var(--texto)]"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            Disponibilidade elegível
          </h2>
          <p className="mt-1 text-[13px] text-[var(--texto-3)]">
            Disponibilidade elegível para <strong className="text-[var(--texto-2)]">{cliente.nome}</strong>.
            Só datas em verde (Disponível) podem ser selecionadas.
          </p>
        </div>

        {!carregando && !comErro && modalidade === 'nacional' && limiteMensal > 0 && (
          <div className="min-w-[220px] rounded-[12px] border border-[var(--borda)] bg-[var(--superficie)] px-4 py-3 text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-[.04em] text-[var(--texto-3)]">
              Ações já compradas neste mês
            </p>
            <p className="mt-1 text-[17px] font-bold text-[var(--texto)]">
              {acoesCompradasNoMes}/{limiteMensal}
            </p>
            {selecionadasNoMes > 0 && (
              <p className="mt-1 text-[11px] text-[var(--texto-3)]">
                Com esta seleção: <strong className="text-[var(--roxo)]">{totalComSelecao}/{limiteMensal}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-[var(--raio-card)] border border-[var(--borda)] p-4 sm:p-5" style={{ background: 'var(--superficie)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => irParaMes(-1)}
              aria-label="Mês anterior"
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--borda-forte)] text-[15px] font-bold text-[var(--texto-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
            >
              ‹
            </button>
            <p className="min-w-[150px] text-center text-[15px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
              {NOMES_DOS_MESES[estado.mes - 1]} {estado.ano}
            </p>
            <button
              type="button"
              onClick={() => irParaMes(1)}
              aria-label="Próximo mês"
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--borda-forte)] text-[15px] font-bold text-[var(--texto-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
            >
              ›
            </button>
          </div>

          <LegendaDeEstados />
        </div>

        {carregando && <EsqueletoDaGrade />}

        {comErro && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--raio-card)] border px-4 py-10 text-center" style={{ background: 'var(--concorrencia-fundo)', borderColor: 'var(--concorrencia)' }}>
            <p className="text-[13.5px] font-bold" style={{ color: 'var(--concorrencia-texto)' }}>
              {resultado && resultado.tipo === 'erro' ? resultado.mensagem : ERRO_GENERICO}
            </p>
            <button
              type="button"
              onClick={() => setTentativa((n) => n + 1)}
              className="rounded-[10px] px-5 py-2 text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)]"
              style={{ background: 'var(--marca)' }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {mesTodoSemExibicao && (
          <EstadoVazio
            titulo={`${estado.programaNome ?? 'Este programa'} não vai ao ar em ${NOMES_DOS_MESES[estado.mes - 1].toLowerCase()} de ${estado.ano}`}
            explicacao="Navegue para outro mês, ou volte e escolha outro programa."
          />
        )}

        {!carregando && !comErro && !mesTodoSemExibicao && (
          <GradeDoMes
            dias={dias}
            ano={estado.ano}
            mes={estado.mes}
            selecionadas={estado.itens.map((item) => item.data)}
            aoAlternar={alternarData}
          />
        )}
      </div>

      <AcoesDoPasso
        voltarPara="programa"
        avancarPara="datas"
        avancarRotulo="Ver datas selecionadas"
        habilitado={estado.itens.length > 0}
        motivo="Selecione ao menos uma data para continuar"
      />
    </div>
  )
}

function EsqueletoDaGrade() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">Carregando disponibilidade…</span>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-[6px]" aria-hidden>
        {Array.from({ length: 35 }).map((_, indice) => (
          <div
            key={indice}
            className="min-h-[64px] animate-pulse rounded-[9px] sm:min-h-[82px] sm:rounded-[11px]"
            style={{ background: 'var(--superficie-suave)' }}
          />
        ))}
      </div>
    </div>
  )
}
