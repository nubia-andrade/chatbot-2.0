'use client'

import { useMemo, useState } from 'react'
import { bloquearDatas, desbloquearData } from '@/lib/acoes/datas-bloqueadas'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'

type Bloqueio = {
  id: string
  data: string
  motivo: string
}

type Props = {
  programaId: string
  bloqueiosIniciais: Bloqueio[]
}

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const NOMES_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function paraIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function formatarDataBR(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return iso
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

/** Célula vazia à esquerda do dia 1, para o dia da semana bater na grade. */
type Celula = { dia: number; iso: string } | null

function montarGrade(ano: number, mes: number): Celula[] {
  const primeiroDiaDaSemana = new Date(Date.UTC(ano, mes, 1)).getUTCDay()
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()

  const celulas: Celula[] = []
  for (let i = 0; i < primeiroDiaDaSemana; i++) celulas.push(null)
  for (let dia = 1; dia <= diasNoMes; dia++) celulas.push({ dia, iso: paraIso(ano, mes, dia) })
  return celulas
}

/**
 * Calendário de bloqueios — Task 11, Step 1.
 *
 * Grade mensal navegável, não lista de datas ("Calendário se mostra como
 * calendário", spec da Entrega 2). Clicar numa data livre a acrescenta à
 * seleção; várias datas podem ser marcadas antes de confirmar uma vez só,
 * todas com o mesmo motivo. Datas já bloqueadas aparecem em
 * `var(--esgotado-fundo)`, com o motivo no `title` e também como texto
 * visível na célula — cor sozinha nunca é o indicador.
 */
export function CalendarioDeBloqueios({ programaId, bloqueiosIniciais }: Props) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const [bloqueios, setBloqueios] = useState<Bloqueio[]>(bloqueiosIniciais)
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const [gravando, setGravando] = useState(false)
  const [desbloqueandoData, setDesbloqueandoData] = useState<string | null>(null)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)

  const bloqueiosPorData = useMemo(() => {
    const mapa = new Map<string, Bloqueio>()
    for (const bloqueio of bloqueios) mapa.set(bloqueio.data, bloqueio)
    return mapa
  }, [bloqueios])

  const celulas = useMemo(() => montarGrade(ano, mes), [ano, mes])

  const temAlteracaoNaoSalva = selecionadas.length > 0 || motivo.trim() !== ''

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

  function alternarSelecao(iso: string) {
    if (bloqueiosPorData.has(iso)) return
    setSucesso(null)
    setSelecionadas((atual) =>
      atual.includes(iso) ? atual.filter((data) => data !== iso) : [...atual, iso],
    )
  }

  async function confirmarBloqueio() {
    const motivoLimpo = motivo.trim()
    if (motivoLimpo === '' || selecionadas.length === 0) return

    setGravando(true)
    setErros([])
    setSucesso(null)

    const resultado = await bloquearDatas(programaId, selecionadas, motivoLimpo)

    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
    }

    // Mesmo com alguns erros (uma data que já estava bloqueada), as demais
    // do lote podem ter entrado — recarrega a lista real em vez de deduzir.
    const bloqueadasComSucesso = selecionadas.filter(
      (iso) => !resultado.erros.some((erro) => erro.startsWith(formatarDataBR(iso))),
    )

    if (bloqueadasComSucesso.length > 0) {
      setBloqueios((atual) => [
        ...atual,
        ...bloqueadasComSucesso.map((iso) => ({
          id: `temporario-${iso}`,
          data: iso,
          motivo: motivoLimpo,
        })),
      ])
      setSucesso(
        bloqueadasComSucesso.length === 1
          ? '1 data bloqueada.'
          : `${bloqueadasComSucesso.length} datas bloqueadas.`,
      )
      setSelecionadas([])
      setMotivo('')
    }
  }

  async function desbloquear(iso: string) {
    setDesbloqueandoData(iso)
    setErros([])
    setSucesso(null)

    const resultado = await desbloquearData(programaId, iso)

    setDesbloqueandoData(null)

    if (resultado.erro) {
      setErros([resultado.erro])
      return
    }

    setBloqueios((atual) => atual.filter((bloqueio) => bloqueio.data !== iso))
    setSucesso('Data desbloqueada.')
  }

  const listaOrdenada = [...bloqueios].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <AvisoDeSaida ativo={temAlteracaoNaoSalva} />

      <section
        className="flex-1 rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
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
            {NOMES_DOS_MESES[mes]} de {ano}
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

        <div className="mt-4 grid grid-cols-7 gap-[6px]">
          {NOMES_DOS_DIAS.map((nome) => (
            <div key={nome} className="text-center text-[11px] font-bold text-[var(--texto-3)]">
              {nome}
            </div>
          ))}

          {celulas.map((celula, indice) => {
            if (!celula) return <div key={`vazia-${indice}`} />

            const bloqueio = bloqueiosPorData.get(celula.iso)
            const selecionada = selecionadas.includes(celula.iso)

            return (
              <button
                key={celula.iso}
                type="button"
                onClick={() => alternarSelecao(celula.iso)}
                disabled={Boolean(bloqueio)}
                title={bloqueio ? `Bloqueada: ${bloqueio.motivo}` : undefined}
                aria-pressed={selecionada}
                aria-label={
                  bloqueio
                    ? `${celula.dia}, bloqueada: ${bloqueio.motivo}`
                    : `${celula.dia}${selecionada ? ', selecionada' : ''}`
                }
                className="flex h-[54px] flex-col items-center justify-center gap-[2px] rounded-[var(--raio-campo)] border text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)] disabled:cursor-default"
                style={{
                  background: bloqueio
                    ? 'var(--esgotado-fundo)'
                    : selecionada
                      ? 'var(--superficie-suave)'
                      : 'var(--superficie)',
                  borderColor: selecionada ? 'var(--roxo)' : 'var(--borda)',
                  borderWidth: selecionada ? 2 : 1,
                  color: bloqueio ? 'var(--esgotado)' : 'var(--texto)',
                }}
              >
                <span>{celula.dia}</span>
                {bloqueio && <span className="text-[8.5px] font-bold uppercase tracking-wide">Bloqueada</span>}
                {!bloqueio && selecionada && (
                  <span className="text-[8.5px] font-bold uppercase tracking-wide text-[var(--roxo)]">
                    Selecionada
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <aside className="flex w-full flex-col gap-4 lg:w-[320px]">
        <section
          className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
          style={{ background: 'var(--superficie)' }}
        >
          <h3 className="text-[14px] font-bold text-[var(--texto)]">
            {selecionadas.length === 0
              ? 'Nenhuma data selecionada'
              : selecionadas.length === 1
                ? '1 data selecionada'
                : `${selecionadas.length} datas selecionadas`}
          </h3>

          {selecionadas.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {[...selecionadas].sort().map((iso) => (
                <li
                  key={iso}
                  className="rounded-full px-2 py-[3px] text-[11px] font-semibold text-[var(--texto-2)]"
                  style={{ background: 'var(--superficie-suave)' }}
                >
                  {formatarDataBR(iso)}
                </li>
              ))}
            </ul>
          )}

          <label htmlFor="motivo-do-bloqueio" className="mb-[7px] mt-4 block text-[12px] font-semibold text-[var(--texto-2)]">
            Motivo (obrigatório)
          </label>
          <textarea
            id="motivo-do-bloqueio"
            value={motivo}
            onChange={(evento) => {
              setMotivo(evento.target.value)
              setSucesso(null)
            }}
            placeholder="Ex.: Feriado nacional, reprise, período já comprometido…"
            rows={3}
            className="w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] p-3 text-[13px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />

          {erros.length > 0 && (
            <ul role="alert" className="mt-3 flex flex-col gap-1">
              {erros.map((erro) => (
                <li key={erro} className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
                  {erro}
                </li>
              ))}
            </ul>
          )}

          {sucesso && (
            <p role="status" className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--disponivel)' }}>
              {sucesso}
            </p>
          )}

          <BotaoDeGravacao
            type="button"
            gravando={gravando}
            desabilitado={selecionadas.length === 0 || motivo.trim() === ''}
            onClick={confirmarBloqueio}
            className="mt-4 w-full"
          >
            {selecionadas.length <= 1 ? 'Bloquear data' : `Bloquear ${selecionadas.length} datas`}
          </BotaoDeGravacao>
        </section>

        <section
          className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
          style={{ background: 'var(--superficie)' }}
        >
          <h3 className="text-[14px] font-bold text-[var(--texto)]">Datas bloqueadas</h3>

          {listaOrdenada.length === 0 ? (
            <div className="mt-3">
              <EstadoVazio
                titulo="Nenhuma data bloqueada"
                explicacao="Bloqueie datas em que o programa não aceita ação, como feriados."
              />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {listaOrdenada.map((bloqueio) => (
                <li
                  key={bloqueio.id}
                  className="flex flex-col gap-1 rounded-[10px] border border-[var(--borda)] p-3"
                  style={{ background: 'var(--superficie-suave)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[var(--texto)]">
                      {formatarDataBR(bloqueio.data)}
                    </span>
                    <button
                      type="button"
                      onClick={() => desbloquear(bloqueio.data)}
                      disabled={desbloqueandoData === bloqueio.data}
                      className="cursor-pointer text-[12px] font-semibold enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ color: 'var(--concorrencia)' }}
                    >
                      {desbloqueandoData === bloqueio.data ? 'Desbloqueando…' : 'Desbloquear'}
                    </button>
                  </div>
                  <span className="text-[12px] text-[var(--texto-3)]">{bloqueio.motivo}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
