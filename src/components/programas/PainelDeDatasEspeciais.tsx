'use client'

import { useMemo, useRef, useState } from 'react'
import { criarPeriodoEspecial, excluirPeriodoEspecial, type PeriodoEspecial } from '@/lib/acoes/datas-especiais'
import { aplicarAcrescimo, validarPeriodoEspecial } from '@/lib/dominio/datas-especiais'
import { formatarMoeda, paraNumero } from '@/lib/dominio/moeda'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'

type PrecoDePracaParaEfeito = {
  praca_codigo: string
  custo_midia_tv: number
}

/** Mesma convenção 0=domingo…6=sábado e os mesmos rótulos curtos do cadastro de programa (`FormularioDePrograma`), para as duas telas não se contradizerem. */
const DIAS_DA_SEMANA: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: 'Dom' },
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
]

/** Nome por extenso, no plural, para a lista de períodos — "quartas-feiras", não "[3]". */
const NOMES_PLURAL_DOS_DIAS: Record<number, string> = {
  0: 'domingos',
  1: 'segundas-feiras',
  2: 'terças-feiras',
  3: 'quartas-feiras',
  4: 'quintas-feiras',
  5: 'sextas-feiras',
  6: 'sábados',
}

/** "Todos os dias" quando vazio/nulo, ou os dias por extenso separados por vírgula, em ordem — "quartas-feiras" ou "segundas-feiras, quartas-feiras". */
function descreverDiasDaSemana(dias: number[] | null | undefined): string {
  if (!dias || dias.length === 0) return 'Todos os dias'
  return [...dias]
    .sort((a, b) => a - b)
    .map((dia) => NOMES_PLURAL_DOS_DIAS[dia])
    .join(', ')
}

type Props = {
  programaId: string
  periodosIniciais: PeriodoEspecial[]
  /** `programas.custo_midia_tv` — a mídia nacional, base do exemplo "376.000 → 451.200". */
  custoMidiaTv: number | null
  aceitaRegional: boolean
  /** Mídia de cada praça — só usada para mostrar o efeito quando `aceitaRegional`. */
  precosRegionais: PrecoDePracaParaEfeito[]
}

function formatarDataBR(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return iso
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

/** "20" para inteiro, "17,5" com casa decimal só quando ela existe — sem os `,00` fixos de `formatarMoeda`. */
function formatarPercentual(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * "Mostrar o efeito, não só o número" — a linha que aparece embaixo do
 * campo de percentual enquanto o consultor digita, com a mídia de antes e
 * depois lado a lado. Sem isso, "20%" é uma abstração; "376.000 → 451.200"
 * é a pergunta que o consultor realmente tem.
 */
function LinhaDeEfeito({ rotulo, midia, percentual }: { rotulo: string; midia: number; percentual: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="font-semibold text-[var(--texto-3)]">{rotulo}</span>
      <span className="font-bold text-[var(--texto)]">
        R$ {formatarMoeda(midia)} <span aria-hidden="true">→</span>{' '}
        <span style={{ color: 'var(--roxo)' }}>R$ {formatarMoeda(aplicarAcrescimo(midia, percentual))}</span>
      </span>
    </div>
  )
}

/**
 * Aba Datas especiais — período com preço diferenciado (Black Friday,
 * Natal…), distinto de Datas bloqueadas: aquela impede a venda, esta muda o
 * preço. As duas coexistem — nada aqui consulta `datas_bloqueadas`, e nada
 * lá consulta esta tabela.
 *
 * O formulário nomeia o conflito quando dois períodos do mesmo programa se
 * sobrepõem (`validarPeriodoEspecial`, `src/lib/dominio/datas-especiais.ts`)
 * — decisão deliberada da área: sem aninhamento, sem regra de desempate.
 */
export function PainelDeDatasEspeciais({
  programaId,
  periodosIniciais,
  custoMidiaTv,
  aceitaRegional,
  precosRegionais,
}: Props) {
  const [periodos, setPeriodos] = useState<PeriodoEspecial[]>(periodosIniciais)

  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [percentualTexto, setPercentualTexto] = useState('')
  const [textoInvestimento, setTextoInvestimento] = useState('')
  // `todosOsDias` é estado à parte de `diasDaSemana` — não dá pra derivar
  // "vale todos os dias" só de `diasDaSemana.length === 0`, porque essa
  // lista vazia também é o estado transitório de quem desmarcou "todos" e
  // ainda não escolheu nenhum dia específico: sem o booleano, a caixa
  // "todos os dias" ficaria marcada de novo sozinha.
  const [todosOsDias, setTodosOsDias] = useState(true)
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>([])

  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [avisoDaLista, setAvisoDaLista] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  const campoDeNome = useRef<HTMLInputElement>(null)

  const percentual = paraNumero(percentualTexto) ?? 0
  const temPercentualValido = percentualTexto.trim() !== '' && paraNumero(percentualTexto) !== null

  const temAlteracaoNaoSalva =
    nome.trim() !== '' ||
    dataInicio !== '' ||
    dataFim !== '' ||
    percentualTexto.trim() !== '' ||
    textoInvestimento.trim() !== '' ||
    !todosOsDias

  function alternarDia(dia: number) {
    setDiasDaSemana((atual) => (atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort((a, b) => a - b)))
    setSucesso(null)
  }

  // Só falta escolher pelo menos um dia quando "todos os dias" está
  // desmarcado — sem isso, dias_da_semana ficaria vazio, que É a convenção
  // de "todos os dias" no domínio, e o período gravaria diferente do que a
  // pessoa pediu.
  const faltaEscolherDia = !todosOsDias && diasDaSemana.length === 0

  // Validação no cliente, para o botão nascer desabilitado sem esperar o
  // servidor — a checagem que vale de verdade é a mesma função rodando de
  // novo no server action, contra a lista atual do banco.
  const errosDePreVisualizacao = useMemo(() => {
    if (nome.trim() === '' || dataInicio === '' || dataFim === '') return []
    return validarPeriodoEspecial(
      {
        nome: nome.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim,
        percentual_acrescimo: percentual,
        dias_da_semana: todosOsDias ? [] : diasDaSemana,
      },
      periodos,
    )
  }, [nome, dataInicio, dataFim, percentual, todosOsDias, diasDaSemana, periodos])

  const formularioCompleto =
    nome.trim() !== '' && dataInicio !== '' && dataFim !== '' && temPercentualValido && !faltaEscolherDia

  function limparFormulario() {
    setNome('')
    setDataInicio('')
    setDataFim('')
    setPercentualTexto('')
    setTextoInvestimento('')
    setTodosOsDias(true)
    setDiasDaSemana([])
  }

  async function salvar() {
    if (!formularioCompleto) {
      campoDeNome.current?.focus()
      return
    }

    setGravando(true)
    setErros([])
    setSucesso(null)

    const diasParaGravar = todosOsDias || diasDaSemana.length === 0 ? null : diasDaSemana

    const resultado = await criarPeriodoEspecial(programaId, {
      nome: nome.trim(),
      data_inicio: dataInicio,
      data_fim: dataFim,
      percentual_acrescimo: percentual,
      texto_investimento: textoInvestimento.trim() === '' ? null : textoInvestimento.trim(),
      dias_da_semana: diasParaGravar,
    })

    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      campoDeNome.current?.focus()
      return
    }

    setPeriodos((atual) =>
      [
        {
          id: `temporario-${Date.now()}`,
          nome: nome.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          percentual_acrescimo: percentual,
          texto_investimento: textoInvestimento.trim() === '' ? null : textoInvestimento.trim(),
          dias_da_semana: diasParaGravar,
        },
        ...atual,
      ].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio)),
    )
    setSucesso('Período especial salvo.')
    limparFormulario()
  }

  async function excluir(id: string) {
    setExcluindo(id)
    setAvisoDaLista(null)

    const resultado = await excluirPeriodoEspecial(programaId, id)

    setExcluindo(null)
    setConfirmandoExclusao(null)

    if (resultado.erro) {
      setAvisoDaLista({ tipo: 'erro', texto: resultado.erro })
      return
    }

    setPeriodos((atual) => atual.filter((periodo) => periodo.id !== id))
    setAvisoDaLista({ tipo: 'sucesso', texto: 'Período especial excluído.' })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <AvisoDeSaida ativo={temAlteracaoNaoSalva} />

      <section className="flex-1">
        <h3 className="mb-3 text-[14px] font-bold text-[var(--texto)]">Períodos especiais cadastrados</h3>

        {avisoDaLista && (
          <p
            role={avisoDaLista.tipo === 'erro' ? 'alert' : 'status'}
            className="mb-3 text-[12.5px] font-semibold"
            style={{ color: avisoDaLista.tipo === 'erro' ? 'var(--concorrencia)' : 'var(--disponivel)' }}
          >
            {avisoDaLista.texto}
          </p>
        )}

        {periodos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma data especial cadastrada"
            explicacao="Datas especiais mudam o PREÇO num período — como a Black Friday, com acréscimo de 20% sobre a mídia. Isso é diferente de data bloqueada, que impede a venda; as duas coexistem sem se afetar."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {periodos.map((periodo) => (
              <li
                key={periodo.id}
                className="flex flex-col gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
                style={{ background: 'var(--superficie)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-[var(--texto)]">{periodo.nome}</span>
                    <span className="text-[12.5px] text-[var(--texto-3)]">
                      {formatarDataBR(periodo.data_inicio)} a {formatarDataBR(periodo.data_fim)}
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-[3px] text-[12px] font-bold"
                    style={{ background: 'var(--superficie-suave)', color: 'var(--roxo)' }}
                  >
                    +{formatarPercentual(periodo.percentual_acrescimo)}% sobre a mídia
                  </span>
                </div>

                <p className="text-[12.5px] text-[var(--texto-3)]">
                  <span className="font-semibold">Dias da semana: </span>
                  {descreverDiasDaSemana(periodo.dias_da_semana)}
                </p>

                <p className="text-[12.5px] text-[var(--texto-3)]">
                  <span className="font-semibold">Texto do slide de investimento: </span>
                  {periodo.texto_investimento ? periodo.texto_investimento : 'Não preenchido.'}
                </p>

                {confirmandoExclusao === periodo.id ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--borda)] pt-2">
                    <span className="mr-auto text-[12px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
                      Excluir &quot;{periodo.nome}&quot;? O período deixa de valer imediatamente.
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(null)}
                      disabled={excluindo === periodo.id}
                      className="cursor-pointer rounded-[10px] border border-[var(--borda-forte)] px-3 py-1.5 text-[12px] font-semibold text-[var(--texto-2)] hover:bg-[var(--superficie-suave)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(periodo.id)}
                      disabled={excluindo === periodo.id}
                      className="cursor-pointer rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-[var(--superficie)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: 'var(--concorrencia)' }}
                    >
                      {excluindo === periodo.id ? 'Excluindo…' : 'Confirmar exclusão'}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end border-t border-[var(--borda)] pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmandoExclusao(periodo.id)
                        setSucesso(null)
                        setErros([])
                      }}
                      aria-label={`Excluir período ${periodo.nome}`}
                      className="cursor-pointer text-[12px] font-semibold hover:underline"
                      style={{ color: 'var(--concorrencia)' }}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside
        className="w-full rounded-[var(--raio-card)] border border-[var(--borda)] p-5 lg:w-[380px]"
        style={{ background: 'var(--superficie)' }}
      >
        <h3 className="text-[14px] font-bold text-[var(--texto)]">Novo período especial</h3>

        <label htmlFor="data-especial-nome" className="mb-[7px] mt-4 block text-[12px] font-semibold text-[var(--texto-2)]">
          Nome
        </label>
        <input
          id="data-especial-nome"
          ref={campoDeNome}
          type="text"
          value={nome}
          onChange={(evento) => {
            setNome(evento.target.value)
            setSucesso(null)
          }}
          placeholder="Ex.: Black Friday"
          className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="data-especial-inicio" className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
              Data inicial
            </label>
            <input
              id="data-especial-inicio"
              type="date"
              value={dataInicio}
              onChange={(evento) => {
                setDataInicio(evento.target.value)
                setSucesso(null)
              }}
              className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
            />
          </div>
          <div>
            <label htmlFor="data-especial-fim" className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
              Data final
            </label>
            <input
              id="data-especial-fim"
              type="date"
              value={dataFim}
              onChange={(evento) => {
                setDataFim(evento.target.value)
                setSucesso(null)
              }}
              className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--texto-2)]">Dias da semana</span>
          <label className="flex w-fit cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--texto-2)]">
            <input
              type="checkbox"
              checked={todosOsDias}
              onChange={(evento) => {
                setTodosOsDias(evento.target.checked)
                if (evento.target.checked) setDiasDaSemana([])
                setSucesso(null)
              }}
              className="h-4 w-4 cursor-pointer accent-[#A031F5]"
            />
            Vale todos os dias do período
          </label>

          {!todosOsDias && (
            <>
              <div className="flex flex-wrap gap-2">
                {DIAS_DA_SEMANA.map((dia) => {
                  const marcado = diasDaSemana.includes(dia.valor)
                  return (
                    <button
                      key={dia.valor}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => alternarDia(dia.valor)}
                      className="h-[36px] w-[52px] cursor-pointer rounded-[10px] border text-[12.5px] font-bold"
                      style={
                        marcado
                          ? { borderColor: 'var(--roxo)', background: 'rgba(122,47,242,.1)', color: 'var(--roxo)' }
                          : { borderColor: 'var(--borda-forte)', color: 'var(--texto-3)' }
                      }
                    >
                      {dia.rotulo}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11.5px] text-[var(--texto-3)]">
                {diasDaSemana.length > 0
                  ? `O acréscimo vale só ${descreverDiasDaSemana(diasDaSemana)}, dentro do período — ex.: Mais Você, janeiro a abril, só quartas-feiras.`
                  : 'Escolha ao menos um dia, ou marque "Vale todos os dias do período" acima.'}
              </p>
            </>
          )}
        </div>

        <label htmlFor="data-especial-percentual" className="mb-[7px] mt-3 block text-[12px] font-semibold text-[var(--texto-2)]">
          Percentual de acréscimo sobre a mídia
        </label>
        <div className="relative">
          <input
            id="data-especial-percentual"
            type="text"
            inputMode="decimal"
            value={percentualTexto}
            onChange={(evento) => {
              setPercentualTexto(evento.target.value)
              setSucesso(null)
            }}
            placeholder="Ex.: 20"
            className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 pr-8 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--texto-3)]">
            %
          </span>
        </div>

        {temPercentualValido && (custoMidiaTv !== null || precosRegionais.length > 0) && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-[10px] p-3" style={{ background: 'var(--superficie-suave)' }}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--texto-3)]">
              Efeito sobre a mídia deste programa
            </p>
            {custoMidiaTv !== null && (
              <LinhaDeEfeito rotulo="Nacional" midia={custoMidiaTv} percentual={percentual} />
            )}
            {aceitaRegional &&
              precosRegionais.map((preco) => (
                <LinhaDeEfeito
                  key={preco.praca_codigo}
                  rotulo={preco.praca_codigo}
                  midia={preco.custo_midia_tv}
                  percentual={percentual}
                />
              ))}
          </div>
        )}

        <label htmlFor="data-especial-texto" className="mb-[7px] mt-3 block text-[12px] font-semibold text-[var(--texto-2)]">
          Texto para o slide de investimento (opcional)
        </label>
        <textarea
          id="data-especial-texto"
          value={textoInvestimento}
          onChange={(evento) => {
            setTextoInvestimento(evento.target.value)
            setSucesso(null)
          }}
          placeholder="Ex.: Condição especial de Black Friday aplicada ao período."
          rows={3}
          className="w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] p-3 text-[13px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
        />
        <p className="mt-1.5 text-[11.5px] text-[var(--texto-3)]">
          Este texto fica guardado, mas ainda não aparece em proposta nenhuma — a geração de proposta chega numa
          entrega futura. Nada é enviado ao cliente a partir daqui.
        </p>

        {errosDePreVisualizacao.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {errosDePreVisualizacao.map((erro) => (
              <li key={erro} className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
                {erro}
              </li>
            ))}
          </ul>
        )}

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
          desabilitado={!formularioCompleto || errosDePreVisualizacao.length > 0}
          onClick={salvar}
          className="mt-4 w-full"
        >
          Salvar período especial
        </BotaoDeGravacao>
      </aside>
    </div>
  )
}
