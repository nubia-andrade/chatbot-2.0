'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'
import { restricaoQueBloqueia, type Restricao } from '../dominio/restricoes'

/** Um programa cuja restrição cadastrada bloqueia o cliente em questão. */
export type ProgramaComRestricao = {
  programa_id: string
  programa_nome: string
  motivo: string
}

/**
 * Programas com restrição cadastrada (`restricoes_anunciante`) que bloqueia
 * este cliente — Task 10.
 *
 * Roda no navegador (`criarClienteNavegador`), como `buscarClientes`: as
 * páginas do wizard de consulta são Client Components (o estado do provider
 * só existe lá), e a política "leitura autenticada" das duas tabelas
 * envolvidas permite a leitura direta pela sessão do executivo.
 *
 * Reúne as restrições por `programa_id` e aplica `restricaoQueBloqueia`
 * (R13, já definida em `@/lib/dominio/restricoes`) a cada grupo — ela casa
 * do mais específico (anunciante nomeado) ao mais genérico (setor ou
 * indústria isolados), então a correspondência não é reimplementada aqui.
 *
 * Serve a dois passos: o passo 2 (esta task) LISTA cada bloqueio, nomeando
 * o programa e o motivo; o passo 3 — Programa, Task 11 — ESMAECE esses
 * programas na lista de escolha.
 */
export async function programasComRestricaoPara(clienteId: string): Promise<ProgramaComRestricao[]> {
  const supabase = criarClienteNavegador()

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('nome, setor, industria')
    .eq('id', clienteId)
    .maybeSingle()

  if (erroCliente || !cliente) {
    console.error('Falha ao buscar cliente para checar restrições:', erroCliente?.message)
    return []
  }

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .select('programa_id, anunciante, setor, industria, motivo, programas(nome)')

  if (error) {
    console.error('Falha ao listar restrições de anunciante:', error.message)
    return []
  }

  type LinhaRestricao = {
    programa_id: string
    anunciante: string | null
    setor: string | null
    industria: string | null
    motivo: string
    programas: { nome: string } | { nome: string }[] | null
  }

  // Agrupa por programa antes de checar: `restricaoQueBloqueia` decide entre
  // várias restrições DE UM MESMO programa (a mais específica vence), então
  // misturar restrições de programas diferentes numa lista só produziria o
  // bloqueio errado.
  const porPrograma = new Map<string, { nome: string; restricoes: Restricao[] }>()

  for (const linha of (data ?? []) as LinhaRestricao[]) {
    const programaEmbutido = Array.isArray(linha.programas) ? linha.programas[0] : linha.programas
    const nomePrograma = programaEmbutido?.nome
    if (!nomePrograma) continue

    const entrada = porPrograma.get(linha.programa_id) ?? { nome: nomePrograma, restricoes: [] }
    entrada.restricoes.push({
      anunciante: linha.anunciante,
      setor: linha.setor,
      industria: linha.industria,
      motivo: linha.motivo,
    })
    porPrograma.set(linha.programa_id, entrada)
  }

  const resultado: ProgramaComRestricao[] = []
  for (const [programaId, { nome, restricoes }] of porPrograma) {
    const bloqueio = restricaoQueBloqueia(restricoes, cliente)
    if (bloqueio) {
      resultado.push({ programa_id: programaId, programa_nome: nome, motivo: bloqueio.motivo })
    }
  }

  return resultado.sort((a, b) => a.programa_nome.localeCompare(b.programa_nome, 'pt-BR'))
}
