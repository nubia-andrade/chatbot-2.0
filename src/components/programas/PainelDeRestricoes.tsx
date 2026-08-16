'use client'

import { useEffect, useRef, useState } from 'react'
import { salvarRestricao, calcularAlcanceDaRestricao, excluirRestricao } from '@/lib/acoes/restricoes'
import { CampoDeBuscaDeCliente } from '@/components/comum/CampoDeBuscaDeCliente'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'
import type { Cliente } from '@/lib/dados/busca-clientes'

type Restricao = {
  id: string
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

type Props = {
  programaId: string
  restricoesIniciais: Restricao[]
  setores: string[]
  industrias: string[]
}

type Modo = 'anunciante' | 'setorIndustria' | 'categoria'
type EixoDaCategoria = 'setor' | 'industria'

const ATRASO_DO_CALCULO_MS = 400

function descreverTipo(restricao: { anunciante: string | null; setor: string | null; industria: string | null }): string {
  if (restricao.anunciante) return 'Anunciante'
  if (restricao.setor && restricao.industria) return 'Setor'
  return 'Categoria'
}

function descreverAlvo(restricao: { anunciante: string | null; setor: string | null; industria: string | null }): string {
  if (restricao.anunciante) return restricao.anunciante
  if (restricao.setor && restricao.industria) return `${restricao.setor} · ${restricao.industria}`
  return restricao.setor ?? restricao.industria ?? '—'
}

/**
 * Painel de restrições — Task 11, Step 2.
 *
 * Três modos de cadastro, escolhidos por botão de opção, todos convergindo
 * para as mesmas colunas de `restricoes_anunciante` — o que muda é qual
 * campo cada modo preenche:
 *
 * 1. Anunciante específico: `CampoDeBuscaDeCliente` (Task 8) devolve um
 *    registro real da carteira; setor e indústria vêm travados dele, não
 *    digitados.
 * 2. Setor e indústria: dois campos de seleção com os valores distintos que
 *    existem de verdade em `clientes` (`listarValoresDeCategoria`).
 * 3. Só categoria: um campo de seleção único combinando as duas listas —
 *    "não faz bebidas alcoólicas" é normalmente uma indústria isolada, sem
 *    travar o setor junto.
 *
 * Antes de habilitar "Salvar", `calcularAlcanceDaRestricao` roda a mesma
 * regra de decisão de venda (Task 5) contra a carteira inteira e mostra
 * quantos clientes a restrição afetaria — a diferença entre bloquear uma
 * marca e bloquear um setor inteiro sem perceber.
 */
export function PainelDeRestricoes({ programaId, restricoesIniciais, setores, industrias }: Props) {
  const [restricoes, setRestricoes] = useState<Restricao[]>(restricoesIniciais)

  const [modo, setModo] = useState<Modo>('anunciante')
  const [clienteEscolhido, setClienteEscolhido] = useState<Cliente | null>(null)
  const [setorEscolhido, setSetorEscolhido] = useState('')
  const [industriaEscolhida, setIndustriaEscolhida] = useState('')
  const [categoria, setCategoria] = useState<{ eixo: EixoDaCategoria; valor: string } | null>(null)
  const [motivo, setMotivo] = useState('')

  const [alcance, setAlcance] = useState<number | null>(null)
  const [totalDaCarteira, setTotalDaCarteira] = useState(0)
  const [calculandoAlcance, setCalculandoAlcance] = useState(false)

  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Confirmação em duas etapas: a primeira troca o botão "Excluir" pelo par
  // "Confirmar/Cancelar" naquela linha. Guarda o id da restrição em confirmação
  // — só uma por vez, para não haver dois botões vermelhos armados na tela.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  // Retorno da exclusão fica ao lado da LISTA, não junto do formulário de
  // cadastro na coluna da direita: mensagem longe do que a produziu é
  // mensagem que ninguém lê.
  const [avisoDaLista, setAvisoDaLista] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  const idDaConsultaAtual = useRef(0)
  const campoDeMotivo = useRef<HTMLTextAreaElement>(null)

  const dadosDoAlvo: { anunciante: string | null; setor: string | null; industria: string | null } =
    modo === 'anunciante'
      ? { anunciante: clienteEscolhido?.nome ?? null, setor: clienteEscolhido?.setor ?? null, industria: clienteEscolhido?.industria ?? null }
      : modo === 'setorIndustria'
        ? { anunciante: null, setor: setorEscolhido || null, industria: industriaEscolhida || null }
        : {
            anunciante: null,
            setor: categoria?.eixo === 'setor' ? categoria.valor : null,
            industria: categoria?.eixo === 'industria' ? categoria.valor : null,
          }

  const alvoValido =
    modo === 'anunciante'
      ? Boolean(clienteEscolhido)
      : modo === 'setorIndustria'
        ? Boolean(setorEscolhido && industriaEscolhida)
        : Boolean(categoria)

  const temAlteracaoNaoSalva =
    Boolean(clienteEscolhido) || setorEscolhido !== '' || industriaEscolhida !== '' || Boolean(categoria) || motivo.trim() !== ''

  // Recalcula quantos clientes o alvo escolhido afeta, 400ms depois da
  // última mudança — o mesmo padrão de debounce do `CampoDeBuscaDeCliente`,
  // para não disparar uma varredura da carteira a cada clique.
  useEffect(() => {
    // Alvo incompleto (nenhum cliente/setor/categoria escolhido ainda): não
    // há o que calcular. `alcance` já volta a `null` em quem torna o alvo
    // inválido — `trocarModo` e os `onChange` dos campos abaixo — então este
    // efeito só precisa deixar de agendar um novo cálculo.
    if (!alvoValido) return

    const numeroDaConsulta = ++idDaConsultaAtual.current

    const temporizador = setTimeout(async () => {
      setCalculandoAlcance(true)
      const resultado = await calcularAlcanceDaRestricao(dadosDoAlvo)
      if (numeroDaConsulta !== idDaConsultaAtual.current) return
      setCalculandoAlcance(false)
      if (!resultado.erro) {
        setAlcance(resultado.alcance)
        setTotalDaCarteira(resultado.totalDaCarteira)
      }
    }, ATRASO_DO_CALCULO_MS)

    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoValido, dadosDoAlvo.anunciante, dadosDoAlvo.setor, dadosDoAlvo.industria])

  function trocarModo(novoModo: Modo) {
    setModo(novoModo)
    setClienteEscolhido(null)
    setSetorEscolhido('')
    setIndustriaEscolhida('')
    setCategoria(null)
    setAlcance(null)
    setErros([])
    setSucesso(null)
  }

  async function salvar() {
    const motivoLimpo = motivo.trim()
    if (motivoLimpo === '' || !alvoValido) {
      if (motivoLimpo === '') campoDeMotivo.current?.focus()
      return
    }

    setGravando(true)
    setErros([])
    setSucesso(null)

    const resultado = await salvarRestricao(programaId, { ...dadosDoAlvo, motivo: motivoLimpo })

    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      campoDeMotivo.current?.focus()
      return
    }

    setRestricoes((atual) => [
      { id: resultado.id!, ...dadosDoAlvo, motivo: motivoLimpo },
      ...atual,
    ])
    setSucesso('Restrição salva.')
    trocarModo(modo)
    setMotivo('')
  }

  async function excluir(id: string) {
    setExcluindo(id)
    setAvisoDaLista(null)

    const resultado = await excluirRestricao(programaId, id)

    setExcluindo(null)
    setConfirmandoExclusao(null)

    if (resultado.erro) {
      setAvisoDaLista({ tipo: 'erro', texto: resultado.erro })
      return
    }

    setRestricoes((atual) => atual.filter((restricao) => restricao.id !== id))
    setAvisoDaLista({ tipo: 'sucesso', texto: 'Restrição excluída.' })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <AvisoDeSaida ativo={temAlteracaoNaoSalva} />

      <section className="flex-1">
        <h3 className="mb-3 text-[14px] font-bold text-[var(--texto)]">Restrições cadastradas</h3>

        {avisoDaLista && (
          <p
            role={avisoDaLista.tipo === 'erro' ? 'alert' : 'status'}
            className="mb-3 text-[12.5px] font-semibold"
            style={{ color: avisoDaLista.tipo === 'erro' ? 'var(--concorrencia)' : 'var(--disponivel)' }}
          >
            {avisoDaLista.texto}
          </p>
        )}

        {restricoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma restrição cadastrada"
            explicacao="Cadastre restrições por anunciante, por setor e indústria, ou só por categoria, para impedir propostas que o programa não aceita."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {restricoes.map((restricao) => (
              <li
                key={restricao.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
                style={{ background: 'var(--superficie)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--superficie-suave)', color: 'var(--roxo)' }}
                  >
                    {descreverTipo(restricao)}
                  </span>
                  <span className="text-[13.5px] font-bold text-[var(--texto)]">{descreverAlvo(restricao)}</span>
                </div>
                <span className="text-[13px] text-[var(--texto-3)]">{restricao.motivo}</span>

                {confirmandoExclusao === restricao.id ? (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-[var(--borda)] pt-2">
                    <span className="mr-auto text-[12px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
                      Excluir esta restrição? {descreverAlvo(restricao)} volta a ser oferecido neste programa.
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(null)}
                      disabled={excluindo === restricao.id}
                      className="cursor-pointer rounded-[10px] border border-[var(--borda-forte)] px-3 py-1.5 text-[12px] font-semibold text-[var(--texto-2)] hover:bg-[var(--superficie-suave)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(restricao.id)}
                      disabled={excluindo === restricao.id}
                      className="cursor-pointer rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-[var(--superficie)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: 'var(--concorrencia)' }}
                    >
                      {excluindo === restricao.id ? 'Excluindo…' : 'Confirmar exclusão'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoExclusao(restricao.id)
                      setSucesso(null)
                      setErros([])
                    }}
                    aria-label={`Excluir restrição de ${descreverAlvo(restricao)}`}
                    className="cursor-pointer text-[12px] font-semibold hover:underline"
                    style={{ color: 'var(--concorrencia)' }}
                  >
                    Excluir
                  </button>
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
        <h3 className="text-[14px] font-bold text-[var(--texto)]">Nova restrição</h3>

        <div role="radiogroup" aria-label="Tipo de restrição" className="mt-3 flex flex-col gap-2">
          {(
            [
              { valor: 'anunciante', rotulo: 'Anunciante específico' },
              { valor: 'setorIndustria', rotulo: 'Setor e indústria' },
              { valor: 'categoria', rotulo: 'Só categoria' },
            ] as { valor: Modo; rotulo: string }[]
          ).map((opcao) => (
            <label
              key={opcao.valor}
              className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[var(--texto)]"
            >
              <input
                type="radio"
                name="modo-da-restricao"
                value={opcao.valor}
                checked={modo === opcao.valor}
                onChange={() => trocarModo(opcao.valor)}
                className="h-4 w-4"
              />
              {opcao.rotulo}
            </label>
          ))}
        </div>

        <div className="mt-4">
          {modo === 'anunciante' && (
            <div className="flex flex-col gap-2">
              <CampoDeBuscaDeCliente
                rotulo="Anunciante"
                aoEscolher={(cliente) => {
                  setClienteEscolhido(cliente)
                  setSucesso(null)
                }}
              />
              {clienteEscolhido && (
                <p className="text-[12px] text-[var(--texto-3)]">
                  Setor e indústria vêm da carteira, travados: {clienteEscolhido.setor ?? 'sem setor'} ·{' '}
                  {clienteEscolhido.industria ?? 'sem indústria'}.
                </p>
              )}
            </div>
          )}

          {modo === 'setorIndustria' && (
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="restricao-setor" className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
                  Setor
                </label>
                <select
                  id="restricao-setor"
                  value={setorEscolhido}
                  onChange={(evento) => {
                    setSetorEscolhido(evento.target.value)
                    if (evento.target.value === '') setAlcance(null)
                    setSucesso(null)
                  }}
                  className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
                >
                  <option value="">Selecione um setor…</option>
                  {setores.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="restricao-industria" className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
                  Indústria
                </label>
                <select
                  id="restricao-industria"
                  value={industriaEscolhida}
                  onChange={(evento) => {
                    setIndustriaEscolhida(evento.target.value)
                    if (evento.target.value === '') setAlcance(null)
                    setSucesso(null)
                  }}
                  className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
                >
                  <option value="">Selecione uma indústria…</option>
                  {industrias.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {modo === 'categoria' && (
            <div>
              <label htmlFor="restricao-categoria" className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
                Categoria
              </label>
              <select
                id="restricao-categoria"
                value={categoria ? `${categoria.eixo}:${categoria.valor}` : ''}
                onChange={(evento) => {
                  const [eixo, valor] = evento.target.value.split(':') as [EixoDaCategoria, string]
                  setCategoria(evento.target.value === '' ? null : { eixo, valor })
                  if (evento.target.value === '') setAlcance(null)
                  setSucesso(null)
                }}
                className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
              >
                <option value="">Selecione uma categoria…</option>
                <optgroup label="Setor">
                  {setores.map((valor) => (
                    <option key={`setor:${valor}`} value={`setor:${valor}`}>
                      {valor}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Indústria">
                  {industrias.map((valor) => (
                    <option key={`industria:${valor}`} value={`industria:${valor}`}>
                      {valor}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        {alvoValido && (
          <p className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--texto-2)' }}>
            {calculandoAlcance
              ? 'Calculando quantos clientes esta restrição afeta…'
              : alcance === null
                ? ''
                : `Afeta ${alcance} de ${totalDaCarteira.toLocaleString('pt-BR')} clientes da carteira.`}
          </p>
        )}

        <label htmlFor="restricao-motivo" className="mb-[7px] mt-4 block text-[12px] font-semibold text-[var(--texto-2)]">
          Motivo (obrigatório)
        </label>
        <textarea
          id="restricao-motivo"
          ref={campoDeMotivo}
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            setSucesso(null)
          }}
          placeholder="Ex.: Apresentador não pode ser associado a bebidas alcoólicas."
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
          desabilitado={!alvoValido || motivo.trim() === ''}
          onClick={salvar}
          className="mt-4 w-full"
        >
          Salvar restrição
        </BotaoDeGravacao>
      </aside>
    </div>
  )
}
