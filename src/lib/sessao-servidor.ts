import { criarClienteServidor } from './supabase/cliente-servidor'

export type Sessao = {
  usuarioId: string
  email: string
  nome: string
  perfil: 'executivo' | 'admin_programa' | 'admin_geral'
}

/**
 * Quem está logado, lido no servidor antes da página ser montada.
 *
 * Usa `getUser()`, e não `getSession()`: `getUser()` confere o token com o
 * servidor do Supabase, enquanto `getSession()` confia no cookie, que o
 * navegador pode ter adulterado.
 *
 * Devolve null para quem não está autenticado. Sem cadastro em
 * `perfil_usuario` a pessoa ainda é considerada logada (autenticação e
 * autorização são passos distintos), com o perfil mais restrito por padrão.
 */
export async function obterSessao(): Promise<Sessao | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.auth.getUser()
  const usuario = data.user
  if (!usuario) return null

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('nome, perfil')
    .eq('usuario_id', usuario.id)
    .maybeSingle()

  return {
    usuarioId: usuario.id,
    email: usuario.email ?? '',
    nome: perfil?.nome ?? usuario.email ?? '',
    perfil: (perfil?.perfil ?? 'executivo') as Sessao['perfil'],
  }
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return sessao?.perfil === 'admin_programa' || sessao?.perfil === 'admin_geral'
}
