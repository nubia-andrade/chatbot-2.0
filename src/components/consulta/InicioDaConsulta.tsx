'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CampoDeBuscaDeMarca } from '@/components/consulta/CampoDeBuscaDeMarca'
import { useConsulta } from '@/components/consulta/ProvedorDaConsulta'
import type { MarcaDaCarteira } from '@/lib/dados/busca-marcas'

type ProgramaDaConsulta = {
  id: string
  nome: string
  canal: string
  aceita_regional: boolean
}

type Props = { programas: ProgramaDaConsulta[] }

export function InicioDaConsulta({ programas }: Props) {
  const router = useRouter()
  const { atualizar } = useConsulta()
  const [marca, setMarca] = useState<MarcaDaCarteira | null>(null)
  const [programaId, setProgramaId] = useState('')
  const programa = programas.find((item) => item.id === programaId) ?? null

  function continuar() {
    if (!marca || !programa) return

    atualizar({
      marcaId: marca.marca_id,
      marcaNome: marca.marca_nome,
      cliente: {
        id: marca.cliente_id,
        nome: marca.cliente_nome,
        cnpj: marca.cnpj,
        setor: marca.setor,
        industria: marca.industria,
        apto_regional: marca.apto_regional,
      },
      programaId: programa.id,
      programaNome: programa.nome,
      modalidade: 'nacional',
      itens: [],
      datasConfirmadas: false,
    })

    router.push('/consulta/calendario')
  }

  return (
    <section className="overflow-hidden rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
      <header className="flex items-center justify-between border-b border-[var(--borda)] px-7 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--roxo)]">Nova consulta</p>
          <h1 className="mt-1 text-[22px] font-bold text-[var(--texto)]">Marca e programa</h1>
        </div>
        <span className="text-[12px] font-semibold text-[var(--texto-3)]">Início da consulta</span>
      </header>

      <div className="grid min-h-[560px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-8 p-7 lg:border-r lg:border-[var(--borda)]">
          <div>
            <h2 className="mb-3 text-[15px] font-bold text-[var(--texto)]">1. Qual marca deseja consultar?</h2>
            <CampoDeBuscaDeMarca
              aoEscolher={(novaMarca) => {
                setMarca(novaMarca)
                setProgramaId('')
              }}
            />

            {marca && (
              <div className="mt-4 rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Marca selecionada</p>
                    <p className="mt-1 text-[16px] font-bold text-[var(--texto)]">{marca.marca_nome}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{
                      color: marca.apto_regional ? 'var(--disponivel)' : 'var(--texto-3)',
                      background: marca.apto_regional ? 'var(--disponivel-fundo)' : 'var(--esgotado-fundo)',
                    }}
                  >
                    {marca.apto_regional ? 'Elegível para regional' : 'Não elegível para regional'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Anunciante</p>
                    <p className="mt-1 text-[13px] font-semibold">{marca.cliente_nome}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Setor</p>
                    <p className="mt-1 text-[13px] font-semibold">{marca.setor ?? 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Indústria</p>
                    <p className="mt-1 text-[13px] font-semibold">{marca.industria ?? 'Não informada'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={marca ? '' : 'pointer-events-none opacity-45'}>
            <h2 className="mb-3 text-[15px] font-bold text-[var(--texto)]">2. Escolha o programa</h2>
            <select
              value={programaId}
              onChange={(evento) => setProgramaId(evento.target.value)}
              className="h-[44px] w-full max-w-[520px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] outline-none focus:border-[#A031F5]"
            >
              <option value="">Selecione um programa</option>
              {programas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} · {item.canal}{item.aceita_regional ? ' · Regional' : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11.5px] text-[var(--texto-3)]">
              Somente programas ativos e liberados para proposta aparecem aqui.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-5 bg-[var(--superficie-suave)] p-6">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--texto)]">Resumo da consulta</h2>
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--texto-3)]">
              A marca identifica o anunciante oficial da carteira. Setor e indústria desse anunciante alimentam as regras de concorrência do calendário.
            </p>
          </div>

          <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Marca</p>
            <p className="mt-1 text-[13px] font-semibold">{marca?.marca_nome ?? 'Ainda não selecionada'}</p>
            {marca && <p className="mt-1 text-[11px] text-[var(--texto-3)]">{marca.cliente_nome}</p>}
            <div className="my-3 border-t border-[var(--borda)]" />
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Programa</p>
            <p className="mt-1 text-[13px] font-semibold">{programa?.nome ?? 'Ainda não selecionado'}</p>
          </div>

          <div className="mt-auto">
            <div className="mb-3 rounded-[var(--raio-card)] bg-[var(--prazo-fundo)] px-4 py-3 text-[11.5px] leading-[1.5] text-[var(--texto-2)]">
              O calendário considera vendas nacionais, ações regionais, concorrência, compras anteriores do anunciante, limite mensal, prazo, bloqueios e datas especiais.
            </div>
            <button
              type="button"
              disabled={!marca || !programa}
              onClick={continuar}
              className="h-[48px] w-full rounded-[12px] text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: 'var(--marca)' }}
            >
              Continuar para calendário →
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}
