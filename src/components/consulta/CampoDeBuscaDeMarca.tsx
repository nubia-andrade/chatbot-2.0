'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { buscarMarcas, type MarcaDaCarteira } from '@/lib/dados/busca-marcas'

type Props = {
  aoEscolher: (marca: MarcaDaCarteira) => void
}

const ATRASO_DA_BUSCA_MS = 250

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

  const termoLimpo = termo.trim()
  const sugestoesAtuais = termoDasSugestoes === termoLimpo ? sugestoes : []
  const buscando = aberto && !escolhida && termoDasSugestoes !== termoLimpo

  useEffect(() => {
    if (!aberto || escolhida) return

    const numeroDaConsulta = ++consultaAtual.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarMarcas(termoLimpo)
      if (numeroDaConsulta !== consultaAtual.current) return
      setSugestoes(resultado)
      setTermoDasSugestoes(termoLimpo)
      setDestaque(-1)
    }, termoLimpo === '' ? 0 : ATRASO_DA_BUSCA_MS)

    return () => clearTimeout(temporizador)
  }, [aberto, escolhida, termoLimpo])

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function escolher(marca: MarcaDaCarteira) {
    setEscolhida(marca)
    setTermo('')
    setSugestoes([])
    setTermoDasSugestoes(null)
    setDestaque(-1)
    setAberto(false)
    aoEscolher(marca)
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
        escolher(alvo)
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
          setEscolhida(null)
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

      {escolhida && escolhida.marca_nome && (
        <p className="mt-[6px] text-[12px] text-[var(--texto-3)]">
          Anunciante: {escolhida.cliente_nome}
        </p>
      )}

      {mostrarLista && (
        <div className="absolute left-0 right-0 top-[74px] z-30 overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
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
                        escolher(item)
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
