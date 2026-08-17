'use client'

import { useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'

/**
 * Passo 2 — Setor (tela 1c do handoff). Conteúdo real é a Task 11.
 *
 * Sem gate próprio: o setor nasce junto do cliente (detectado
 * automaticamente), então quem chega até aqui já pode seguir adiante.
 */
export default function PassoSetor() {
  useGuardaDoPasso('setor')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Setor e categoria do cliente
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Classificação governada e regras de concorrência aplicáveis.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara="cliente"
        avancarPara="programa"
        avancarRotulo="Selecionar programa"
        habilitado
      />
    </div>
  )
}
