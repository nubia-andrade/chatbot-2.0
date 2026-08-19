'use client'

import { useEffect, useState } from 'react'
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
  const { estado, atualizar } = useConsulta()
  const emNovaVersao = Boolean(estado.propostaAnteriorId)
  const [marca, setMarca] = useState<MarcaDaCarteira | null>(null)
  const [programaId, setProgramaId] = useState('')

  useEffect(() => {
    if (!emNovaVersao || !estado.cliente || !estado.programaId) return
    setMarca({
      marca_id: estado.marcaId,
      marca_nome: estado.marcaNome,
      cliente_id: estado.cliente.id,
      cliente_nome: estado.cliente.nome,
      cnpj: estado.cliente.cnpj,
      setor: estado.cliente.setor,
      industria: estado.cliente.industria,
      apto_regional: estado.cliente.apto_regional,
    })
    setProgramaId(estado.programaId)
  }, [emNovaVersao, estado.cliente, estado.programaId, estado.marcaId, estado.marcaNome])

  const programa = programas.find((item) => item.id === programaId) ?? null
  const contextoCompleto = estado.produto.trim() !== '' && estado.objetivo.trim() !== ''
  const regionalDisponivel = Boolean(programa?.aceita_regional && marca?.apto_regional)
  const modalidade = regionalDisponivel && estado.modalidade === 'regional' ? 'regional' : 'nacional'

  function continuar() {
    if (!marca || !programa || !contextoCompleto) return

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
      produto: estado.produto.trim(),
      objetivo: estado.objetivo.trim(),
      modalidade,
      itens: emNovaVersao ? estado.itens : [],
      incluirDigital: emNovaVersao ? estado.incluirDigital : false,
      incluirRedesSociais: emNovaVersao ? estado.incluirRedesSociais : false,
      datasConfirmadas: false,
    })

    router.push('/consulta/calendario')
  }

  return (
    <section className="overflow-hidden rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]">
      <header className="flex items-center justify-between border-b border-[var(--borda)] px-7 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--roxo)]">{emNovaVersao ? 'Nova versão da proposta' : 'Nova consulta'}</p>
          <h1 className="mt-1 text-[22px] font-bold text-[var(--texto)]">Cliente, marca e programa</h1>
        </div>
        <span className="text-[12px] font-semibold text-[var(--texto-3)]">{emNovaVersao ? 'Revisão comercial' : 'Início da consulta'}</span>
      </header>

      {emNovaVersao && (
        <div className="border-b border-[#DDD6FE] bg-[#F8F6FF] px-7 py-4">
          <p className="text-[12.5px] font-bold text-[var(--roxo)]">Nova versão preservando a proposta anterior</p>
          <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--texto-2)]">
            Anunciante, marca e programa permanecem fixos. Você pode revisar Produto, Objetivo, modalidade, complementos e datas. A versão anterior continuará disponível para auditoria.
          </p>
        </div>
      )}

      <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-8 p-7 lg:border-r lg:border-[var(--borda)]">
          <div>
            <h2 className="mb-3 text-[15px] font-bold text-[var(--texto)]">1. {emNovaVersao ? 'Anunciante e marca' : 'Qual cliente ou marca deseja consultar?'}</h2>

            {!emNovaVersao && (
              <CampoDeBuscaDeMarca
                aoEscolher={(novaMarca) => {
                  setMarca(novaMarca)
                  setProgramaId('')
                  atualizar({ produto: '', objetivo: '', modalidade: 'nacional' })
                }}
              />
            )}

            {marca && (
              <div className={`${emNovaVersao ? '' : 'mt-4'} rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] p-4`}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Anunciante selecionado</p>
                    <p className="mt-1 text-[16px] font-bold text-[var(--texto)]">{marca.cliente_nome}</p>
                    {marca.marca_nome && (
                      <p className="mt-1 text-[12px] text-[var(--texto-2)]">
                        Marca: <strong>{marca.marca_nome}</strong>
                      </p>
                    )}
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

                <div className="grid gap-3 sm:grid-cols-2">
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
              disabled={emNovaVersao}
              onChange={(evento) => {
                setProgramaId(evento.target.value)
                atualizar({ modalidade: 'nacional', itens: [] })
              }}
              className="h-[44px] w-full max-w-[520px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] outline-none focus:border-[#A031F5] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">Selecione um programa</option>
              {programas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} · {item.canal}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11.5px] text-[var(--texto-3)]">
              {emNovaVersao ? 'O programa é mantido para preservar a família de versões.' : 'Somente programas ativos e liberados para proposta aparecem aqui.'}
            </p>

            {programa?.aceita_regional && (
              <div className="mt-4 max-w-[520px] rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie-suave)] p-4">
                <label className={`flex items-start gap-3 ${marca?.apto_regional ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={modalidade === 'regional'}
                    disabled={!marca?.apto_regional}
                    onChange={(evento) => atualizar({
                      modalidade: evento.target.checked ? 'regional' : 'nacional',
                      itens: [],
                    })}
                    className="mt-0.5 h-4 w-4 accent-[#A031F5]"
                  />
                  <span>
                    <span className="block text-[12.5px] font-bold text-[var(--texto)]">Ação regional</span>
                    <span className="mt-0.5 block text-[11px] leading-[1.45] text-[var(--texto-3)]">
                      {marca?.apto_regional
                        ? 'Opcional. Desmarcado, a proposta segue como Nacional. Marcado, o calendário e os preços usam as regras regionais.'
                        : 'Este programa aceita Regional, mas o anunciante selecionado não está elegível para proposta regional.'}
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className={marca && programa ? '' : 'pointer-events-none opacity-45'}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--texto)]">3. Informações da proposta</h2>
                <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Produto e objetivo são obrigatórios e acompanham a proposta até o histórico.</p>
              </div>
              <span className="text-[10.5px] font-semibold text-[var(--texto-3)]">Obrigatórios</span>
            </div>

            <div className="grid max-w-[700px] gap-4">
              <label className="grid gap-1.5">
                <span className="text-[11.5px] font-bold text-[var(--texto-2)]">Produto</span>
                <input
                  type="text"
                  value={estado.produto}
                  maxLength={120}
                  onChange={(evento) => atualizar({ produto: evento.target.value })}
                  placeholder="Ex.: Cartão de crédito, nova coleção, campanha de Black Friday"
                  className="h-[44px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
                />
              </label>

              <label className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11.5px] font-bold text-[var(--texto-2)]">Objetivo</span>
                  <span className="text-[10px] text-[var(--texto-3)]">{estado.objetivo.length}/420</span>
                </div>
                <textarea
                  value={estado.objetivo}
                  maxLength={420}
                  rows={4}
                  onChange={(evento) => atualizar({ objetivo: evento.target.value })}
                  placeholder="Descreva o objetivo da marca para esta proposta. Este texto aparecerá no slide comercial."
                  className="resize-y rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 py-2.5 text-[13.5px] leading-[1.5] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
                />
              </label>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-5 bg-[var(--superficie-suave)] p-6">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--texto)]">Resumo da consulta</h2>
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--texto-3)]">
              {emNovaVersao
                ? 'Esta revisão pertence à mesma oportunidade da proposta anterior. A nova emissão será registrada como uma versão seguinte.'
                : 'O cliente vem da carteira do executivo. Quando houver uma marca conhecida, ela também acompanha a proposta. Setor e indústria alimentam as regras de concorrência do calendário.'}
            </p>
          </div>

          <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-white p-4">
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Anunciante</p>
            <p className="mt-1 text-[13px] font-semibold">{marca?.cliente_nome ?? 'Ainda não selecionado'}</p>
            {marca?.marca_nome && (
              <>
                <p className="mt-3 text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Marca</p>
                <p className="mt-1 text-[12px] font-semibold">{marca.marca_nome}</p>
              </>
            )}
            <div className="my-3 border-t border-[var(--borda)]" />
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Programa</p>
            <p className="mt-1 text-[13px] font-semibold">{programa?.nome ?? 'Ainda não selecionado'}</p>
            {programa && (
              <p className="mt-1 text-[11px] font-semibold text-[var(--texto-3)]">
                Modalidade: {modalidade === 'regional' ? 'Regional' : 'Nacional'}
              </p>
            )}
            <div className="my-3 border-t border-[var(--borda)]" />
            <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Produto</p>
            <p className="mt-1 text-[12px] font-semibold">{estado.produto.trim() || 'Ainda não informado'}</p>
            <p className="mt-3 text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Objetivo</p>
            <p className="mt-1 line-clamp-4 text-[11px] leading-[1.45] text-[var(--texto-2)]">{estado.objetivo.trim() || 'Ainda não informado'}</p>
          </div>

          <div className="mt-auto">
            <div className="mb-3 rounded-[var(--raio-card)] bg-[var(--prazo-fundo)] px-4 py-3 text-[11.5px] leading-[1.5] text-[var(--texto-2)]">
              {emNovaVersao
                ? 'As datas copiadas serão revalidadas contra a disponibilidade atual antes da nova emissão. Nenhuma condição antiga é assumida como disponível.'
                : 'O calendário considera vendas nacionais, ações regionais, concorrência, compras anteriores do anunciante, limite mensal, prazo, bloqueios e datas especiais.'}
            </div>
            <button
              type="button"
              disabled={!marca || !programa || !contextoCompleto}
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
