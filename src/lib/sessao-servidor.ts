import { criarClienteServidor } from './supabase/cliente-servidor'
import { listarProgramasVinculados } from './dados/vinculos'
import {
  podeAdministrarProgramas,
  secoesPadraoDosPerfis,
  type Perfil,
  type SecaoApp,
} from './dominio/perfis'

export type Sessao = {
  usuarioId: string
  email: string
  nome: string
  cargo: string | null
  perfis: Perfil[]
  programasVinculados: string[]
  secoes: SecaoApp[]
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

  const perfisLidos = (linhasDePerfil ?? []).map((linha) => linha.perfil as Perfil)
  const perfis = perfisLidos.length > 0 ? perfisLidos : ['executivo' as Perfil]
  const programasVinculados = await listarProgramasVinculados(usuarioAutenticado.id)

  // A matriz no banco é configurável pela Proprietária. Enquanto a migration
  // ainda não tiver sido aplicada, usa os padrões do domínio para não impedir
  // o login nem a navegação durante a atualização do ambiente.
  let secoes = secoesPadraoDosPerfis(perfis)
  const { data: permissoes, error: erroPermissoes } = await supabase
    .from('perfil_secao')
    .select('perfil, secao, permitido')
    .in('perfil', perfis)
    .eq('permitido', true)

  if (!erroPermissoes && permissoes) {
    const permitidas = new Set<SecaoApp>(['inicio'])
    for (const linha of permissoes) {
      if (linha.secao === 'inicio' || linha.secao === 'consulta' || linha.secao === 'propostas' || linha.secao === 'configuracoes') {
        permitidas.add(linha.secao as SecaoApp)
      }
    }
    secoes = ['inicio', 'consulta', 'propostas', 'configuracoes']
      .filter((secao): secao is SecaoApp => permitidas.has(secao as SecaoApp))
  }

  return {
    usuarioId: usuarioAutenticado.id,
    email: usuarioAutenticado.email ?? '',
    nome: usuario?.nome ?? usuarioAutenticado.email ?? '',
    cargo: usuario?.cargo ?? null,
    perfis,
    programasVinculados,
    secoes,
  }
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  if (!sessao) return false
  return podeAdministrarProgramas(sessao.perfis)
}
