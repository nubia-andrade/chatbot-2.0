'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import {
  SECOES_DO_APP,
  SECOES_PADRAO_POR_PERFIL,
  temPerfil,
  type Perfil,
  type SecaoApp,
} from '../dominio/perfis'

export type UsuarioComAcessos = {
  usuario_id: string
  email: string
  nome: string
  cargo: string | null
  perfis: Perfil[]
  programas: string[]
}

export type PermissaoDeSecao = {
  perfil: Perfil
  secao: SecaoApp
  permitido: boolean
}

const PERFIS_VALIDOS: Perfil[] = [
  'executivo',
  'executivo_regional',
  'consultor_programa',
  'proprietario',
]

async function exigirProprietario() {
  const sessao = await obterSessao()
  if (!sessao || !temPerfil(sessao.perfis, 'proprietario')) {
    throw new Error('Apenas o proprietário pode administrar perfis e acessos.')
  }
  return sessao
}

export async function listarUsuariosComAcessos(): Promise<UsuarioComAcessos[]> {
  await exigirProprietario()
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('listar_usuarios_acessos')

  if (error) {
    console.error('Falha ao listar usuários e acessos:', error.message)
    return []
  }

  return (data ?? []).map((linha: {
    usuario_id: string
    email: string | null
    nome: string | null
    cargo: string | null
    perfis: string[] | null
    programas: string[] | null
  }) => ({
    usuario_id: linha.usuario_id,
    email: linha.email ?? '',
    nome: linha.nome ?? linha.email ?? '',
    cargo: linha.cargo,
    perfis: (linha.perfis ?? []).filter((perfil): perfil is Perfil =>
      PERFIS_VALIDOS.includes(perfil as Perfil),
    ),
    programas: linha.programas ?? [],
  }))
}

export async function listarPermissoesDeSecoes(): Promise<PermissaoDeSecao[]> {
  await exigirProprietario()
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('perfil_secao')
    .select('perfil, secao, permitido')

  if (!error && data) {
    return data
      .filter((linha) =>
        PERFIS_VALIDOS.includes(linha.perfil as Perfil)
        && SECOES_DO_APP.some((secao) => secao.valor === linha.secao),
      )
      .map((linha) => ({
        perfil: linha.perfil as Perfil,
        secao: linha.secao as SecaoApp,
        permitido: Boolean(linha.permitido),
      }))
  }

  // Fallback seguro enquanto a migration ainda não foi executada.
  return PERFIS_VALIDOS.flatMap((perfil) =>
    SECOES_DO_APP.map(({ valor }) => ({
      perfil,
      secao: valor,
      permitido: SECOES_PADRAO_POR_PERFIL[perfil].includes(valor),
    })),
  )
}

export async function salvarSecoesDoPerfil(entrada: {
  perfil: Perfil
  secoes: SecaoApp[]
}): Promise<{ erro: string | null }> {
  await exigirProprietario()
  if (!PERFIS_VALIDOS.includes(entrada.perfil)) return { erro: 'Perfil inválido.' }

  const secoesValidas = [...new Set(entrada.secoes)]
    .filter((secao) => SECOES_DO_APP.some((item) => item.valor === secao))

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('salvar_secoes_do_perfil', {
    p_perfil: entrada.perfil,
    p_secoes: secoesValidas,
  })

  if (error) {
    const texto = error.message.toLowerCase()
    const semMigration = texto.includes('salvar_secoes_do_perfil') || texto.includes('could not find')
    return {
      erro: semMigration
        ? 'Execute schema-entrega-4-secoes-perfis.sql no Supabase para habilitar a matriz de seções.'
        : error.message,
    }
  }

  revalidatePath('/configuracoes/perfis')
  revalidatePath('/inicio')
  return { erro: null }
}

export async function salvarAcessosUsuario(entrada: {
  usuarioId: string
  perfis: Perfil[]
  programas: string[]
}): Promise<{ erro: string | null }> {
  await exigirProprietario()

  const perfis = [...new Set(entrada.perfis)].filter((perfil) => PERFIS_VALIDOS.includes(perfil))
  if (perfis.length === 0) return { erro: 'Selecione ao menos um perfil.' }

  const programas = perfis.includes('consultor_programa')
    ? [...new Set(entrada.programas)]
    : []

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('atualizar_acessos_usuario', {
    p_usuario_id: entrada.usuarioId,
    p_perfis: perfis,
    p_programas: programas,
  })

  if (error) {
    console.error('Falha ao atualizar acessos do usuário:', error.message)
    return { erro: error.message }
  }

  revalidatePath('/configuracoes/perfis')
  return { erro: null }
}
