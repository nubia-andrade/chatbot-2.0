import { criarClienteServidor } from '../supabase/cliente-servidor'
import { PRACAS, type AcaoRegional } from '../dominio/regional'

/**
 * Leituras da aba Regional — Task 12.
 *
 * Distinta de `src/lib/dados/acoes-regionais.ts` (Task 10): aquele arquivo
 * alimenta o contador da aba e a listagem simples "todas as ações, mais
 * recentes primeiro". Este arquivo alimenta a `MatrizDePracas` — que precisa
 * de uma janela de datas, não da tabela inteira — e a tabela de preços por
 * praça (Step 1 do brief).
 */

/**
 * Custos de uma praça — TV e digital, com os dois "direitos e conexos"
 * calculados aqui na leitura (nunca gravados —
 * `src/lib/dominio/direitos-e-conexos.ts`), para a tela não precisar
 * recalcular no primeiro render antes de qualquer digitação.
 *
 * Produção regional NÃO mora mais aqui — decisão da área: a produção é única
 * por PROGRAMA, não por praça (`programas.custo_producao_regional`,
 * `src/lib/dominio/custo-da-acao-regional.ts`). Colunas de produção que
 * existiram brevemente em `preco_regional` foram removidas por
 * `supabase/schema-entrega-2-producao-regional.sql`.
 */
export type PrecoDePraca = {
  praca_codigo: string
  custo_midia_tv: number
  percentual_simulcast: number | null
  custo_midia_digital: number | null
  atualizado_em: string
}

/**
 * Custos de cada uma das 5 praças para um programa. Sempre devolve as 5, na
 * ordem de `PRACAS` — uma praça sem preço cadastrado ainda aparece na
 * tabela, com `custo_midia_tv` `0` e o resto `null`/sem `atualizado_em`, para
 * o formulário de preços nunca "perder" uma praça por falta de linha no
 * banco.
 */
export async function listarPrecos(programaId: string): Promise<PrecoDePraca[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('preco_regional')
    .select('praca_codigo, custo_midia_tv, percentual_simulcast, custo_midia_digital, atualizado_em')
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao listar preços regionais:', error.message)
  }

  const porPraca = new Map((data ?? []).map((linha) => [linha.praca_codigo, linha]))

  return PRACAS.map((praca) => {
    const existente = porPraca.get(praca)
    return {
      praca_codigo: praca,
      custo_midia_tv: existente?.custo_midia_tv ?? 0,
      percentual_simulcast: existente?.percentual_simulcast ?? null,
      custo_midia_digital: existente?.custo_midia_digital ?? null,
      atualizado_em: existente?.atualizado_em ?? '',
    }
  })
}

/**
 * Ações regionais já vendidas de um programa, dentro de um intervalo de
 * datas — a janela que a `MatrizDePracas` mostra (dois meses por vez).
 *
 * Sem paginação: mesmo o maior intervalo praticável aqui (alguns meses de um
 * slot semanal por praça) fica muito abaixo das 1000 linhas do PostgREST —
 * diferente de `clientes` e `acoes_vendidas`, que `lerPaginado` existe para
 * cobrir.
 */
export async function listarAcoesRegionais(
  programaId: string,
  deIso: string,
  ateIso: string,
): Promise<(AcaoRegional & { id: string; origem: 'manual' | 'sugerido_api' })[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('acoes_regionais')
    .select('id, data_de_exibicao, cliente_nome, praca_codigo, origem')
    .eq('programa_id', programaId)
    .gte('data_de_exibicao', deIso)
    .lte('data_de_exibicao', ateIso)
    .order('data_de_exibicao', { ascending: true })

  if (error) {
    console.error('Falha ao listar ações regionais no intervalo:', error.message)
    return []
  }

  return data ?? []
}
