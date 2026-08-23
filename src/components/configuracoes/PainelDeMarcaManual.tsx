'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { buscarClientes, type Cliente } from '@/lib/dados/busca-clientes'
import { marcarMarcaManualRevisada, removerVinculoMarcaManual, vincularMarcaManual } from '@/lib/acoes/marcas-manuais'
import type { VinculoManualDeMarca } from '@/lib/dados/marcas-manuais'

type Props = {
  iniciais: VinculoManualDeMarca[]
}

export function PainelDeMarcaManual({ iniciais }: Props) {
  const [aberto, setAberto] = useState(false)
  const [nomeMarca, setNomeMarca] = useState('')
  const [termoCliente, setTermoCliente] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [pendente, iniciarTransicao] = useTransition()

  const podeSalvar = nomeMarca.trim() !== '' && Boolean(cliente) && !pendente

  useEffect(() => {
    if (cliente || termoCliente.trim().length < 2) return

    let ativo = true
    const timer = setTimeout(() => {
      buscarClientes(termoCliente, 8).then((resultado) => {
        if (ativo) setSugestoes(resultado)
      })
    }, 220)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [termoCliente, cliente])

  const ordenados = useMemo(
    () => [...iniciais].sort((a, b) => {
      if (a.revisao_status !== b.revisao_status) return a.revisao_status === 'pendente' ? -1 : 1
      return b.criado_em.localeCompare(a.criado_em)
    }),
    [iniciais],
  )

  const quantidadePendentes = iniciais.filter((item) => item.revisao_status === 'pendente').length
  const sugestoesVisiveis = !cliente && termoCliente.trim().length >= 2 ? sugestoes : []

  function salvar() {
    if (!cliente || !nomeMarca.trim()) return
    setErro(null)
    setMensagem(null)
    iniciarTransicao(async () => {
      const retorno = await vincularMarcaManual(nomeMarca, cliente.id)
      if (retorno.erro) {
        setErro(retorno.erro)
        return
      }
      setMensagem(`Marca ${nomeMarca.trim()} vinculada a ${cliente.nome}.`)
      setNomeMarca('')
      setTermoCliente('')
      setCliente(null)
      setSugestoes([])
      setAberto(false)
      window.location.reload()
    })
  }

  function revisar(vinculo: VinculoManualDeMarca) {
    setErro(null)
    setMensagem(null)
    iniciarTransicao(async () => {
      const retorno = await marcarMarcaManualRevisada(vinculo.marca_id, vinculo.cliente_id)
      if (retorno.erro) {
        setErro(retorno.erro)
        return
      }
      window.location.reload()
    })
  }

  function remover(vinculo: VinculoManualDeMarca) {
    if (!window.confirm(`Remover o vínculo manual ${vinculo.marca_nome} → ${vinculo.cliente_nome}?`)) return
    setErro(null)
    setMensagem(null)
    iniciarTransicao(async () => {
      const retorno = await removerVinculoMarcaManual(vinculo.marca_id, vinculo.cliente_id)
      if (retorno.erro) {
        setErro(retorno.erro)
        return
      }
      window.location.reload()
    })
  }

  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Cadastro complementar</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-bold text-[var(--texto)]">Vincular nova marca</h2>
            {quantidadePendentes > 0 && (
              <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[9.5px] font-bold text-[#8A5700]">
                {quantidadePendentes} pendente{quantidadePendentes === 1 ? '' : 's'} de revisão
              </span>
            )}
          </div>
          <p className="mt-1 max-w-[760px] text-[12.5px] leading-[1.55] text-[var(--texto-3)]">
            Marcas cadastradas pelos executivos ficam disponíveis imediatamente e entram como pendentes para revisão. Use esta área para confirmar ou corrigir os vínculos quando necessário.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setAberto((valor) => !valor); setErro(null); setMensagem(null) }}
          className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold text-white"
          style={{ background: 'var(--marca)' }}
        >
          {aberto ? 'Fechar' : '+ Vincular nova marca'}
        </button>
      </div>

      {aberto && (
        <div className="mt-5 grid gap-4 rounded-[12px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-4 lg:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[11.5px] font-bold text-[var(--texto-2)]">Nome da marca</span>
            <input
              value={nomeMarca}
              onChange={(evento) => setNomeMarca(evento.target.value)}
              placeholder="Ex.: OXFORD"
              maxLength={120}
              className="h-[44px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-white px-3 text-[13.5px] outline-none focus:border-[#A031F5]"
            />
          </label>

          <div className="relative">
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-bold text-[var(--texto-2)]">Anunciante oficial</span>
              <input
                value={cliente ? cliente.nome : termoCliente}
                onChange={(evento) => {
                  setCliente(null)
                  setTermoCliente(evento.target.value)
                }}
                placeholder="Busque o anunciante da carteira…"
                className="h-[44px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-white px-3 text-[13.5px] outline-none focus:border-[#A031F5]"
              />
            </label>

            {sugestoesVisiveis.length > 0 && (
              <div className="absolute left-0 right-0 top-[68px] z-20 max-h-[260px] overflow-y-auto rounded-[10px] border border-[var(--borda-forte)] bg-white shadow-[var(--sombra-janela)]">
                {sugestoesVisiveis.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(evento) => {
                      evento.preventDefault()
                      setCliente(item)
                      setTermoCliente('')
                      setSugestoes([])
                    }}
                    className="flex w-full flex-col items-start border-b border-[var(--borda)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--superficie-suave)]"
                  >
                    <span className="text-[12.5px] font-bold text-[var(--texto)]">{item.nome}</span>
                    <span className="mt-0.5 text-[10.5px] text-[var(--texto-3)]">{item.setor ?? 'Sem setor'} · {item.industria ?? 'Sem indústria'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cliente && (
            <div className="lg:col-span-2 rounded-[10px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-[var(--roxo)]">Anunciante selecionado</p>
              <p className="mt-1 text-[13px] font-bold text-[var(--texto)]">{cliente.nome}</p>
            </div>
          )}

          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              {erro && <p role="alert" className="text-[11.5px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}
              {mensagem && <p className="text-[11.5px] font-semibold text-[var(--disponivel-texto)]">{mensagem}</p>}
            </div>
            <button
              type="button"
              disabled={!podeSalvar}
              onClick={salvar}
              className="rounded-[10px] px-5 py-2.5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: 'var(--marca)' }}
            >
              {pendente ? 'Salvando…' : 'Salvar vínculo'}
            </button>
          </div>
        </div>
      )}

      {erro && !aberto && <p role="alert" className="mt-3 text-[11.5px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}

      {ordenados.length > 0 && (
        <div className="mt-5 border-t border-[var(--borda)] pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.05em] text-[var(--texto-3)]">Vínculos manuais ativos</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ordenados.map((vinculo) => (
              <div key={`${vinculo.marca_id}-${vinculo.cliente_id}`} className={`rounded-[10px] border p-3 ${vinculo.revisao_status === 'pendente' ? 'border-[#F1D3A6] bg-[#FFF8EC]' : 'border-[var(--borda)] bg-[var(--superficie-suave)]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12.5px] font-bold text-[var(--texto)]">{vinculo.marca_nome}</p>
                      {vinculo.revisao_status === 'pendente' && (
                        <span className="rounded-full bg-[#FFE8C2] px-2 py-0.5 text-[8.5px] font-bold uppercase text-[#8A5700]">Pendente</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-[var(--texto-3)]">→ {vinculo.cliente_nome}</p>
                    <p className="mt-1 text-[9.5px] text-[var(--texto-3)]">Origem: {vinculo.origem === 'consulta' ? 'Nova Consulta' : 'Administração'}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/5 pt-2.5">
                  {vinculo.revisao_status === 'pendente' && (
                    <button type="button" disabled={pendente} onClick={() => revisar(vinculo)} className="text-[10.5px] font-bold text-[var(--disponivel-texto)]">Marcar revisada</button>
                  )}
                  <button type="button" disabled={pendente} onClick={() => remover(vinculo)} className="text-[10.5px] font-bold text-[var(--concorrencia-texto)]">Remover/corrigir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
