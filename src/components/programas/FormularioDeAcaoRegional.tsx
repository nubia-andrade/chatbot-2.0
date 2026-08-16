'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { registrarAcaoRegional, buscarSugestaoDeAcao } from '@/lib/acoes/regional'
import { PRACAS, pracasOcupadasEm, validarCompra, type AcaoRegional } from '@/lib/dominio/regional'
import { dentroDoPrazoMinimo, estaBloqueada, type DataBloqueada } from '@/lib/dominio/bloqueios'
import { CampoDeBuscaDeCliente } from '@/components/comum/CampoDeBuscaDeCliente'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { AcaoRegionalDaMatriz } from './MatrizDePracas'

type Props = {
  programaId: string
  diaDaSemanaRegional: number
  prazoMinimoRegionalDias: number
  maxPracasPorAcao: number
  hojeIso: string
  acoes: AcaoRegionalDaMatriz[]
  /** Datas bloqueadas do programa — R12 vale para o regional igual ao nacional. */
  bloqueios: DataBloqueada[]
  /** Data escolhida ao clicar numa célula livre da matriz — pré-preenche o seletor abaixo. */
  dataSugeridaPelaMatriz: string | null
  aoRegistrar: (novas: AcaoRegionalDaMatriz[]) => void
}

const QUANTIDADE_DE_DATAS_NO_SELETOR = 16
const ATRASO_DA_SUGESTAO_MS = 300

/** As próximas N datas que caem no dia da semana regional, a partir de hoje (inclusive). */
function proximasDatasComSlot(diaDaSemana: number, hojeIso: string, quantidade: number): string[] {
  const hoje = new Date(`${hojeIso}T00:00:00Z`)
  const datas: string[] = []
  const cursor = new Date(hoje)
  // Avança até cair no dia da semana certo.
  while (cursor.getUTCDay() !== diaDaSemana) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  for (let i = 0; i < quantidade; i++) {
    datas.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return datas
}

function formatarDataBR(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

/**
 * Registro de ação vendida — Task 12, Step 3.
 *
 * O seletor de data só lista datas que TÊM slot regional (o dia da semana
 * certo) — as demais nem aparecem, o que cumpre "as demais desabilitadas" do
 * brief sem precisar de um segundo calendário: cada opção mostra também
 * quantas praças seguem livres, e fica desabilitada quando a data está fora
 * do prazo mínimo ou já vendeu as 5.
 *
 * Ao trocar de data, pergunta a `buscarSugestaoDeAcao` (Task 12) se existe
 * uma entrega da API nesse programa e data — se existir, mostra o aviso de
 * sugestão. Hoje essa função nunca pré-marca praças sozinha (ver o comentário
 * dela): a base importada não guarda o texto descritivo da ação, então não
 * há de onde extrair praça com confiança. O código abaixo já sabe pré-marcar
 * se `pracasSugeridas` vier preenchido no futuro — não é gambiarra à toa.
 */
export function FormularioDeAcaoRegional({
  programaId,
  diaDaSemanaRegional,
  prazoMinimoRegionalDias,
  maxPracasPorAcao,
  hojeIso,
  acoes,
  bloqueios,
  dataSugeridaPelaMatriz,
  aoRegistrar,
}: Props) {
  const datasDisponiveis = useMemo(
    () => proximasDatasComSlot(diaDaSemanaRegional, hojeIso, QUANTIDADE_DE_DATAS_NO_SELETOR),
    [diaDaSemanaRegional, hojeIso],
  )

  const [data, setData] = useState(dataSugeridaPelaMatriz ?? datasDisponiveis[0] ?? '')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [pracasSelecionadas, setPracasSelecionadas] = useState<string[]>([])
  const [origem, setOrigem] = useState<'manual' | 'sugerido_api'>('manual')

  // Sugestão amarrada à data a que se refere (`paraData`) — em vez de
  // limpar o estado sincronamente num efeito (padrão que o linter de hooks
  // rejeita: "Calling setState synchronously within an effect"), a tela só
  // MOSTRA a sugestão quando `paraData` bate com a data escolhida agora. Ao
  // trocar de data, a sugestão antiga para de aparecer sozinha, sem precisar
  // de um `setState` extra disparado pelo efeito.
  const [sugestao, setSugestao] = useState<{
    paraData: string
    descricao: string
    limitacao: string | null
  } | null>(null)
  const [buscandoSugestao, setBuscandoSugestao] = useState(false)

  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)

  const idDaConsulta = useRef(0)

  // Sincroniza `data` com a última data clicada na matriz sem chamar
  // `setState` dentro de um efeito: compara a prop com o valor visto da
  // última vez durante a própria renderização (o padrão que o React
  // recomenda para "ajustar estado quando uma prop muda").
  const [ultimaDataDaMatriz, setUltimaDataDaMatriz] = useState(dataSugeridaPelaMatriz)
  if (dataSugeridaPelaMatriz !== ultimaDataDaMatriz) {
    setUltimaDataDaMatriz(dataSugeridaPelaMatriz)
    if (dataSugeridaPelaMatriz) setData(dataSugeridaPelaMatriz)
  }

  // Busca a sugestão da API sempre que a data muda — 300ms depois, mesmo
  // debounce do resto do app, para não disparar uma consulta a cada troca
  // rápida no seletor.
  useEffect(() => {
    if (!data) return
    const numero = ++idDaConsulta.current
    const temporizador = setTimeout(async () => {
      setBuscandoSugestao(true)
      const resultado = await buscarSugestaoDeAcao(programaId, data)
      if (numero !== idDaConsulta.current) return
      setBuscandoSugestao(false)
      if (resultado.entregaEncontrada && resultado.descricao) {
        setSugestao({ paraData: data, descricao: resultado.descricao, limitacao: resultado.limitacao })
        if (resultado.pracasSugeridas.length > 0 && pracasSelecionadas.length === 0) {
          setPracasSelecionadas(resultado.pracasSugeridas)
          setOrigem('sugerido_api')
        }
      }
    }, ATRASO_DA_SUGESTAO_MS)
    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, programaId])

  const sugestaoAtual = sugestao?.paraData === data ? sugestao : null
  const foraDePrazo = data !== '' && dentroDoPrazoMinimo(hojeIso, data, prazoMinimoRegionalDias)
  // R12 — quem decide é `estaBloqueada`; aqui só perguntamos.
  const bloqueioDaData = data === '' ? null : estaBloqueada(bloqueios, data)

  const acaoPorPraca = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const acao of acoes) {
      if (acao.data_de_exibicao === data) mapa.set(acao.praca_codigo, acao.cliente_nome)
    }
    return mapa
  }, [acoes, data])

  function alternarPraca(praca: string) {
    setSucesso(null)
    setPracasSelecionadas((atual) => {
      if (atual.includes(praca)) return atual.filter((p) => p !== praca)
      if (atual.length >= maxPracasPorAcao) return atual
      return [...atual, praca]
    })
    // Praça marcada à mão deixa de ser puramente "sugerida pela API".
    setOrigem('manual')
  }

  const temAlteracaoNaoSalva = Boolean(cliente) || pracasSelecionadas.length > 0

  async function registrar() {
    setErros([])
    setSucesso(null)

    if (!cliente) {
      setErros(['Escolha um cliente da carteira.'])
      return
    }

    // Confere localmente antes de gravar — a mesma regra (Task 3) que decide
    // a matriz, para o erro aparecer sem round-trip quando é óbvio (praça já
    // ocupada na tela, mais de `maxPracasPorAcao`). `registrarAcaoRegional`
    // roda a MESMA função de novo contra o banco fresco antes de gravar: é
    // ela quem decide de verdade, isto aqui só evita uma viagem ao servidor
    // para o erro mais comum.
    const config = { aceita_regional: true, dia_da_semana_regional: diaDaSemanaRegional, max_pracas_por_acao: maxPracasPorAcao }
    const errosLocais = validarCompra(config, acoes as AcaoRegional[], data, pracasSelecionadas, {
      clienteNome: cliente.nome,
      bloqueios,
    })
    if (!bloqueioDaData && foraDePrazo) {
      errosLocais.push(`Esta data está fora do prazo mínimo de ${prazoMinimoRegionalDias} dias.`)
    }
    if (errosLocais.length > 0) {
      setErros(errosLocais)
      return
    }

    setGravando(true)
    const resultado = await registrarAcaoRegional(programaId, {
      data,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      pracas: pracasSelecionadas,
      origem,
    })
    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      return
    }

    aoRegistrar(
      pracasSelecionadas.map((praca) => ({
        id: `temporario-${data}-${praca}`,
        data_de_exibicao: data,
        cliente_nome: cliente.nome,
        praca_codigo: praca,
      })),
    )

    setSucesso(
      pracasSelecionadas.length === 1
        ? `Ação registrada em 1 praça para ${cliente.nome}.`
        : `Ação registrada em ${pracasSelecionadas.length} praças para ${cliente.nome}.`,
    )
    setCliente(null)
    setPracasSelecionadas([])
    setOrigem('manual')
  }

  return (
    <div
      className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
      style={{ background: 'var(--superficie)' }}
    >
      <AvisoDeSaida ativo={temAlteracaoNaoSalva} />
      <h3 className="text-[14px] font-bold text-[var(--texto)]">Registrar ação vendida</h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[var(--texto-2)]">Data</span>
          <select
            value={data}
            onChange={(evento) => {
              setData(evento.target.value)
              setPracasSelecionadas([])
              setSucesso(null)
              setErros([])
            }}
            className="h-[44px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
          >
            {datasDisponiveis.map((iso) => {
              const livres = PRACAS.length - pracasOcupadasEm(acoes, iso).length
              const bloqueadaPeloPrazo = dentroDoPrazoMinimo(hojeIso, iso, prazoMinimoRegionalDias)
              const bloqueio = estaBloqueada(bloqueios, iso)
              return (
                <option
                  key={iso}
                  value={iso}
                  disabled={Boolean(bloqueio) || bloqueadaPeloPrazo || livres === 0}
                >
                  {formatarDataBR(iso)}
                  {bloqueio
                    ? ` (bloqueada: ${bloqueio.motivo})`
                    : bloqueadaPeloPrazo
                      ? ' (fora do prazo mínimo)'
                      : livres === 0
                        ? ' (esgotada)'
                        : ` (${livres} praça${livres > 1 ? 's' : ''} livre${livres > 1 ? 's' : ''})`}
                </option>
              )
            })}
          </select>
        </label>

        <CampoDeBuscaDeCliente
          rotulo="Cliente"
          aoEscolher={(escolhido) => {
            setCliente(escolhido)
            setSucesso(null)
          }}
        />
      </div>

      {bloqueioDaData && (
        <p
          role="alert"
          className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
          style={{ background: 'var(--reservado-fundo)', color: 'var(--reservado)' }}
        >
          Esta data está bloqueada: {bloqueioDaData.motivo}. Nenhuma praça pode ser vendida nela.
        </p>
      )}

      {buscandoSugestao && (
        <p className="mt-3 text-[12.5px] text-[var(--texto-3)]">Consultando a API de entregas…</p>
      )}
      {sugestaoAtual && (
        <div
          className="mt-3 rounded-[10px] border p-3"
          style={{ borderColor: 'var(--borda-forte)', background: 'var(--superficie-suave)' }}
        >
          <p className="text-[12.5px] font-semibold text-[var(--texto)]">
            Encontramos uma entrega nesta data: <em>{sugestaoAtual.descricao}</em>.
          </p>
          {sugestaoAtual.limitacao && (
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">{sugestaoAtual.limitacao}</p>
          )}
        </div>
      )}

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="mb-1 text-[12px] font-semibold text-[var(--texto-2)]">
          Praças (até {maxPracasPorAcao})
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRACAS.map((praca) => {
            const ocupante = acaoPorPraca.get(praca)
            const marcada = pracasSelecionadas.includes(praca)
            const desabilitada =
              Boolean(ocupante) ||
              Boolean(bloqueioDaData) ||
              foraDePrazo ||
              (!marcada && pracasSelecionadas.length >= maxPracasPorAcao)
            return (
              <label
                key={praca}
                title={ocupante ? `Já vendida para ${ocupante}` : undefined}
                className="flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold"
                style={{
                  borderColor: marcada ? 'var(--roxo)' : 'var(--borda-forte)',
                  color: desabilitada && !marcada ? 'var(--texto-3)' : 'var(--texto)',
                  background: desabilitada && !marcada ? 'var(--superficie-suave)' : 'transparent',
                  opacity: desabilitada && !marcada ? 0.7 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={desabilitada}
                  onChange={() => alternarPraca(praca)}
                  className="h-4 w-4 cursor-pointer accent-[#7A2FF2] disabled:cursor-not-allowed"
                />
                {praca}
                {ocupante && <span className="text-[10.5px] font-normal text-[var(--texto-3)]">· {ocupante}</span>}
              </label>
            )
          })}
        </div>
      </fieldset>

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
        desabilitado={!cliente || pracasSelecionadas.length === 0 || foraDePrazo || Boolean(bloqueioDaData)}
        onClick={registrar}
        className="mt-4 w-full sm:w-auto"
      >
        Registrar ação
      </BotaoDeGravacao>
    </div>
  )
}
