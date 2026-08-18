'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { carregarResumoFinanceiro } from '@/lib/acoes/resumo-financeiro'
import { gerarProposta, type ResultadoGerarProposta } from '@/lib/acoes/propostas'
import type { ResumoFinanceiroDaProposta } from '@/lib/dominio/resumo-financeiro'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function PassoResumo() {
  const pronto = useGuardaDoPasso('resumo')
  const { estado } = useConsulta()
  const [resumo, setResumo] = useState<ResumoFinanceiroDaProposta | null>(null)
  const [erroResumo, setErroResumo] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoGerarProposta | null>(null)

  const chaveItens = useMemo(() => JSON.stringify(estado.itens), [estado.itens])

  useEffect(() => {
    if (!estado.programaId || estado.itens.length === 0) return
    let ativo = true
    setResumo(null)
    setErroResumo(null)

    carregarResumoFinanceiro({
      programaId: estado.programaId,
      modalidade: estado.modalidade,
      itens: estado.itens,
    }).then((retorno) => {
      if (!ativo) return
      setResumo(retorno.resumo)
      setErroResumo(retorno.erro)
    }).catch(() => {
      if (ativo) setErroResumo('Não foi possível calcular os valores da proposta.')
    })

    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.programaId, estado.modalidade, chaveItens])

  if (!pronto || !estado.cliente || !estado.programaId) return <CarregandoDoPasso />

  async function aoGerar() {
    if (!resumo || !estado.cliente || !estado.programaId) return
    setGerando(true)
    setResultado(null)
    try {
      const retorno = await gerarProposta({
        marcaId: estado.marcaId,
        marcaNome: estado.marcaNome,
        clienteId: estado.cliente.id,
        clienteNome: estado.cliente.nome,
        programaId: estado.programaId,
        programaNome: estado.programaNome ?? 'Programa',
        modalidade: estado.modalidade,
        itens: estado.itens,
      })
      setResultado(retorno)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-[19px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          Resumo da proposta
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Confira as datas e todos os valores antes de gerar o PDF e notificar o time do programa.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
          <Campo rotulo="Marca" valor={estado.marcaNome ?? '—'} />
          <Campo rotulo="Anunciante" valor={estado.cliente.nome} />
          <Campo rotulo="Setor / indústria" valor={`${estado.cliente.setor ?? '—'} · ${estado.cliente.industria ?? '—'}`} />
          <Campo rotulo="Programa" valor={estado.programaNome ?? '—'} />
          <Campo rotulo="Modalidade" valor={estado.modalidade === 'regional' ? 'Regional' : 'Nacional'} />
          <Campo rotulo="Novas ações" valor={String(estado.itens.length)} />
        </aside>

        <div className="flex flex-col gap-4">
          {!resumo && !erroResumo && <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-8 text-center text-[13px] text-[var(--texto-3)]">Calculando valores…</div>}

          {erroResumo && <div role="alert" className="rounded-[var(--raio-card)] border border-[var(--concorrencia)] bg-[var(--concorrencia-fundo)] p-4 text-[13px] text-[var(--concorrencia-texto)]">{erroResumo}</div>}

          {resumo && (
            <>
              <section className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)]">
                <header className="border-b border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3">
                  <h3 className="text-[13.5px] font-bold text-[var(--texto)]">Datas e valores</h3>
                </header>
                <div className="divide-y divide-[var(--borda)]">
                  {resumo.linhas.map((linha) => (
                    <div key={linha.data} className="grid gap-3 px-4 py-4 xl:grid-cols-[150px_1fr_150px]">
                      <div>
                        <p className="text-[13px] font-bold text-[var(--texto)]">{formatarData(linha.data)}</p>
                        {linha.pracas.length > 0 && <p className="mt-1 text-[11px] text-[var(--texto-3)]">{linha.pracas.join(', ')}</p>}
                        {linha.periodo_especial_nome && (
                          <p className="mt-1 text-[10.5px] font-semibold text-[var(--roxo)]">{linha.periodo_especial_nome} · +{linha.periodo_especial_percentual}%</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[11.5px] text-[var(--texto-2)] sm:grid-cols-3">
                        <Valor rotulo="Mídia TV" valor={linha.midia_tv} />
                        <Valor rotulo="Digital" valor={linha.midia_digital} />
                        <Valor rotulo="Simulcast" valor={linha.simulcast} />
                        <Valor rotulo="Produção" valor={linha.producao} />
                        <Valor rotulo="Direitos TV" valor={linha.direitos_tv} />
                        <Valor rotulo="Direitos Digital" valor={linha.direitos_digital} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10.5px] uppercase text-[var(--texto-3)]">Total comercial</p>
                        <p className="mt-1 text-[15px] font-bold text-[var(--texto)]">{moeda(linha.total_comercial)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
                <h3 className="text-[13.5px] font-bold text-[var(--texto)]">Composição financeira</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <CartaoValor rotulo="Mídia TV" valor={resumo.midia_tv} />
                  <CartaoValor rotulo="Mídia Digital" valor={resumo.midia_digital} />
                  <CartaoValor rotulo="Simulcast" valor={resumo.simulcast} />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[12px] bg-[#F5F3FF] px-4 py-4">
                  <strong className="text-[13px] text-[var(--texto)]">Total Comercial</strong>
                  <strong className="text-[20px] text-[var(--roxo)]">{moeda(resumo.total_comercial)}</strong>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CartaoValor rotulo="Produção" valor={resumo.producao} subtitulo="Fora do Total Comercial" />
                  <CartaoValor rotulo="Direitos e conexos" valor={resumo.direitos_total} subtitulo={`TV ${moeda(resumo.direitos_tv)} · Digital ${moeda(resumo.direitos_digital)}`} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--borda)] pt-4">
                  <span className="text-[12px] font-semibold text-[var(--texto-3)]">Total geral para registro</span>
                  <strong className="text-[16px] text-[var(--texto)]">{moeda(resumo.total_geral)}</strong>
                </div>
              </section>
            </>
          )}

          {resultado && <ResultadoDaGeracao resultado={resultado} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--borda)] pt-6">
        <Link href="/consulta/calendario" className="rounded-[11px] border border-[var(--borda-forte)] px-5 py-[11px] text-[13.5px] font-bold text-[var(--texto-2)]">← Voltar ao calendário</Link>
        <button
          type="button"
          disabled={!resumo || gerando || Boolean(resultado?.propostaId)}
          onClick={aoGerar}
          className="rounded-[11px] px-6 py-[11px] text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
        >
          {gerando ? 'Gerando proposta…' : resultado?.propostaId ? 'Proposta gerada ✓' : 'Gerar proposta →'}
        </button>
      </div>
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="border-b border-[var(--borda)] py-3 first:pt-0 last:border-0 last:pb-0"><p className="text-[10px] font-bold uppercase tracking-[.05em] text-[var(--texto-3)]">{rotulo}</p><p className="mt-1 text-[13px] font-semibold text-[var(--texto)]">{valor}</p></div>
}

function Valor({ rotulo, valor }: { rotulo: string; valor: number }) {
  return <p><span className="text-[var(--texto-3)]">{rotulo}: </span><strong className="text-[var(--texto)]">{moeda(valor)}</strong></p>
}

function CartaoValor({ rotulo, valor, subtitulo }: { rotulo: string; valor: number; subtitulo?: string }) {
  return <div className="rounded-[11px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-3"><p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">{rotulo}</p><p className="mt-1 text-[15px] font-bold text-[var(--texto)]">{moeda(valor)}</p>{subtitulo && <p className="mt-1 text-[10px] text-[var(--texto-3)]">{subtitulo}</p>}</div>
}

function ResultadoDaGeracao({ resultado }: { resultado: ResultadoGerarProposta }) {
  const sucessoPdf = resultado.pdfGerado
  return (
    <section className={`rounded-[var(--raio-card)] border p-5 ${sucessoPdf ? 'border-[var(--disponivel)] bg-[var(--disponivel-fundo)]' : 'border-[var(--concorrencia)] bg-[var(--concorrencia-fundo)]'}`}>
      <h3 className="text-[14px] font-bold text-[var(--texto)]">{sucessoPdf ? '✓ Proposta gerada' : 'Não foi possível gerar a proposta'}</h3>
      {resultado.propostaId && <p className="mt-1 text-[11.5px] text-[var(--texto-2)]">Código: {resultado.propostaId.slice(0, 8).toUpperCase()}</p>}
      {sucessoPdf && <p className="mt-3 text-[12px] text-[var(--texto-2)]">PDF armazenado com segurança.</p>}
      {resultado.emailEnviado ? (
        <p className="mt-1 text-[12px] font-semibold text-[var(--disponivel-texto)]">E-mail enviado ao executivo e aos consultores vinculados ao programa.</p>
      ) : sucessoPdf && !resultado.emailConfigurado ? (
        <p className="mt-1 text-[12px] text-[var(--texto-2)]">O envio será habilitado após a configuração do Microsoft 365.</p>
      ) : null}
      {resultado.destinatarios.length > 0 && <p className="mt-2 text-[11px] text-[var(--texto-3)]">Destinatários: {resultado.destinatarios.join(', ')}</p>}
      {resultado.erro && <p className="mt-2 text-[11.5px] text-[var(--concorrencia-texto)]">{resultado.erro}</p>}
      {sucessoPdf && <Link href="/propostas" className="mt-4 inline-flex rounded-[9px] border border-[var(--borda-forte)] bg-white px-4 py-2 text-[12px] font-bold text-[var(--texto-2)]">Ver propostas</Link>}
    </section>
  )
}
