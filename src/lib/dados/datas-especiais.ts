import { criarClienteServidor } from '../supabase/cliente-servidor'

export type PeriodoEspecial = {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  percentual_acrescimo: number
  texto_investimento: string | null
  /** 0=domingo … 6=sábado. Vazio ou nulo = todos os dias do período. */
  dias_da_semana: number[] | null
}

function faltaColunaDiasDaSemana(mensagem: string): boolean {
  const normalizada = mensagem.toLowerCase()
  return normalizada.includes('dias_da_semana')
    && (normalizada.includes('does not exist') || normalizada.includes('could not find'))
}

/**
 * Quantos períodos especiais um programa tem — alimenta o contador da aba
 * "Datas especiais" em `AbasDoPrograma` ("Datas especiais · 2").
 */
export async function contarDatasEspeciais(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('datas_especiais')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar datas especiais:', error.message)
    return 0
  }

  return count ?? 0
}

/**
 * Todos os períodos especiais de um programa, mais recentes primeiro pela
 * data de início. Sem paginação: um programa não acumula centenas de
 * períodos especiais — bem abaixo das 1000 linhas do PostgREST.
 */
export async function listarDatasEspeciais(programaId: string): Promise<PeriodoEspecial[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('datas_especiais')
    .select('id, nome, data_inicio, data_fim, percentual_acrescimo, texto_investimento, dias_da_semana')
    .eq('programa_id', programaId)
    .order('data_inicio', { ascending: false })

  if (error) {
    // Em ambiente local, console.error abre o overlay vermelho do Next.js.
    // Para este caso de schema conhecido, a própria tela já orienta qual
    // migration executar; warn preserva o diagnóstico sem bloquear a UX.
    if (faltaColunaDiasDaSemana(error.message)) {
      console.warn(
        'Banco desatualizado: execute supabase/schema-correcao-proposta-datas-especiais.sql.',
      )
    } else {
      console.error('Falha ao listar datas especiais:', error.message)
    }
    return []
  }

  return data ?? []
}
