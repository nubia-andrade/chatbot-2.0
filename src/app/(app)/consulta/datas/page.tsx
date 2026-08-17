'use client'

import { useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'

/**
 * Passo 5 — Datas. Conteúdo real é a Task 14.
 *
 * Sem gate próprio: quem chega aqui já tem `itens` preenchido pelo passo
 * Calendário (é o que `primeiroPassoPendente` exige para liberar o
 * avanço).
 */
export default function PassoDatas() {
  useGuardaDoPasso('datas')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Datas selecionadas
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Ajuste a quantidade de inserções por data antes de seguir para o resumo.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara="calendario"
        avancarPara="resumo"
        avancarRotulo="Ver resumo"
        habilitado
      />
    </div>
  )
}
