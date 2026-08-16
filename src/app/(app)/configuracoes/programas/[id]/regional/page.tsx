import { notFound } from 'next/navigation'
import { obterPrograma } from '@/lib/dados/programas'
import { listarPrecos, listarAcoesRegionais } from '@/lib/dados/regional'
import { listarDatasBloqueadas } from '@/lib/dados/datas-bloqueadas'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { PainelRegional } from '@/components/programas/PainelRegional'

/** A janela de datas que a matriz e o seletor de venda enxergam sem recarregar a página. */
const MESES_PARA_TRAS = 1
const MESES_PARA_FRENTE = 12

function deslocarMeses(dataIso: string, meses: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`)
  data.setUTCMonth(data.getUTCMonth() + meses)
  return data.toISOString().slice(0, 10)
}

/**
 * Aba Regional — Task 10 montou a rota; Task 12 traz o conteúdo de verdade:
 * preços por praça, matriz de disponibilidade e registro de ações vendidas
 * (`PainelRegional`).
 *
 * `AbasDoPrograma` só mostra este link quando `aceita_regional` é
 * verdadeiro, mas isso é conveniência de interface — quem digitar a URL de
 * um programa que não vende regional recebe `notFound()` aqui, igual à
 * guarda do layout: a aba não existe para este programa.
 */
export default async function PaginaDeRegional({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const programa = await obterPrograma(id)

  if (!programa || !programa.aceita_regional) notFound()

  // R10/R11 exigem os dois para existir slot regional (validado em
  // `validarPrograma`, Task 3) — mas um programa marcado `aceita_regional`
  // antes de preencher os dois é um estado transitório possível, então a
  // aba explica em vez de quebrar.
  if (programa.dia_da_semana_regional === null || programa.prazo_minimo_regional_dias === null) {
    return (
      <EstadoVazio
        titulo="Configuração regional incompleta"
        explicacao="Preencha o dia da semana e o prazo mínimo regional na aba Cadastro antes de vender ações regionais."
      />
    )
  }

  const hojeIso = new Date().toISOString().slice(0, 10)
  const deIso = deslocarMeses(hojeIso, -MESES_PARA_TRAS)
  const ateIso = deslocarMeses(hojeIso, MESES_PARA_FRENTE)

  // As datas bloqueadas entram aqui porque R12 vale para o regional igual ao
  // nacional: sem elas, uma sexta fechada por feriado apareceria com 5 praças
  // livres e aceitaria venda.
  const [precos, acoes, bloqueios] = await Promise.all([
    listarPrecos(id),
    listarAcoesRegionais(id, deIso, ateIso),
    listarDatasBloqueadas(id),
  ])

  return (
    <PainelRegional
      programaId={id}
      diaDaSemanaRegional={programa.dia_da_semana_regional}
      prazoMinimoRegionalDias={programa.prazo_minimo_regional_dias}
      maxPracasPorAcao={programa.max_pracas_por_acao}
      precosIniciais={precos}
      custoProducaoRegional={programa.custo_producao_regional}
      acoesIniciais={acoes}
      bloqueios={bloqueios}
      hojeIso={hojeIso}
    />
  )
}
