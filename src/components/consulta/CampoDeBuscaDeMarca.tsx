'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import {
  buscarMarcas,
  listarMarcasDoCliente,
  type MarcaDaCarteira,
} from '@/lib/dados/busca-marcas'
import { cadastrarMarcaNaConsulta } from '@/lib/acoes/marcas-consulta'

type Props = { aoEscolher: (marca: MarcaDaCarteira) => void }
const ATRASO_DA_BUSCA_MS = 250

function formatarCnpj(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '')
  if (digitos.length !== 14) return valor?.trim() || 'CNPJ não informado'
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`
}

export function CampoDeBuscaDeMarca({ aoEscolher }: Props) {
  const idCampo = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef(0)
  const [termo, setTermo] = useState('')
  const [sugestoes, setSugestoes] = useState<MarcaDaCarteira[]>([])
  const [buscando, setBuscando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [escolhida, setEscolhida] = useState<MarcaDaCarteira | null>(null)
  const [cliente, setCliente] = useState<MarcaDaCarteira | null>(null)
  const [marcasDoCliente, setMarcasDoCliente] = useState<MarcaDaCarteira[]>([])
  const [carregandoMarcas, setCarregandoMarcas] = useState(false)
  const [modoCadastro, setModoCadastro] = useState(false)
  const [nomeNovaMarca, setNomeNovaMarca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, iniciarCadastro] = useTransition()

  useEffect(() => {
    if (!aberto || escolhida || cliente) return
    const numero = ++consultaAtual.current
    const limpo = termo.trim()
    setBuscando(true)
    const timer = setTimeout(async () => {
      const resultado = await buscarMarcas(limpo)
      if (numero !== consultaAtual.current) return
      setSugestoes(resultado)
      setBuscando(false)
    }, limpo ? ATRASO_DA_BUSCA_MS : 0)
    return () => clearTimeout(timer)
  }, [aberto, cliente, escolhida, termo])

  useEffect(() => {
    if (!aberto) return
    function fechar(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  function limparContexto() {
    consultaAtual.current += 1
    setEscolhida(null)
    setCliente(null)
    setMarcasDoCliente([])
    setModoCadastro(false)
    setNomeNovaMarca('')
    setErro(null)
    setAviso(null)
  }

  function reiniciarBusca(valor: string) {
    limparContexto()
    setTermo(valor)
    setSugestoes([])
    setAberto(true)
  }

  function concluir(item: MarcaDaCarteira, mensagem?: string) {
    consultaAtual.current += 1
    setEscolhida(item)
    setCliente(null)
    setMarcasDoCliente([])
    setModoCadastro(false)
    setTermo(item.marca_nome ?? item.cliente_nome)
    setSugestoes([])
    setAberto(false)
    setAviso(mensagem ?? null)
    setErro(null)
    aoEscolher(item)
  }

  async function selecionarResultado(item: MarcaDaCarteira) {
    if (item.marca_id && item.marca_nome) {
      concluir(item)
      return
    }

    const numero = ++consultaAtual.current
    setCliente(item)
    setEscolhida(null)
    setAberto(false)
    setSugestoes([])
    setTermo(item.cliente_nome)
    setCarregandoMarcas(true)
    setModoCadastro(false)
    setErro(null)
    setAviso(null)

    const marcas = await listarMarcasDoCliente(item.cliente_id)
    if (numero !== consultaAtual.current) return
    setMarcasDoCliente(marcas)
    setCarregandoMarcas(false)
    if (marcas.length === 0) setModoCadastro(true)
  }

  function cadastrar() {
    if (!cliente || !nomeNovaMarca.trim() || salvando) return
    setErro(null)
    iniciarCadastro(async () => {
      const retorno = await cadastrarMarcaNaConsulta(nomeNovaMarca.trim(), cliente.cliente_id)
      if (retorno.erro || !retorno.marcaId || !retorno.marcaNome) {
        setErro(retorno.erro ?? 'Não foi possível cadastrar a marca.')
        return
      }
      concluir(
        { ...cliente, marca_id: retorno.marcaId, marca_nome: retorno.marcaNome },
        'Marca cadastrada e vinculada ao anunciante. O vínculo ficará pendente de revisão da governança.',
      )
    })
  }

  return (
    <div ref={caixa} className="relative max-w-[680px]">
      <label htmlFor={idCampo} className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">Cliente ou marca</label>
      <input
        id={idCampo}
        type="text"
        autoComplete="off"
        value={termo}
        placeholder="Busque primeiro pelo nome da marca…"
        onFocus={() => { if (!escolhida && !cliente) setAberto(true) }}
        onChange={(e) => reiniciarBusca(e.target.value)}
        className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />

      {escolhida && (
        <p className="mt-1.5 text-[11px] text-[var(--texto-3)]">
          Anunciante: <strong>{escolhida.cliente_nome}</strong> · CNPJ {formatarCnpj(escolhida.cnpj)}
        </p>
      )}
      {aviso && <p className="mt-1.5 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">{aviso}</p>}

      {aberto && !escolhida && !cliente && (
        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-white shadow-[var(--sombra-janela)]">
          {buscando ? (
            <p className="px-3 py-3 text-[12px] text-[var(--texto-3)]">Buscando na sua carteira…</p>
          ) : sugestoes.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-[var(--texto-3)]">Nenhum cliente ou marca da sua carteira foi encontrado.</p>
          ) : (
            <div className="max-h-[330px] overflow-y-auto">
              {sugestoes.map((item) => (
                <button
                  key={`${item.marca_id ?? 'cliente'}-${item.cliente_id}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); void selecionarResultado(item) }}
                  className="flex w-full flex-col items-start border-b border-[var(--borda)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--superficie-suave)]"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-[12.5px] font-bold text-[var(--texto)]">{item.marca_nome ?? item.cliente_nome}</span>
                    <span className="rounded-full bg-[var(--superficie-suave)] px-2 py-0.5 text-[8.5px] font-bold uppercase text-[var(--texto-3)]">{item.marca_nome ? 'Marca' : 'Cliente'}</span>
                  </div>
                  {item.marca_nome && <span className="mt-0.5 text-[10.5px] text-[var(--texto-2)]">Anunciante: {item.cliente_nome}</span>}
                  <span className="mt-0.5 text-[10px] text-[var(--texto-3)]">CNPJ {formatarCnpj(item.cnpj)} · {item.setor ?? 'Setor não informado'} · {item.industria ?? 'Indústria não informada'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cliente && (
        <section className="mt-3 rounded-[12px] border border-[#DDD6FE] bg-[#FAF8FF] p-4">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[.06em] text-[var(--roxo)]">Cliente selecionado</p>
            <p className="mt-1 text-[13px] font-bold text-[var(--texto)]">{cliente.cliente_nome}</p>
            <p className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">CNPJ {formatarCnpj(cliente.cnpj)}</p>
          </div>

          {carregandoMarcas ? (
            <p className="mt-4 text-[11.5px] text-[var(--texto-3)]">Carregando marcas vinculadas…</p>
          ) : !modoCadastro && marcasDoCliente.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11.5px] font-bold text-[var(--texto)]">Selecione a marca</p>
              <p className="mt-0.5 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">Estas são as marcas já vinculadas a este anunciante. Se a marca desejada não estiver aqui, você pode cadastrá-la para revisão.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {marcasDoCliente.map((marca) => (
                  <button key={marca.marca_id} type="button" onClick={() => concluir(marca)} className="flex items-center justify-between rounded-[9px] border border-[var(--borda-forte)] bg-white px-3 py-2.5 text-left hover:border-[var(--roxo)]">
                    <span className="text-[12px] font-bold text-[var(--texto)]">{marca.marca_nome}</span>
                    <span className="text-[9.5px] font-bold text-[var(--roxo)]">Selecionar →</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setModoCadastro(true)} className="mt-3 text-[10.5px] font-bold text-[var(--roxo)] underline-offset-2 hover:underline">Não encontrei a marca</button>
            </div>
          ) : (
            <div className="mt-4 border-t border-[#E9DDFB] pt-4">
              <div className="rounded-[9px] border border-[#E9DDFB] bg-white px-3 py-2.5">
                <p className="text-[11.5px] font-bold text-[var(--texto)]">Cadastre somente o nome exato da marca.</p>
                <p className="mt-0.5 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">Não inclua campanha, produto, slogan ou variações de escrita. O nome será usado nesta consulta e passará por revisão antes de permanecer na base.</p>
              </div>
              <label className="mt-3 grid gap-1.5">
                <span className="text-[11px] font-bold text-[var(--texto-2)]">Nome da marca</span>
                <input
                  type="text"
                  value={nomeNovaMarca}
                  maxLength={120}
                  autoFocus
                  onChange={(e) => { setNomeNovaMarca(e.target.value); setErro(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cadastrar() } }}
                  placeholder="Ex.: PEGADA"
                  className="h-[42px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-white px-3 text-[13px] outline-none focus:border-[var(--roxo)]"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {erro && <p role="alert" className="text-[10.5px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}
                  <p className="text-[9.5px] text-[var(--texto-3)]">Novo vínculo ficará pendente de revisão da governança.</p>
                </div>
                <button type="button" disabled={!nomeNovaMarca.trim() || salvando} onClick={cadastrar} className="rounded-[9px] px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-45" style={{ background: 'var(--marca)' }}>{salvando ? 'Cadastrando…' : 'Cadastrar marca e continuar'}</button>
              </div>
              {marcasDoCliente.length > 0 && <button type="button" onClick={() => { setModoCadastro(false); setErro(null); setNomeNovaMarca('') }} className="mt-2 text-[10px] font-bold text-[var(--texto-3)]">← Voltar às marcas vinculadas</button>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
