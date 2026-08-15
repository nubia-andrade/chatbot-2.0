'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { buscarClientes, type Cliente } from '@/lib/dados/busca-clientes'

type Props = {
  aoEscolher: (cliente: Cliente) => void
  rotulo?: string
  placeholder?: string
  id?: string
}

const ATRASO_DA_BUSCA_MS = 300

/**
 * Campo de busca da carteira de clientes — a única forma de preencher
 * "cliente" em qualquer tela desta entrega.
 *
 * Nenhuma tela aceita nome de cliente digitado à mão: "Ambev" à mão vira
 * "AMBEV", "Ambev S/A" e "ambev", três restrições que não se reconhecem
 * entre si. Este campo sempre devolve um registro real da carteira, com
 * `id`, para que toda regra que compare clientes compare o mesmo `id`.
 *
 * Busca no banco (15.519 clientes, `buscarClientes`) 300ms depois da última
 * tecla, para não disparar uma consulta a cada letra. As sugestões mostram
 * setor e indústria — o que distingue dois clientes de nome parecido, como
 * as três variações de "Ambev" que a carteira real tem.
 *
 * Teclado: seta para baixo/cima percorre as sugestões, Enter escolhe a
 * destacada, Escape fecha sem escolher. Sem isso, quem não usa mouse não
 * cadastra nada nesta entrega.
 */
export function CampoDeBuscaDeCliente({
  aoEscolher,
  rotulo = 'Cliente',
  placeholder = 'Digite para buscar na carteira…',
  id,
}: Props) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idLista = `${idCampo}-opcoes`

  const [termo, setTermo] = useState('')
  const [escolhido, setEscolhido] = useState<Cliente | null>(null)
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  // Termo a que `sugestoes` corresponde. Enquanto ele não bate com o termo
  // digitado, a busca daquele termo ainda não voltou — é o que deriva
  // `buscando`, sem precisar de um `setState` extra.
  const [sugestoesTermo, setSugestoesTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [destaque, setDestaque] = useState(-1)

  const caixa = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef(0)

  const termoLimpo = termo.trim()
  const buscando = termoLimpo !== '' && sugestoesTermo !== termoLimpo
  const sugestoesAtuais = sugestoesTermo === termoLimpo ? sugestoes : []

  // Debounce: só busca 300ms depois da última tecla. Cada disparo carrega um
  // número de sequência — se uma busca mais nova já respondeu, a resposta
  // atrasada de uma busca antiga (ex.: rede lenta) é descartada. O `setState`
  // só acontece dentro do `setTimeout`, nunca direto no corpo do efeito.
  useEffect(() => {
    if (termoLimpo === '') return

    const numeroDaConsulta = ++consultaAtual.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarClientes(termoLimpo)
      if (numeroDaConsulta !== consultaAtual.current) return
      setSugestoes(resultado)
      setSugestoesTermo(termoLimpo)
      setDestaque(-1)
    }, ATRASO_DA_BUSCA_MS)

    return () => clearTimeout(temporizador)
  }, [termoLimpo])

  // Clicar fora fecha sem escolher — o mesmo que Esc, para quem usa o mouse.
  useEffect(() => {
    if (!aberto) return

    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) {
        setAberto(false)
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function escolher(cliente: Cliente) {
    setEscolhido(cliente)
    setTermo('')
    setSugestoes([])
    setSugestoesTermo('')
    setAberto(false)
    setDestaque(-1)
    aoEscolher(cliente)
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
        const total = sugestoesAtuais.length
        return (atual + passo + total) % total
      })
      return
    }

    if (evento.key === 'Enter') {
      const alvo =
        sugestoesAtuais[destaque] ?? (sugestoesAtuais.length === 1 ? sugestoesAtuais[0] : undefined)
      if (alvo) {
        evento.preventDefault()
        escolher(alvo)
      }
    }
  }

  const mostrarLista = aberto && termoLimpo !== ''

  return (
    <div ref={caixa} className="relative">
      <label htmlFor={idCampo} className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
        {rotulo}
      </label>

      <input
        id={idCampo}
        type="text"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={
          destaque >= 0 && sugestoesAtuais[destaque] ? `${idLista}-${sugestoesAtuais[destaque].id}` : undefined
        }
        autoComplete="off"
        value={escolhido && termo === '' ? escolhido.nome : termo}
        placeholder={placeholder}
        onChange={(evento) => {
          setEscolhido(null)
          setTermo(evento.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />

      {escolhido && (
        <p className="mt-[6px] text-[12px] text-[var(--texto-3)]">
          {escolhido.setor ?? 'Sem setor'} · {escolhido.industria ?? 'Sem indústria'}
        </p>
      )}

      {mostrarLista && (
        <div className="absolute left-0 right-0 top-[74px] z-20 overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
          {buscando ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">Buscando…</p>
          ) : sugestoesAtuais.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--texto-3)]">
              Nenhum cliente da carteira encontrado para “{termo}”.
            </p>
          ) : (
            <ul id={idLista} role="listbox" className="max-h-[260px] overflow-y-auto">
              {sugestoesAtuais.map((cliente, indice) => (
                <li key={cliente.id}>
                  <button
                    id={`${idLista}-${cliente.id}`}
                    type="button"
                    role="option"
                    aria-selected={indice === destaque}
                    // `mousedown` em vez de `click`: o clique chegaria depois
                    // do fechamento disparado pelo clique-fora, e a escolha
                    // se perderia.
                    onMouseDown={(evento) => {
                      evento.preventDefault()
                      escolher(cliente)
                    }}
                    onMouseEnter={() => setDestaque(indice)}
                    className="flex w-full cursor-pointer flex-col items-start px-3 py-[7px] text-left"
                    style={{
                      background: indice === destaque ? 'var(--superficie-suave)' : 'transparent',
                    }}
                  >
                    <span className="text-[13px] font-semibold text-[var(--texto)]">{cliente.nome}</span>
                    <span className="text-[11px] text-[var(--texto-3)]">
                      {cliente.setor ?? 'Sem setor'} · {cliente.industria ?? 'Sem indústria'}
                      {cliente.cnpj && ` · ${cliente.cnpj}`}
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
