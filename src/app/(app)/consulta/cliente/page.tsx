'use client'

import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'

/**
 * Passo 1 — Cliente (tela 1b do handoff). Conteúdo real é a Task 10; aqui
 * só o suficiente para provar a navegação, a guarda e o stepper de ponta a
 * ponta.
 */
export default function PassoCliente() {
  useGuardaDoPasso('cliente')
  const { estado } = useConsulta()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Para quem você está vendendo?
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Pesquise o anunciante por nome ou CNPJ.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara={null}
        avancarPara="setor"
        avancarRotulo="Ver setor do cliente"
        habilitado={estado.cliente !== null}
        motivo="Selecione um cliente para continuar"
      />
    </div>
  )
}
