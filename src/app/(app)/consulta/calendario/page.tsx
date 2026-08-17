'use client'

import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'

/**
 * Passo 4 — Calendário (tela 1e do handoff, a tela central). Conteúdo real
 * é a Task 12.
 *
 * Quando essa task escrever `itens` de verdade (via `atualizar`), a troca
 * de datas invalida sozinha a confirmação do passo 5 — `atualizar` já
 * zera `datasConfirmadas` sempre que `itens` está no parcial (ver
 * `ProvedorDaConsulta.tsx`). Não é preciso fazer nada aqui além de chamar
 * `atualizar({ itens: [...] })` normalmente.
 */
export default function PassoCalendario() {
  useGuardaDoPasso('calendario')
  const { estado } = useConsulta()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Disponibilidade elegível
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Selecione as datas disponíveis para este cliente e programa.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
        style={{ background: 'var(--superficie)' }}
      >
        Conteúdo do passo vem aqui.
      </div>

      <AcoesDoPasso
        voltarPara="programa"
        avancarPara="datas"
        avancarRotulo="Ver datas selecionadas"
        habilitado={estado.itens.length > 0}
        motivo="Selecione ao menos uma data para continuar"
      />
    </div>
  )
}
