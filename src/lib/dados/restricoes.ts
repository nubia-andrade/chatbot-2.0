import { criarClienteServidor } from '../supabase/cliente-servidor'
import { lerPaginado } from './paginacao'

export type Restricao = {
  id: string
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

/**
 * Quantas restrições de anunciante um programa tem — alimenta o contador da
 * aba "Restrições" em `AbasDoPrograma`.
 */
export async function contarRestricoes(programaId: string): Promise<number> {
  const supabase = await criarClienteServidor()

  const { count, error } = await supabase
    .from('restricoes_anunciante')
    .select('id', { count: 'exact', head: true })
    .eq('programa_id', programaId)

  if (error) {
    console.error('Falha ao contar restrições:', error.message)
    return 0
  }

  return count ?? 0
}

/** Todas as restrições de anunciante de um programa. */
export async function listarRestricoes(programaId: string): Promise<Restricao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .select('id, anunciante, setor, industria, motivo')
    .eq('programa_id', programaId)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Falha ao listar restrições:', error.message)
    return []
  }

  return data ?? []
}

export type ValoresDeCategoria = {
  setores: string[]
  industrias: string[]
}

/**
 * Os setores e indústrias que existem de verdade na carteira — para
 * alimentar os campos de seleção do modo "Setor e indústria" e "Só
 * categoria" do formulário de restrições (Task 11). Nenhuma lista fixa: a
 * spec proíbe inventar valores que não vêm de `clientes`, para o campo de
 * seleção nunca oferecer uma opção pela qual nenhum cliente da carteira é
 * classificado.
 *
 * A carteira tem 15.519 linhas — bem além das 1000 que o PostgREST devolve
 * por padrão quando ninguém pede `range()`. Sem `lerPaginado` (mesma leitura
 * paginada da Task de importação, `src/lib/dados/paginacao.ts`), esta lista
 * sairia truncada e um setor ou indústria só presente depois da linha 1000
 * nunca apareceria como opção.
 */
export async function listarValoresDeCategoria(): Promise<ValoresDeCategoria> {
  const supabase = await criarClienteServidor()

  const { linhas, erro } = await lerPaginado<{ setor: string | null; industria: string | null }>(
    (de, ate) => supabase.from('clientes').select('setor, industria').range(de, ate),
  )

  if (erro) {
    console.error('Falha ao listar setores e indústrias da carteira:', erro)
    return { setores: [], industrias: [] }
  }

  const paraLista = (valores: (string | null)[]) =>
    [...new Set(valores.filter((valor): valor is string => Boolean(valor && valor.trim() !== '')))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    )

  return {
    setores: paraLista(linhas.map((linha) => linha.setor)),
    industrias: paraLista(linhas.map((linha) => linha.industria)),
  }
}
