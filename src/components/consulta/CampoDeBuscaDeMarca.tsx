'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { buscarMarcas, type MarcaDaCarteira } from '@/lib/dados/busca-marcas'

type Props = {
  aoEscolher: (marca: MarcaDaCarteira) => void
}

const ATRASO_DA_BUSCA_MS = 300

export function CampoDeBuscaDeMarca({ aoEscolher }: Props) {
  const idCampo = useId()
  const idLista = `${idCampo}-opcoes`
  const caixa = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef(0)

  const [termo, setTermo] = useState('')
  const [escolhida, setEscolhida] = useState<MarcaDaCarteira | null>(null)
  const [sugestoes, setSugestoes] = useState<MarcaDaCarteira[]>([])
  const [termoDasSugestoes, setTermoDasSugestoes] = useState('')
  const [aberto, setAberto] = useState(false)
  const [destaque, setDestaque] = useState(-1)

  const termoLimpo = termo.trim()
  const buscando = termoLimpo !== '' && termoDasSugestoes !== termoLimpo
  const sugestoesAtuais = termoDasSugestoes === termoLimpo ? sugestoes : []

  useEffect(() => {
    if (termoLimpo === '') return

    const numeroDaConsulta = ++consultaAtual.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarMarcas(termoLimpo)
      if (numeroDaConsulta !== consultaAtual.current) return
      setSugestoes(resultado)
      setTermoDasSugestoes(termoLimpo)
      setDestaque(-1)
    }, ATRASO_DA_BUSCA_MS)

    return () => clearTimeout(temporizador)
  }, [termoLimpo])

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
    setTermoDasSugestoes('')
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

  const mostrarLista = aberto && termoLimpo !== ''

  return (
    <div ref={caixa} className="relative max-w-[620px]">
      <label htmlFor={idCampo} className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
        Marca
      </label>
      <input
        id={idCampo}
        type="text"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoComplete="off"
        value={escolhida && termo === '' ? escolhida.marca_nome : termo}
        placeholder="Ex.: Nescafé, Coca-Cola, Natura…"
        onChange={(evento) => {
          setEscolhida(null)
          setTermo(evento.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />

      {escolhida && (
        <p className="mt-[6px] text-[12px] text-[var(--texto-3)]">
          Anunciante: {escolhida.cliente_nome}
        </p>
      )}

      {mostrarLista && (
        <div className="absolute left-0 right-0 top-[74px] z-30 overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
          {buscando ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">Buscando marcas…</p>
          ) : sugestoesAtuais.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">
              Nenhuma marca relacionada a um anunciante da carteira foi encontrada.
            </p>
          ) : (
            <ul id={idLista} role="listbox" className="max-h-[300px] overflow-y-auto">
              {sugestoesAtuais.map((marca, indice) => (
                <li key={`${marca.marca_id}-${marca.cliente_id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={indice === destaque}
                    onMouseDown={(evento) => {
                      evento.preventDefault()
                      escolher(marca)
                    }}
                    onMouseEnter={() => setDestaque(indice)}
                    className="flex w-full cursor-pointer flex-col items-start border-b border-[var(--borda)] px-3 py-[9px] text-left last:border-b-0"
                    style={{ background: indice === destaque ? 'var(--superficie-suave)' : 'transparent' }}
                  >
                    <span className="text-[13px] font-bold text-[var(--texto)]">{marca.marca_nome}</span>
                    <span className="mt-[2px] text-[11.5px] text-[var(--texto-2)]">
                      {marca.cliente_nome}
                    </span>
                    <span className="text-[10.5px] text-[var(--texto-3)]">
                      {marca.setor ?? 'Sem setor'} · {marca.industria ?? 'Sem indústria'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
