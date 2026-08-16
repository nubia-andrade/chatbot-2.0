'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DataBloqueada } from '@/lib/dominio/bloqueios'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { MatrizDePracas, type AcaoRegionalDaMatriz } from './MatrizDePracas'
import { FormularioDeAcaoRegional } from './FormularioDeAcaoRegional'
import { TabelaDeCustosRegionais, type PrecoDePraca } from './TabelaDeCustosRegionais'

type Props = {
  programaId: string
  diaDaSemanaRegional: number
  prazoMinimoRegionalDias: number
  maxPracasPorAcao: number
  precosIniciais: PrecoDePraca[]
  /** `programas.custo_producao_regional` — única por programa, somada uma vez no total da ação. */
  custoProducaoRegional: number | null
  acoesIniciais: AcaoRegionalDaMatriz[]
  /** Datas bloqueadas do programa — R12 vale para o regional igual ao nacional. */
  bloqueios: DataBloqueada[]
  hojeIso: string
  /** Quantos clientes da carteira inteira estão marcados como elegíveis — a lista é global, não deste programa. */
  clientesElegiveis: number
}

/**
 * Aba Regional inteira — Task 12; custos por praça reestruturados na
 * Entrega 3 (`TabelaDeCustosRegionais`, TV/digital com direitos calculados).
 *
 * Reúne os pedaços do brief numa tela só, na ordem em que o consultor usa:
 * primeiro os custos (o que cada praça custa), depois a matriz (o que ainda
 * está livre) e por fim o formulário de venda (registrar o que foi fechado).
 * Clicar numa data livre da matriz preenche o formulário — a "consequência"
 * visível de que a spec pede, e não duas telas que não se falam.
 */
export function PainelRegional({
  programaId,
  diaDaSemanaRegional,
  prazoMinimoRegionalDias,
  maxPracasPorAcao,
  precosIniciais,
  custoProducaoRegional,
  acoesIniciais,
  bloqueios,
  hojeIso,
  clientesElegiveis,
}: Props) {
  const [acoes, setAcoes] = useState<AcaoRegionalDaMatriz[]>(acoesIniciais)
  const [dataClicadaNaMatriz, setDataClicadaNaMatriz] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <ResumoDeClientesElegiveis quantidade={clientesElegiveis} />

      <TabelaDeCustosRegionais
        programaId={programaId}
        precosIniciais={precosIniciais}
        custoProducaoRegional={custoProducaoRegional}
      />

      <MatrizDePracas
        diaDaSemanaRegional={diaDaSemanaRegional}
        prazoMinimoRegionalDias={prazoMinimoRegionalDias}
        acoes={acoes}
        bloqueios={bloqueios}
        hojeIso={hojeIso}
        aoEscolherData={setDataClicadaNaMatriz}
      />

      <FormularioDeAcaoRegional
        programaId={programaId}
        diaDaSemanaRegional={diaDaSemanaRegional}
        prazoMinimoRegionalDias={prazoMinimoRegionalDias}
        maxPracasPorAcao={maxPracasPorAcao}
        hojeIso={hojeIso}
        acoes={acoes}
        bloqueios={bloqueios}
        dataSugeridaPelaMatriz={dataClicadaNaMatriz}
        aoRegistrar={(novas) => setAcoes((atual) => [...atual, ...novas])}
      />

      <SecaoDeAcoesVendidas acoes={acoes} />
    </div>
  )
}

/**
 * Atalho para a gestão de elegibilidade — Configurações → Clientes
 * regionais. Deixa explícito que a lista é GLOBAL (vale para todos os
 * programas que aceitam regional), não uma configuração deste programa,
 * porque sem esse aviso o consultor acha que está mexendo só aqui.
 */
function ResumoDeClientesElegiveis({ quantidade }: { quantidade: number }) {
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
      style={{ background: 'var(--superficie-suave)' }}
    >
      <p className="text-[13px] text-[var(--texto-2)]">
        <span className="font-bold text-[var(--texto)]">
          {quantidade.toLocaleString('pt-BR')} cliente{quantidade === 1 ? '' : 's'} elegíve
          {quantidade === 1 ? 'l' : 'is'} para ações regionais.
        </span>{' '}
        Essa lista é global: vale para este e para todos os outros programas que aceitam regional, não só para
        este programa.
      </p>
      <Link
        href="/configuracoes/clientes-regionais"
        className="shrink-0 text-[12.5px] font-bold hover:underline"
        style={{ color: 'var(--roxo)' }}
      >
        Gerenciar clientes elegíveis →
      </Link>
    </section>
  )
}

function SecaoDeAcoesVendidas({ acoes }: { acoes: AcaoRegionalDaMatriz[] }) {
  const ordenadas = [...acoes].sort((a, b) => b.data_de_exibicao.localeCompare(a.data_de_exibicao))

  function formatarData(iso: string): string {
    const data = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(data.getTime())) return iso
    const dia = String(data.getUTCDate()).padStart(2, '0')
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
    return `${dia}/${mes}/${data.getUTCFullYear()}`
  }

  return (
    <section>
      <h3 className="mb-3 text-[14px] font-bold text-[var(--texto)]">Ações vendidas</h3>
      {ordenadas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma ação regional vendida ainda"
          explicacao="Registre a primeira venda no formulário acima — ela aparece aqui e na matriz de disponibilidade."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenadas.map((acao) => (
            <li
              key={acao.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
              style={{ background: 'var(--superficie)' }}
            >
              <span className="text-[13.5px] font-bold text-[var(--texto)]">
                {formatarData(acao.data_de_exibicao)} · {acao.praca_codigo}
              </span>
              <span className="text-[13px] text-[var(--texto-3)]">{acao.cliente_nome}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
