'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { atualizarNegociacao } from '@/lib/acoes/acompanhamento-propostas'
import type { StatusNegociacao } from '@/lib/dados/propostas'

type Props = {
  propostaId: string
  statusInicial: StatusNegociacao
  valorProposto: number
  valorFinalInicial: number | null
  dataFechamentoInicial: string | null
  observacaoInicial: string | null
  motivoPerdaInicial: string | null
  podeEditar: boolean
}

const ROTULOS: Record<StatusNegociacao, string> = {
  em_negociacao: 'Em negociação',
  fechada: 'Fechada',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
  substituida: 'Substituída',
}

const MOTIVOS = [
  'Preço',
  'Concorrência',
  'Mudança de estratégia',
  'Cliente desistiu',
  'Prazo / disponibilidade',
  'Outro',
]

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PainelNegociacaoProposta({
  propostaId,
  statusInicial,
  valorProposto,
  valorFinalInicial,
  dataFechamentoInicial,
  observacaoInicial,
  motivoPerdaInicial,
  podeEditar,
}: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState<Exclude<StatusNegociacao, 'substituida'>>(
    statusInicial === 'substituida' ? 'em_negociacao' : statusInicial,
  )
  const [valorFinal, setValorFinal] = useState(String(valorFinalInicial ?? valorProposto))
  const [dataFechamento, setDataFechamento] = useState(dataFechamentoInicial ?? hojeIso())
  const [observacao, setObservacao] = useState(observacaoInicial ?? '')
  const [motivoPerda, setMotivoPerda] = useState(motivoPerdaInicial ?? '')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [salvando, iniciarTransicao] = useTransition()

  const bloqueada = statusInicial === 'substituida'

  function salvar() {
    setMensagem(null)
    const numeroValor = Number(valorFinal.replace(',', '.'))

    iniciarTransicao(async () => {
      const retorno = await atualizarNegociacao({
        propostaId,
        status,
        valorFinalNegociado: status === 'fechada' && Number.isFinite(numeroValor) ? numeroValor : null,
        dataFechamento: status === 'fechada' ? dataFechamento : null,
        observacao,
        motivoPerda: status === 'perdida' ? motivoPerda : null,
      })

      if (retorno.erro) {
        setMensagem(retorno.erro)
        return
      }

      setMensagem('Acompanhamento atualizado.')
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <div className="min-w-[210px]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${classeStatus(statusInicial)}`}>
          {ROTULOS[statusInicial]}
        </span>
        {podeEditar && !bloqueada && (
          <button
            type="button"
            onClick={() => { setAberto((valor) => !valor); setMensagem(null) }}
            className="rounded-[8px] border border-[var(--borda-forte)] bg-white px-3 py-1.5 text-[10.5px] font-bold text-[var(--texto-2)]"
          >
            Atualizar
          </button>
        )}
      </div>

      {aberto && podeEditar && !bloqueada && (
        <div className="mt-3 rounded-[12px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-3 text-left">
          <label className="grid gap-1">
            <span className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Status</span>
            <select
              value={status}
              onChange={(evento) => setStatus(evento.target.value as Exclude<StatusNegociacao, 'substituida'>)}
              className="h-9 rounded-[8px] border border-[var(--borda-forte)] bg-white px-2 text-[11.5px]"
            >
              <option value="em_negociacao">Em negociação</option>
              <option value="fechada">Fechada</option>
              <option value="perdida">Perdida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>

          {status === 'fechada' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Valor final</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorFinal}
                  onChange={(evento) => setValorFinal(evento.target.value)}
                  className="h-9 rounded-[8px] border border-[var(--borda-forte)] bg-white px-2 text-[11.5px]"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Data fechamento</span>
                <span className="flex rounded-[8px] border border-[var(--borda-forte)] bg-white px-2 py-1.5">
                  <input
                    type="date"
                    value={dataFechamento}
                    onChange={(evento) => setDataFechamento(evento.target.value)}
                    className="block w-full min-w-0 border-0 bg-transparent p-0 text-[11.5px]"
                  />
                </span>
              </label>
            </div>
          )}

          {status === 'perdida' && (
            <label className="mt-3 grid gap-1">
              <span className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Motivo da perda</span>
              <select
                value={motivoPerda}
                onChange={(evento) => setMotivoPerda(evento.target.value)}
                className="h-9 rounded-[8px] border border-[var(--borda-forte)] bg-white px-2 text-[11.5px]"
              >
                <option value="">Selecione</option>
                {MOTIVOS.map((motivo) => <option key={motivo} value={motivo}>{motivo}</option>)}
              </select>
            </label>
          )}

          <label className="mt-3 grid gap-1">
            <span className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Observação</span>
            <textarea
              value={observacao}
              onChange={(evento) => setObservacao(evento.target.value)}
              rows={2}
              maxLength={500}
              className="resize-y rounded-[8px] border border-[var(--borda-forte)] bg-white px-2 py-2 text-[11.5px]"
              placeholder="Opcional"
            />
          </label>

          {mensagem && <p className="mt-2 text-[10.5px] font-semibold text-[var(--texto-2)]">{mensagem}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="rounded-[8px] px-3 py-2 text-[10.5px] font-bold text-[var(--texto-3)]">Cancelar</button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || (status === 'fechada' && (!valorFinal || !dataFechamento))}
              className="rounded-[8px] px-3 py-2 text-[10.5px] font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--marca)' }}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {!aberto && mensagem && <p className="mt-1 text-right text-[10px] text-[var(--texto-3)]">{mensagem}</p>}
    </div>
  )
}

function classeStatus(status: StatusNegociacao): string {
  if (status === 'fechada') return 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]'
  if (status === 'perdida') return 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]'
  if (status === 'cancelada' || status === 'substituida') return 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'
  return 'bg-[#FFF4E5] text-[#8A5700]'
}
