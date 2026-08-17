'use client'

import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'

/**
 * Passo 3 — Programa (tela 1d do handoff). Conteúdo real é a Task 12.
 */
export default function PassoPrograma() {
  useGuardaDoPasso('programa')
  const { estado } = useConsulta()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          O que você está vendendo?
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Escolha o programa ou oportunidade comercial a consultar.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara="setor"
        avancarPara="calendario"
        avancarRotulo="Ver calendário"
        habilitado={estado.programaId !== null}
        motivo="Selecione um programa para continuar"
      />
    </div>
  )
}
