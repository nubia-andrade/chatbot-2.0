'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'

/** Um cliente da carteira, com o que distingue dois nomes parecidos. */
export type Cliente = {
  id: string
  nome: string
  cnpj: string | null
  setor: string | null
  industria: string | null
}

const LIMITE_PADRAO = 20

/**
 * Escapa os coringas do `LIKE`/`ILIKE` do Postgres antes de interpolar um
 * termo digitado livremente num padrão `%…%`.
 *
 * `%` casa qualquer sequência, `_` casa qualquer caractere único e `\` é o
 * caractere de escape — sem isso, uma razão social com `_` (comum em nomes
 * compostos) ou alguém que digite `%` por acaso produz correspondência
 * errada, não um erro. A ordem importa: a barra invertida escapa primeiro,
 * senão as barras inseridas para escapar `%` e `_` seriam escapadas de novo.
 */
function escaparCoringasLike(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Busca clientes da carteira por nome, para o `CampoDeBuscaDeCliente`.
 *
 * São 15.519 registros (`supabase/seed-clientes.sql`): nunca traz a tabela
 * inteira. `ilike` com o termo entre `%…%` casa em qualquer posição do nome
 * ("ambev" acha "Ambev S/A"), e o `limite` padrão de 20 mantém a resposta
 * rápida mesmo com um termo curto e comum. A política "leitura autenticada"
 * de `clientes` (`supabase/schema.sql`) é o que permite esta consulta rodar
 * direto do navegador, sem servidor no meio: qualquer sessão autenticada lê,
 * ninguém escreve.
 */
export async function buscarClientes(
  termo: string,
  limite: number = LIMITE_PADRAO,
): Promise<Cliente[]> {
  const termoLimpo = termo.trim()
  if (termoLimpo === '') return []

  const supabase = criarClienteNavegador()

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, cnpj, setor, industria')
    .ilike('nome', `%${escaparCoringasLike(termoLimpo)}%`)
    .order('nome', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('Falha ao buscar clientes:', error.message)
    return []
  }

  return (data ?? []) as Cliente[]
}
