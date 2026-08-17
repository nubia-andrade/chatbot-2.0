'use client'

import { useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'

/**
 * Passo 6 — Resumo. Conteúdo real é a Task 14.
 *
 * "Avançar" aponta para `proposta`, mas essa rota não existe nesta
 * entrega — a 7ª pílula do stepper fica sempre desabilitada
 * ("Disponível na próxima entrega"), e este botão acompanha a mesma
 * decisão de escopo.
 */
export default function PassoResumo() {
  const pronto = useGuardaDoPasso('resumo')

  if (!pronto) {
    return <CarregandoDoPasso />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Resumo da consulta
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Datas, inserções e valor estimado antes de gerar a proposta.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara="datas"
        avancarPara="proposta"
        avancarRotulo="Gerar proposta"
        habilitado={false}
        motivo="Disponível na próxima entrega"
      />
    </div>
  )
}
