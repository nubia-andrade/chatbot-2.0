'use client'

import { criarClienteNavegador } from '../supabase/cliente-navegador'
import { restricaoQueBloqueia, type Restricao } from '../dominio/restricoes'

export type ProgramaComRestricao = {
  programa_id: string
  programa_nome: string
  motivo: string
}

/**
 * Compatibilidade com telas antigas de classificação. Usa a mesma regra
 * canônica: anunciante > setor + indústria > Segmentação SE.
 */
export async function programasComRestricaoPara(clienteId: string): Promise<ProgramaComRestricao[]> {
  const supabase = criarClienteNavegador()

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('nome, setor, industria, segmentacao_se')
    .eq('id', clienteId)
    .maybeSingle()

  if (erroCliente || !cliente) {
    console.error('Falha ao buscar cliente para checar restrições:', erroCliente?.message)
    return []
  }

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .select('programa_id, anunciante, setor, industria, segmentacao_se, motivo, programas(nome)')

  if (error) {
    console.error('Falha ao listar restrições de anunciante:', error.message)
    return []
  }

  type LinhaRestricao = {
    programa_id: string
    anunciante: string | null
    setor: string | null
    industria: string | null
    segmentacao_se: string | null
    motivo: string
    programas: { nome: string } | { nome: string }[] | null
  }

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
      segmentacao_se: linha.segmentacao_se,
      motivo: linha.motivo,
    })
    porPrograma.set(linha.programa_id, entrada)
  }

  const resultado: ProgramaComRestricao[] = []
  for (const [programaId, { nome, restricoes }] of porPrograma) {
    const bloqueio = restricaoQueBloqueia(restricoes, {
      nome: cliente.nome,
      setor: cliente.setor,
      industria: cliente.industria,
      segmentacao_se: cliente.segmentacao_se,
    })
    if (bloqueio) resultado.push({ programa_id: programaId, programa_nome: nome, motivo: bloqueio.motivo })
  }

  return resultado.sort((a, b) => a.programa_nome.localeCompare(b.programa_nome, 'pt-BR'))
}
