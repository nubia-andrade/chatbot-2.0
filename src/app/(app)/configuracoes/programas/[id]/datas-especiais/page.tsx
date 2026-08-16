import { obterPrograma } from '@/lib/dados/programas'
import { listarDatasEspeciais } from '@/lib/dados/datas-especiais'
import { listarPrecos } from '@/lib/dados/regional'
import { PainelDeDatasEspeciais } from '@/components/programas/PainelDeDatasEspeciais'

/**
 * Aba Datas especiais — período com preço diferenciado (Black Friday,
 * Natal…), diferente de Datas bloqueadas: aquela impede a venda, esta muda
 * o preço.
 *
 * Busca os preços regionais só quando o programa aceita regional, e
 * descarta as praças sem preço cadastrado ainda (`custo_midia_tv === 0`,
 * convenção de `listarPrecos`) — mostrar "R$ 0,00 → R$ 0,00" no efeito não
 * ajuda ninguém.
 *
 * A guarda de acesso já é do layout (`[id]/layout.tsx`).
 */
export default async function PaginaDeDatasEspeciais({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const programa = await obterPrograma(id)

  const [periodos, precosRegionais] = await Promise.all([
    listarDatasEspeciais(id),
    programa?.aceita_regional ? listarPrecos(id) : Promise.resolve([]),
  ])

  return (
    <PainelDeDatasEspeciais
      programaId={id}
      periodosIniciais={periodos}
      custoMidiaTv={programa?.custo_midia_tv ?? null}
      aceitaRegional={Boolean(programa?.aceita_regional)}
      precosRegionais={precosRegionais
        .filter((preco) => preco.custo_midia_tv > 0)
        .map((preco) => ({ praca_codigo: preco.praca_codigo, custo_midia_tv: preco.custo_midia_tv }))}
    />
  )
}
