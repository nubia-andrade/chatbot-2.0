'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { buscarMarcas, type MarcaDaCarteira } from '@/lib/dados/busca-marcas'

type Props = {
  aoEscolher: (marca: MarcaDaCarteira) => void
}

const ATRASO_DA_BUSCA_MS = 250
const LIMITE_MARCAS_DO_CLIENTE = 50

function marcasUnicasDoCliente(
  resultados: MarcaDaCarteira[],
  clienteId: string,
): MarcaDaCarteira[] {
  const porId = new Map<string, MarcaDaCarteira>()
  for (const item of resultados) {
    if (item.cliente_id !== clienteId || !item.marca_id || !item.marca_nome) continue
    porId.set(item.marca_id, item)
  }
  return [...porId.values()].sort((a, b) =>
    (a.marca_nome ?? '').localeCompare(b.marca_nome ?? '', 'pt-BR'),
  )
}

export function CampoDeBuscaDeMarca({ aoEscolher }: Props) {
  const idCampo = useId()
  const idLista = `${idCampo}-opcoes`
  const caixa = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef(0)

  const [termo, setTermo] = useState('')
  const [escolhida, setEscolhida] = useState<MarcaDaCarteira | null>(null)
  const [sugestoes, setSugestoes] = useState<MarcaDaCarteira[]>([])
  const [termoDasSugestoes, setTermoDasSugestoes] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [destaque, setDestaque] = useState(-1)
  const [clienteEmEscolhaDeMarca, setClienteEmEscolhaDeMarca] = useState<MarcaDaCarteira | null>(null)
  const [resolvendoCliente, setResolvendoCliente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const termoLimpo = termo.trim()
  const sugestoesAtuais = termoDasSugestoes === termoLimpo ? sugestoes : []
  const buscando = aberto && !escolhida && !clienteEmEscolhaDeMarca && termoDasSugestoes !== termoLimpo

  useEffect(() => {
    if (!aberto || escolhida || clienteEmEscolhaDeMarca) return

    const numeroDaConsulta = ++consultaAtual.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarMarcas(termoLimpo)
      if (numeroDaConsulta !== consultaAtual.current) return
      setSugestoes(resultado)
      setTermoDasSugestoes(termoLimpo)
      setDestaque(-1)
    }, termoLimpo === '' ? 0 : ATRASO_DA_BUSCA_MS)

    return () => clearTimeout(temporizador)
  }, [aberto, escolhida, clienteEmEscolhaDeMarca, termoLimpo])

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function finalizarEscolha(item: MarcaDaCarteira, avisoDepois: string | null = null) {
    consultaAtual.current += 1
    setEscolhida(item)
    setTermo('')
    setSugestoes([])
    setTermoDasSugestoes(null)
    setDestaque(-1)
    setAberto(false)
    setClienteEmEscolhaDeMarca(null)
    setResolvendoCliente(false)
    setAviso(avisoDepois)
    aoEscolher(item)
  }

  async function escolher(item: MarcaDaCarteira) {
    // Marca já explícita: não há nada a resolver.
    if (item.marca_id && item.marca_nome) {
      finalizarEscolha(item)
      return
    }

    // O usuário escolheu o ANUNCIANTE genérico. Antes de concluir, procura as
    // marcas conhecidas desse mesmo cliente. Isso evita perder `marca_nome`
    // quando a busca pelo anunciante também devolve uma linha de cliente.
    const numeroDaConsulta = ++consultaAtual.current
    setResolvendoCliente(true)
    setAviso(null)

    const relacionadas = await buscarMarcas(item.cliente_nome, LIMITE_MARCAS_DO_CLIENTE)
    if (numeroDaConsulta !== consultaAtual.current) return

    const marcas = marcasUnicasDoCliente(relacionadas, item.cliente_id)

    if (marcas.length === 1) {
      finalizarEscolha(marcas[0])
      return
    }

    if (marcas.length > 1) {
      setClienteEmEscolhaDeMarca(item)
      setTermo(item.cliente_nome)
      setSugestoes(marcas)
      setTermoDasSugestoes(item.cliente_nome.trim())
      setDestaque(-1)
      setAberto(true)
      setResolvendoCliente(false)
      return
    }

    // Clientes ainda não aprendidos pelo Take continuam consultáveis. Nesse
    // caso não existe uma marca confiável para inventar no PDF.
    finalizarEscolha(
      item,
      'Este anunciante ainda não possui marca relacionada no Globo Take. A proposta seguirá somente com o anunciante até esse relacionamento existir.',
    )
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setAberto(false)
      return
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (sugestoesAtuais.length === 0) return
      evento.preventDefault()
      setAberto(true)
      setDestaque((atual) => {
        const passo = evento.key === 'ArrowDown' ? 1 : -1
        return (atual + passo + sugestoesAtuais.length) % sugestoesAtuais.length
      })
      return
    }

    if (evento.key === 'Enter') {
      const alvo = sugestoesAtuais[destaque] ??
        (sugestoesAtuais.length === 1 ? sugestoesAtuais[0] : undefined)
      if (alvo) {
        evento.preventDefault()
        void escolher(alvo)
      }
    }
  }

  const mostrarLista = aberto && !escolhida
  const nomeExibido = escolhida?.marca_nome ?? escolhida?.cliente_nome ?? termo

  return (
    <div ref={caixa} className="relative max-w-[620px]">
      <label htmlFor={idCampo} className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
        Cliente ou marca
      </label>
      <input
        id={idCampo}
        type="text"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoComplete="off"
        value={escolhida && termo === '' ? nomeExibido : termo}
        placeholder="Busque pelo cliente/anunciante ou pela marca…"
        onChange={(evento) => {
          consultaAtual.current += 1
          setEscolhida(null)
          setClienteEmEscolhaDeMarca(null)
          setResolvendoCliente(false)
          setAviso(null)
          setTermo(evento.target.value)
          setSugestoes([])
          setTermoDasSugestoes(null)
          setAberto(true)
        }}
        onFocus={() => {
          if (!escolhida) setAberto(true)
        }}
        onKeyDown={aoTeclar}
        className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />

      {resolvendoCliente && (
        <p className="mt-[6px] text-[12px] text-[var(--texto-3)]">Verificando marcas relacionadas ao anunciante…</p>
      )}

      {escolhida && escolhida.marca_nome && (
        <p className="mt-[6px] text-[12px] text-[var(--texto-3)]">
          Anunciante: {escolhida.cliente_nome}
        </p>
      )}

      {aviso && (
        <p className="mt-[6px] text-[11.5px] leading-[1.45] text-[var(--texto-3)]">{aviso}</p>
      )}

      {mostrarLista && (
        <div className="absolute left-0 right-0 top-[74px] z-30 overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
          {clienteEmEscolhaDeMarca && (
            <div className="border-b border-[var(--borda)] bg-[var(--superficie-suave)] px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[.05em] text-[var(--roxo)]">Escolha a marca</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--texto-2)]">{clienteEmEscolhaDeMarca.cliente_nome} possui mais de uma marca relacionada.</p>
            </div>
          )}

          {buscando ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">Buscando na sua carteira…</p>
          ) : sugestoesAtuais.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">
              Nenhum cliente ou marca da sua carteira foi encontrado.
            </p>
          ) : (
            <ul id={idLista} role="listbox" className="max-h-[320px] overflow-y-auto">
              {sugestoesAtuais.map((item, indice) => {
                const ehMarca = Boolean(item.marca_nome)
                return (
                  <li key={`${item.marca_id ?? 'cliente'}-${item.cliente_id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={indice === destaque}
                      onMouseDown={(evento) => {
                        evento.preventDefault()
                        void escolher(item)
                      }}
                      onMouseEnter={() => setDestaque(indice)}
                      className="flex w-full cursor-pointer flex-col items-start border-b border-[var(--borda)] px-3 py-[9px] text-left last:border-b-0"
                      style={{ background: indice === destaque ? 'var(--superficie-suave)' : 'transparent' }}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-[13px] font-bold text-[var(--texto)]">
                          {item.marca_nome ?? item.cliente_nome}
                        </span>
                        <span className="rounded-full bg-[var(--superficie-suave)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.05em] text-[var(--texto-3)]">
                          {ehMarca ? 'Marca' : 'Cliente'}
                        </span>
                      </div>
                      {ehMarca && (
                        <span className="mt-[2px] text-[11.5px] text-[var(--texto-2)]">
                          Anunciante: {item.cliente_nome}
                        </span>
                      )}
                      <span className="text-[10.5px] text-[var(--texto-3)]">
                        {item.setor ?? 'Sem setor'} · {item.industria ?? 'Sem indústria'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
