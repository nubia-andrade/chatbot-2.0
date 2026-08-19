'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { buscarMarcas, type MarcaDaCarteira } from '@/lib/dados/busca-marcas'
import { cadastrarMarcaNaConsulta } from '@/lib/acoes/marcas-consulta'

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
  const [clienteSemMarca, setClienteSemMarca] = useState<MarcaDaCarteira | null>(null)
  const [nomeNovaMarca, setNomeNovaMarca] = useState('')
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const [resolvendoCliente, setResolvendoCliente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvandoMarca, iniciarCadastro] = useTransition()

  const termoLimpo = termo.trim()
  const sugestoesAtuais = termoDasSugestoes === termoLimpo ? sugestoes : []
  const buscando = aberto && !escolhida && !clienteEmEscolhaDeMarca && !clienteSemMarca && termoDasSugestoes !== termoLimpo

  useEffect(() => {
    if (!aberto || escolhida || clienteEmEscolhaDeMarca || clienteSemMarca) return

    const numeroDaConsulta = ++consultaAtual.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarMarcas(termoLimpo)
      if (numeroDaConsulta !== consultaAtual.current) return
      setSugestoes(resultado)
      setTermoDasSugestoes(termoLimpo)
      setDestaque(-1)
    }, termoLimpo === '' ? 0 : ATRASO_DA_BUSCA_MS)

    return () => clearTimeout(temporizador)
  }, [aberto, escolhida, clienteEmEscolhaDeMarca, clienteSemMarca, termoLimpo])

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function limparCadastroPendente() {
    setClienteSemMarca(null)
    setNomeNovaMarca('')
    setErroCadastro(null)
  }

  function finalizarEscolha(item: MarcaDaCarteira, avisoDepois: string | null = null) {
    consultaAtual.current += 1
    setEscolhida(item)
    setTermo('')
    setSugestoes([])
    setTermoDasSugestoes(null)
    setDestaque(-1)
    setAberto(false)
    setClienteEmEscolhaDeMarca(null)
    limparCadastroPendente()
    setResolvendoCliente(false)
    setAviso(avisoDepois)
    aoEscolher(item)
  }

  async function escolher(item: MarcaDaCarteira) {
    if (item.marca_id && item.marca_nome) {
      finalizarEscolha(item)
      return
    }

    const numeroDaConsulta = ++consultaAtual.current
    setResolvendoCliente(true)
    setAviso(null)
    limparCadastroPendente()

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

    // Sem marca conhecida: não deixa a proposta seguir sem marca. O executivo
    // cadastra o nome ali mesmo e o vínculo entra na fila de governança.
    setClienteSemMarca(item)
    setTermo(item.cliente_nome)
    setSugestoes([])
    setTermoDasSugestoes(null)
    setAberto(false)
    setResolvendoCliente(false)
  }

  function cadastrarNovaMarca() {
    const cliente = clienteSemMarca
    const nome = nomeNovaMarca.trim()
    if (!cliente || !nome || salvandoMarca) return

    setErroCadastro(null)
    iniciarCadastro(async () => {
      const retorno = await cadastrarMarcaNaConsulta(nome, cliente.cliente_id)
      if (retorno.erro || !retorno.marcaId || !retorno.marcaNome) {
        setErroCadastro(retorno.erro ?? 'Não foi possível cadastrar a marca.')
        return
      }

      finalizarEscolha(
        {
          ...cliente,
          marca_id: retorno.marcaId,
          marca_nome: retorno.marcaNome,
        },
        'Marca cadastrada e vinculada ao anunciante. O vínculo ficará disponível para revisão da governança.',
      )
    })
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

  const mostrarLista = aberto && !escolhida && !clienteSemMarca
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
          limparCadastroPendente()
          setResolvendoCliente(false)
          setAviso(null)
          setTermo(evento.target.value)
          setSugestoes([])
          setTermoDasSugestoes(null)
          setAberto(true)
        }}
        onFocus={() => {
          if (!escolhida && !clienteSemMarca) setAberto(true)
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

      {clienteSemMarca && (
        <div className="mt-3 rounded-[12px] border border-[#DDD6FE] bg-[#FAF8FF] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[var(--roxo)]">Marca não encontrada</p>
          <p className="mt-1 text-[12.5px] font-bold text-[var(--texto)]">{clienteSemMarca.cliente_nome}</p>

          <div className="mt-3 rounded-[9px] border border-[#E9DDFB] bg-white px-3 py-2.5">
            <p className="text-[11.5px] font-bold text-[var(--texto)]">Cadastre somente o nome exato da marca.</p>
            <p className="mt-0.5 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">
              Evite campanha, produto, slogan ou variações de escrita. Esse nome será salvo na base de marcas e usado em consultas futuras.
            </p>
          </div>

          <label className="mt-3 grid gap-1.5">
            <span className="text-[11.5px] font-bold text-[var(--texto-2)]">Nome da marca</span>
            <input
              type="text"
              value={nomeNovaMarca}
              maxLength={120}
              autoFocus
              onChange={(evento) => {
                setNomeNovaMarca(evento.target.value)
                setErroCadastro(null)
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault()
                  cadastrarNovaMarca()
                }
              }}
              placeholder="Ex.: ADEMICON"
              className="h-[42px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-white px-3 text-[13.5px] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              {erroCadastro && <p role="alert" className="text-[10.5px] font-semibold text-[var(--concorrencia-texto)]">{erroCadastro}</p>}
              <p className="text-[10px] text-[var(--texto-3)]">O cadastro ficará pendente de revisão pela governança.</p>
            </div>
            <button
              type="button"
              disabled={!nomeNovaMarca.trim() || salvandoMarca}
              onClick={cadastrarNovaMarca}
              className="rounded-[9px] px-4 py-2.5 text-[11.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: 'var(--marca)' }}
            >
              {salvandoMarca ? 'Cadastrando…' : 'Cadastrar marca e continuar'}
            </button>
          </div>
        </div>
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
