import { criarClienteServidor } from './supabase/cliente-servidor'
import { listarProgramasVinculados } from './dados/vinculos'
import { podeAdministrarProgramas, type Perfil } from './dominio/perfis'

export type Sessao = {
  usuarioId: string
  email: string
  nome: string
  cargo: string | null
  perfis: Perfil[]
  programasVinculados: string[]
}

/**
 * Quem está logado, lido no servidor antes da página ser montada.
 *
 * Usa `getUser()`, e não `getSession()`: `getUser()` confere o token com o
 * servidor do Supabase, enquanto `getSession()` confia no cookie, que o
 * navegador pode ter adulterado.
 *
 * Devolve null para quem não está autenticado. Sem cadastro em `usuario` ou
 * `perfil_usuario` a pessoa ainda é considerada logada (autenticação e
 * autorização são passos distintos), com o perfil mais restrito por
 * padrão — nunca o mais permissivo.
 */
export async function obterSessao(): Promise<Sessao | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.auth.getUser()
  const usuarioAutenticado = data.user
  if (!usuarioAutenticado) return null

  const [{ data: usuario }, { data: linhasDePerfil }] = await Promise.all([
    supabase
      .from('usuario')
      .select('nome, cargo')
      .eq('usuario_id', usuarioAutenticado.id)
      .maybeSingle(),
    supabase.from('perfil_usuario').select('perfil').eq('usuario_id', usuarioAutenticado.id),
  ])

  const perfis = (linhasDePerfil ?? []).map((linha) => linha.perfil as Perfil)
  const programasVinculados = await listarProgramasVinculados(usuarioAutenticado.id)

  return {
    usuarioId: usuarioAutenticado.id,
    email: usuarioAutenticado.email ?? '',
    nome: usuario?.nome ?? usuarioAutenticado.email ?? '',
    cargo: usuario?.cargo ?? null,
    perfis: perfis.length > 0 ? perfis : ['executivo'],
    programasVinculados,
  }
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  if (!sessao) return false
  return podeAdministrarProgramas(sessao.perfis)
}
