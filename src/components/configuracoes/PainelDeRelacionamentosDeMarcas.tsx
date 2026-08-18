'use client'

import { useState } from 'react'
import { CampoDeBuscaDeCliente } from '@/components/comum/CampoDeBuscaDeCliente'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { RelacionamentoMarcaTake } from '@/lib/dados/marcas-take'
import {
  corrigirRelacionamentoMarca,
  pesquisarRelacionamentosMarcas,
  removerCorrecaoRelacionamentoMarca,
} from '@/lib/acoes/marcas-take'

type Props = {
  iniciais: RelacionamentoMarcaTake[]
}

export function PainelDeRelacionamentosDeMarcas({ iniciais }: Props) {
  const [termo, setTermo] = useState('')
  const [relacionamentos, setRelacionamentos] = useState(iniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const chaveDe = (item: RelacionamentoMarcaTake) =>
    `${item.anunciante_take_id}|${item.marca_id}`

  async function pesquisar(termoAtual: string = termo) {
    setCarregando(true)
    setErro(null)
    const resultado = await pesquisarRelacionamentosMarcas(termoAtual)
    setCarregando(false)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    setRelacionamentos(resultado.relacionamentos)
  }

  async function corrigir(item: RelacionamentoMarcaTake, cliente: Cliente) {
    const chave = chaveDe(item)
    setSalvando(chave)
    setErro(null)
    const resultado = await corrigirRelacionamentoMarca(
      item.anunciante_take_id,
      item.marca_id,
      cliente.id,
    )
    setSalvando(null)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    setEditando(null)
    await pesquisar()
  }

  async function desfazer(item: RelacionamentoMarcaTake) {
    const chave = chaveDe(item)
    setSalvando(chave)
    setErro(null)
    const resultado = await removerCorrecaoRelacionamentoMarca(
      item.anunciante_take_id,
      item.marca_id,
    )
    setSalvando(null)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    await pesquisar()
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-bold text-[var(--texto)]">Relacionamentos e correções</h2>
        <p className="mt-1 max-w-[780px] text-[12.5px] leading-[1.55] text-[var(--texto-3)]">
          Pesquise por marca, anunciante do Globo Take ou cliente da carteira. A correção manual vale somente para a marca selecionada e não altera as demais marcas do mesmo anunciante.
        </p>
      </div>

      <form
        className="flex max-w-[720px] gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          void pesquisar()
        }}
      >
        <input
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Ex.: PAGBANK, PORTO SEGURO…"
          className="h-[42px] min-w-0 flex-1 rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie)] px-3 text-[13px] outline-none focus:border-[#A031F5]"
        />
        <button
          type="submit"
          disabled={carregando}
          className="rounded-[10px] px-5 text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--marca)' }}
        >
          {carregando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {erro && (
        <div className="rounded-[var(--raio-card)] bg-[var(--concorrencia-fundo)] px-4 py-3 text-[13px] text-[var(--concorrencia)]">
          {erro}
        </div>
      )}

      {relacionamentos.length === 0 ? (
        <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5 text-[13px] text-[var(--texto-3)]">
          Nenhum relacionamento encontrado para esta busca.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {relacionamentos.map((item) => {
            const chave = chaveDe(item)
            const temCorrecao = Boolean(item.cliente_override_id)
            const estaEditando = editando === chave
            const estaSalvando = salvando === chave

            return (
              <article
                key={chave}
                className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5"
              >
                <div className="grid gap-4 lg:grid-cols-[1.1fr_1.1fr_1.5fr_auto] lg:items-start">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--texto-3)]">Marca</p>
                    <p className="mt-1 text-[15px] font-bold text-[var(--texto)]">{item.marca_nome}</p>
                  </div>

                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--texto-3)]">Anunciante no Take</p>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--texto)]">{item.anunciante_take_nome}</p>
                    <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">
                      {item.status_alias === 'automatico' ? 'Relacionamento automático' : item.status_alias === 'confirmado' ? 'Relacionamento confirmado' : 'Pendente'}
                    </p>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--texto-3)]">Anunciante usado na consulta</p>
                      {temCorrecao && (
                        <span className="rounded-full bg-[var(--prazo-fundo)] px-2 py-0.5 text-[10px] font-bold text-[var(--prazo)]">
                          Correção manual
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[14px] font-bold text-[var(--texto)]">
                      {item.cliente_efetivo_nome ?? 'Ainda não relacionado'}
                    </p>
                    {temCorrecao && item.cliente_padrao_nome && (
                      <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">
                        Padrão do Take: {item.cliente_padrao_nome}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={estaSalvando}
                      onClick={() => setEditando(estaEditando ? null : chave)}
                      className="rounded-[9px] border border-[var(--borda-forte)] px-3 py-2 text-[11.5px] font-bold text-[var(--texto-2)] disabled:opacity-50"
                    >
                      {estaEditando ? 'Cancelar' : 'Corrigir'}
                    </button>
                    {temCorrecao && (
                      <button
                        type="button"
                        disabled={estaSalvando}
                        onClick={() => void desfazer(item)}
                        className="rounded-[9px] px-3 py-2 text-[11.5px] font-semibold text-[var(--concorrencia)] disabled:opacity-50"
                      >
                        Usar padrão
                      </button>
                    )}
                  </div>
                </div>

                {estaEditando && (
                  <div className="mt-4 border-t border-[var(--borda)] pt-4">
                    <p className="mb-2 text-[12px] font-semibold text-[var(--texto-2)]">
                      Selecione o anunciante correto da carteira para a marca {item.marca_nome}:
                    </p>
                    <div className={estaSalvando ? 'pointer-events-none opacity-50' : 'max-w-[620px]'}>
                      <CampoDeBuscaDeCliente
                        rotulo="Novo anunciante"
                        placeholder="Busque o cliente/anunciante correto…"
                        aoEscolher={(cliente) => void corrigir(item, cliente)}
                      />
                    </div>
                    {estaSalvando && (
                      <p className="mt-2 text-[12px] text-[var(--texto-3)]">Salvando correção…</p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {relacionamentos.length >= 100 && (
        <p className="text-[11.5px] text-[var(--texto-3)]">
          Exibindo até 100 resultados. Refine a busca para localizar um relacionamento específico.
        </p>
      )}
    </section>
  )
}
