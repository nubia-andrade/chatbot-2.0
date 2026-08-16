import { cache } from 'react'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import type { Programa } from '../dominio/cadastro'

/** Um apelido já gravado, com o `id` que o botão de remover precisa. */
export type Apelido = { id: string; texto: string }

/**
 * Todos os programas cadastrados, para a lista de configuração.
 *
 * Ordenados por nome — é assim que quem administra procura um programa
 * específico numa lista longa.
 */
export async function listarProgramas(): Promise<Programa[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('programas')
    .select('*')
    .order('nome', { ascending: true })

  if (error) {
    console.error('Falha ao listar programas:', error.message)
    return []
  }

  return (data ?? []) as Programa[]
}

/**
 * Um programa específico, para preencher o formulário de edição.
 *
 * Envolvido em `cache()` porque tanto o layout da área do programa
 * (`[id]/layout.tsx`, para a guarda por vínculo e o cabeçalho) quanto a
 * página de cadastro (`[id]/page.tsx`) precisam do mesmo programa na mesma
 * requisição — layouts não repassam dados para os filhos, então cada um
 * chama de novo; `cache()` faz as duas chamadas virarem uma só consulta.
 */
export const obterPrograma = cache(async (id: string): Promise<Programa | null> => {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('programas')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  return data as Programa
})

/**
 * Os apelidos de um programa, para o editor da tela de edição.
 *
 * Quatro dos 23 programas chegam da API sem mnemônico (R6) — sem apelido
 * cadastrado, ficam invisíveis ao cálculo de ocupação.
 */
export async function listarApelidos(programaId: string): Promise<Apelido[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('programa_apelidos')
    .select('id, texto')
    .eq('programa_id', programaId)
    .order('texto', { ascending: true })

  if (error) {
    console.error('Falha ao listar apelidos:', error.message)
    return []
  }

  return data ?? []
}
